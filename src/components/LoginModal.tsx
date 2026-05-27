import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { z } from "zod";
import type { AuthError } from "@supabase/supabase-js";

// Validation schema
const loginSchema = z.object({
  email: z.string().trim().email("Invalid email format").max(255, "Email must be less than 255 characters"),
  password: z.string().min(8, "Password must be at least 8 characters").max(100, "Password must be less than 100 characters"),
});

// Map Supabase errors to user-friendly messages
const getErrorMessage = (error: AuthError): string => {
  const message = error.message.toLowerCase();
  
  if (message.includes("invalid login credentials") || message.includes("invalid password")) {
    return "Invalid email or password. Please try again.";
  }
  if (message.includes("email not confirmed")) {
    return "Please verify your email address before logging in.";
  }
  if (message.includes("too many requests")) {
    return "Too many login attempts. Please try again later.";
  }
  if (message.includes("user not found")) {
    return "Invalid email or password. Please try again.";
  }
  
  return "Login failed. Please check your credentials and try again.";
};

interface LoginModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultEmail?: string;
}

export function LoginModal({ open, onOpenChange, defaultEmail }: LoginModalProps) {
  const [email, setEmail] = useState(defaultEmail ?? "");
  const [password, setPassword] = useState("");
  useEffect(() => {
    if (defaultEmail) setEmail(defaultEmail);
  }, [defaultEmail, open]);
  const [isLoading, setIsLoading] = useState(false);
  const [showForgot, setShowForgot] = useState(false);
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate inputs
    const validation = loginSchema.safeParse({ 
      email: email.trim(), 
      password 
    });
    
    if (!validation.success) {
      toast({
        title: "Validation Error",
        description: validation.error.errors[0].message,
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: validation.data.email,
        password: validation.data.password,
      });

      if (error) {
        toast({
          title: "Login Failed",
          description: getErrorMessage(error),
          variant: "destructive",
        });
      } else if (data.user) {
        toast({
          title: "Login Successful",
          description: "Welcome to EnergyForward!",
        });
        onOpenChange(false);
        setEmail("");
        setPassword("");
      }
    } catch (error) {
      toast({
        title: "Login Failed",
        description: "An unexpected error occurred. Please try again.",
        variant: "destructive",
      });
    }
    
    setIsLoading(false);
  };

  const handleForgot = async () => {
    if (!email) {
      toast({ title: "Enter your email first", variant: "destructive" });
      return;
    }
    setIsLoading(true);
    const { error } = await supabase.functions.invoke("send-investor-email", {
      body: { type: "reset", email: email.trim() },
    });
    setIsLoading(false);
    if (error) {
      toast({ title: "Could not send reset email", description: error.message, variant: "destructive" });
    } else {
      toast({
        title: "Check your inbox",
        description: "If an account exists for this email, a password reset link has been sent.",
      });
      setShowForgot(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="sm:max-w-md border-0 p-0 overflow-hidden"
        style={{
          background: "rgba(14, 54, 59, 0.96)",
          color: "#EEEAE2",
          border: "1px solid rgba(238,234,226,0.12)",
          borderRadius: 18,
          backdropFilter: "blur(18px)",
          fontFamily: '"General Sans", system-ui, sans-serif',
        }}
      >
        <div style={{ padding: "36px 32px 28px" }}>
          <DialogHeader>
            <DialogTitle
              className="text-center"
              style={{
                fontFamily: '"Cabinet Grotesk", sans-serif',
                fontWeight: 700,
                fontSize: 28,
                color: "#EEEAE2",
                textTransform: "lowercase",
                letterSpacing: "-0.02em",
              }}
            >
              login to energyforward<span style={{ color: "#E8B14A" }}>.</span>
            </DialogTitle>
            <p
              className="text-center mt-2"
              style={{
                fontFamily: '"JetBrains Mono", ui-monospace, monospace',
                fontSize: 11,
                letterSpacing: "0.18em",
                textTransform: "uppercase",
                color: "rgba(238,234,226,0.6)",
              }}
            >
              access restricted
            </p>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4 mt-6">
            <div className="space-y-2">
              <Label
                htmlFor="email"
                style={{
                  fontFamily: '"JetBrains Mono", ui-monospace, monospace',
                  fontSize: 10,
                  letterSpacing: "0.22em",
                  textTransform: "uppercase",
                  color: "rgba(238,234,226,0.55)",
                }}
              >
                Email
              </Label>
              <Input
                id="email"
                type="email"
                placeholder="you@company.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                style={{
                  background: "rgba(10,42,46,0.55)",
                  border: "1px solid rgba(238,234,226,0.18)",
                  color: "#EEEAE2",
                  borderRadius: 10,
                  height: 46,
                }}
              />
            </div>

            <div className="space-y-2">
              <Label
                htmlFor="password"
                style={{
                  fontFamily: '"JetBrains Mono", ui-monospace, monospace',
                  fontSize: 10,
                  letterSpacing: "0.22em",
                  textTransform: "uppercase",
                  color: "rgba(238,234,226,0.55)",
                }}
              >
                Password
              </Label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                style={{
                  background: "rgba(10,42,46,0.55)",
                  border: "1px solid rgba(238,234,226,0.18)",
                  color: "#EEEAE2",
                  borderRadius: 10,
                  height: 46,
                }}
              />
            </div>

            <div className="text-right">
              <button
                type="button"
                onClick={handleForgot}
                disabled={isLoading}
                style={{
                  fontFamily: '"JetBrains Mono", ui-monospace, monospace',
                  fontSize: 11,
                  letterSpacing: "0.14em",
                  textTransform: "uppercase",
                  color: "#E8B14A",
                  background: "transparent",
                  border: "none",
                  cursor: "pointer",
                }}
              >
                forgot password?
              </button>
            </div>

            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={() => onOpenChange(false)}
                style={{
                  flex: 1,
                  padding: "13px 20px",
                  background: "transparent",
                  border: "1px solid rgba(238,234,226,0.25)",
                  color: "#EEEAE2",
                  borderRadius: 999,
                  fontFamily: '"Cabinet Grotesk", sans-serif',
                  fontWeight: 600,
                  fontSize: 14,
                  textTransform: "lowercase",
                  cursor: "pointer",
                }}
              >
                cancel
              </button>
              <button
                type="submit"
                disabled={isLoading}
                style={{
                  flex: 1,
                  padding: "13px 20px",
                  background: "#E8B14A",
                  border: "none",
                  color: "#0A2A2E",
                  borderRadius: 999,
                  fontFamily: '"Cabinet Grotesk", sans-serif',
                  fontWeight: 600,
                  fontSize: 14,
                  textTransform: "lowercase",
                  cursor: isLoading ? "wait" : "pointer",
                  opacity: isLoading ? 0.7 : 1,
                }}
              >
                {isLoading ? "verifying…" : "enter →"}
              </button>
            </div>

            <div style={{ textAlign: "center", paddingTop: 8 }}>
              <a
                href="/?public=1"
                style={{
                  fontFamily: '"JetBrains Mono", ui-monospace, monospace',
                  fontSize: 10,
                  letterSpacing: "0.18em",
                  textTransform: "uppercase",
                  color: "rgba(238,234,226,0.5)",
                  textDecoration: "none",
                }}
              >
                ← back to homepage
              </a>
            </div>
          </form>
        </div>
      </DialogContent>
    </Dialog>
  );
}
