import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import "./ResetPassword.css";

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
    <div className="ef-reset">
      <header className="ef-reset__nav">
        <a className="ef-reset__brand" href="/">
          energyforward<span className="ef-reset__dot">.</span>
        </a>
        <div className="ef-reset__nav-right">
          <span className="ef-reset__live"></span>
          <span className="ef-reset__meta">operating in stealth</span>
        </div>
      </header>

      <main className="ef-reset__main">
        <div className="ef-reset__bg"></div>
        <div className="ef-reset__grid"></div>

        <div className="ef-reset__panel">
          <div className="ef-reset__kicker">secure access</div>
          <h1 className="ef-reset__head">
            reset password<span className="ef-reset__dot">.</span>
          </h1>
          <p className="ef-reset__sub">
            choose a new password to continue to your energyforward portal.
          </p>

          {!ready ? (
            <p className="ef-reset__notice">
              open this page from the password reset email link.
            </p>
          ) : (
            <form onSubmit={handleSubmit} className="ef-reset__form">
              <label className="ef-reset__field">
                <span>new password</span>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                />
              </label>
              <label className="ef-reset__field">
                <span>confirm password</span>
                <input
                  type="password"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  placeholder="••••••••"
                  required
                />
              </label>
              <button type="submit" className="ef-reset__cta" disabled={loading}>
                <span>{loading ? "updating" : "update password"}</span>
                <span className="ef-reset__arrow">→</span>
              </button>
            </form>
          )}

          <a className="ef-reset__back" href="/">← back to home</a>
        </div>
      </main>
    </div>
  );
}