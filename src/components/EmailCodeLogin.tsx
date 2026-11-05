import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { emailCodeOptions, portalCodeSchema, portalEmailSchema } from "@/lib/portal-sign-in";

export function EmailCodeLogin({ defaultEmail, onSuccess, onPassword }: { defaultEmail?: string; onSuccess: () => void; onPassword: () => void }) {
  const [email, setEmail] = useState(defaultEmail ?? "");
  const [code, setCode] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [cooldown, setCooldown] = useState(0);
  const pending = useRef(false);
  useEffect(() => {
    if (!cooldown) return;
    const timer = window.setTimeout(() => setCooldown((seconds) => Math.max(0, seconds - 1)), 1000);
    return () => window.clearTimeout(timer);
  }, [cooldown]);

  const sendCode = async () => {
    if (pending.current || cooldown) return;
    const parsed = portalEmailSchema.safeParse(email);
    if (!parsed.success) { setError(parsed.error.errors[0]?.message ?? "Enter your email address."); return; }
    pending.current = true;
    setBusy(true);
    setError("");
    try {
      const { error: requestError } = await supabase.auth.signInWithOtp({ email: parsed.data, options: emailCodeOptions });
      // Keep unknown accounts indistinguishable from an accepted request.
      if (requestError && !["otp_disabled", "user_not_found", "signup_disabled"].includes(requestError.code ?? "")) {
        setError("We couldn't send a code. Please wait a moment and try again, or use your password.");
        return;
      }
      setEmail(parsed.data);
      setSent(true);
      setCooldown(60);
    } catch {
      setError("We couldn't send a code. Please try again.");
    } finally {
      pending.current = false;
      setBusy(false);
    }
  };

  const verifyCode = async () => {
    if (pending.current) return;
    const parsedEmail = portalEmailSchema.safeParse(email);
    const parsedCode = portalCodeSchema.safeParse(code);
    if (!parsedEmail.success || !parsedCode.success) { setError("Enter the verification code from your email."); return; }
    pending.current = true;
    setBusy(true);
    setError("");
    try {
      const { data, error: verifyError } = await supabase.auth.verifyOtp({ email: parsedEmail.data, token: parsedCode.data, type: "email" });
      if (verifyError || !data.session) { setError("That code is invalid or expired. Try again or request a new code."); return; }
      onSuccess();
    } catch {
      setError("We couldn't verify your code. Please try again.");
    } finally {
      pending.current = false;
      setBusy(false);
    }
  };

  return (
    <form className="space-y-4 mt-6 text-foreground" onSubmit={(event) => { event.preventDefault(); void (sent ? verifyCode() : sendCode()); }}>
      <div className="space-y-2">
        <Label htmlFor="portal-code-email">Email address</Label>
        <Input id="portal-code-email" type="email" autoComplete="email" autoFocus value={email} disabled={sent || busy} onChange={(event) => setEmail(event.target.value)} required className="bg-background text-foreground" />
      </div>
      {sent && <>
        <p role="status" className="text-sm text-muted-foreground">If this email belongs to an existing account, a sign-in code has been sent. Check your inbox and spam folder.</p>
        <div className="space-y-2">
          <Label htmlFor="portal-verification-code">Verification code</Label>
          <Input id="portal-verification-code" inputMode="numeric" autoComplete="one-time-code" value={code} onChange={(event) => setCode(event.target.value)} maxLength={10} required disabled={busy} className="bg-background text-foreground" />
        </div>
      </>}
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      <Button type="submit" disabled={busy} className="w-full">{busy ? (sent ? "Verifying…" : "Sending code…") : (sent ? "Verify & open portal" : "Send sign-in code")}</Button>
      {sent && <div className="flex flex-wrap gap-2">
        <Button type="button" variant="outline" disabled={busy || cooldown > 0} onClick={() => void sendCode()}>{cooldown ? `Resend in ${cooldown}s` : "Resend code"}</Button>
        <Button type="button" variant="ghost" disabled={busy} onClick={() => { setSent(false); setCode(""); setError(""); }}>Change email</Button>
      </div>}
      <Button type="button" variant="outline" className="w-full" disabled={busy} onClick={onPassword}>Sign in with password instead</Button>
    </form>
  );
}