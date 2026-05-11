import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";

export default function ResetPassword() {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [ready, setReady] = useState(false);
  const [loading, setLoading] = useState(false);
  const verificationStarted = useRef(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    const verifyTokenHash = async () => {
      const params = new URLSearchParams(window.location.search);
      const tokenHash = params.get("token_hash");
      if (!tokenHash || params.get("type") !== "recovery" || verificationStarted.current) return;

      verificationStarted.current = true;
      const { error } = await supabase.auth.verifyOtp({
        token_hash: tokenHash,
        type: "recovery",
      });

      if (error) {
        toast({ title: "Reset link expired", description: "Please request a new password reset link.", variant: "destructive" });
        return;
      }

      setReady(true);
      window.history.replaceState({}, "", "/reset-password");
    };

    verifyTokenHash();
    // Supabase parses the recovery token from URL hash automatically
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY" || event === "SIGNED_IN") setReady(true);
    });
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) setReady(true);
    });
    return () => subscription.unsubscribe();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 8) {
      toast({ title: "Password too short", description: "Min 8 characters", variant: "destructive" });
      return;
    }
    if (password !== confirm) {
      toast({ title: "Passwords don't match", variant: "destructive" });
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (error) {
      toast({ title: "Reset failed", description: error.message, variant: "destructive" });
      return;
    }
    // Clear must_change_password flag
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      await supabase
        .from("profiles")
        .update({ must_change_password: false })
        .eq("user_id", user.id);
    }
    toast({ title: "Password updated", description: "You're now signed in." });
    navigate("/p/investor");
  };

  return (
    <main className="min-h-screen flex items-center justify-center px-4">
      <Card className="w-full max-w-md shadow-energy">
        <CardHeader>
          <CardTitle>Reset your password</CardTitle>
        </CardHeader>
        <CardContent>
          {!ready ? (
            <p className="text-sm text-muted-foreground">
              Open this page from the password reset email link.
            </p>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label htmlFor="pw">New Password</Label>
                <Input id="pw" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
              </div>
              <div>
                <Label htmlFor="cpw">Confirm Password</Label>
                <Input id="cpw" type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} required />
              </div>
              <Button type="submit" variant="energy" className="w-full" disabled={loading}>
                {loading ? "Updating…" : "Update Password"}
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </main>
  );
}