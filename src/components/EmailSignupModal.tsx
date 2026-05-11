import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { z } from "zod";

// Validation schema
const signupSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(100, "Name must be less than 100 characters"),
  email: z.string().trim().email("Invalid email format").max(255, "Email must be less than 255 characters"),
});

interface EmailSignupModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function EmailSignupModal({ open, onOpenChange }: EmailSignupModalProps) {
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [alreadyExists, setAlreadyExists] = useState(false);
  const [resetSending, setResetSending] = useState(false);
  const [resetSent, setResetSent] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (alreadyExists && resetSent) {
      const t = setTimeout(() => {
        onOpenChange(false);
        setAlreadyExists(false);
        setResetSent(false);
        setEmail("");
        setName("");
      }, 4000);
      return () => clearTimeout(t);
    }
  }, [alreadyExists, resetSent, onOpenChange]);

  const handleSendReset = async () => {
    setResetSending(true);
    const { error } = await supabase.functions.invoke("send-investor-email", {
      body: { type: "reset", email: email.trim() },
    });
    setResetSending(false);
    if (error) {
      toast({
        title: "Could not send reset link",
        description: error.message,
        variant: "destructive",
      });
    } else {
      setResetSent(true);
      toast({
        title: "Check your inbox",
        description: "We've sent a password reset link to your email.",
      });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAlreadyExists(false);
    setResetSent(false);
    
    // Validate inputs
    const validation = signupSchema.safeParse({ 
      name: name.trim(), 
      email: email.trim(),
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
      // First, check if this email already has an active investor account.
      try {
        const { data: check } = await supabase.functions.invoke("send-investor-email", {
          body: { type: "check_account", email: validation.data.email },
        });
        if (check?.exists) {
          setAlreadyExists(true);
          setIsLoading(false);
          // Auto-send the reset link for convenience.
          await handleSendReset();
          return;
        }
      } catch (checkErr) {
        console.error("Account check failed:", checkErr);
        // Fall through to normal signup flow.
      }

      const { error } = await supabase
        .from('email_signups')
        .insert([{
          name: validation.data.name,
          email: validation.data.email,
        }]);

      if (error) {
        // Handle duplicate email error gracefully
        if (error.code === '23505') {
          setAlreadyExists(true);
          // Auto-send reset link as a courtesy.
          handleSendReset();
        } else {
          toast({
            title: "Signup Failed",
            description: "Unable to sign up at this time. Please try again later.",
            variant: "destructive",
          });
        }
      } else {
        // Send notification email
        try {
          await supabase.functions.invoke('notify-signup', {
            body: {
              name: validation.data.name,
              email: validation.data.email,
            },
          });
        } catch (notifyError) {
          console.error("Failed to send notification:", notifyError);
          // Don't fail the signup if notification fails
        }

        toast({
          title: "Successfully Signed Up!",
          description: "You'll be among the first to know about our energy innovations.",
        });
        onOpenChange(false);
        setEmail("");
        setName("");
      }
    } catch (error) {
      toast({
        title: "Signup Failed",
        description: "An unexpected error occurred. Please try again.",
        variant: "destructive",
      });
    }
    
    setIsLoading(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md shadow-energy">
        <DialogHeader>
          <DialogTitle className="text-center text-xl">Stay Connected</DialogTitle>
          <p className="text-sm text-muted-foreground text-center">
            Be among the first to learn about our progress
          </p>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          {alreadyExists && (
            <div className="rounded-md border border-primary/30 bg-primary/5 p-4 space-y-3">
              <div>
                <p className="text-sm font-semibold text-foreground">
                  This email is already registered
                </p>
                <p className="text-sm text-muted-foreground mt-1">
                  An account with <strong>{email.trim()}</strong> already exists. You can reset your password to regain access.
                </p>
              </div>
              {resetSent ? (
                <p className="text-sm text-primary font-medium">
                  ✓ Reset link sent. Please check your inbox.
                </p>
              ) : (
                <Button
                  type="button"
                  variant="energy"
                  size="sm"
                  onClick={handleSendReset}
                  disabled={resetSending}
                  className="w-full"
                >
                  {resetSending ? "Sending reset link..." : "Send password reset link"}
                </Button>
              )}
            </div>
          )}
          <div className="space-y-2">
            <Label htmlFor="name">Full Name</Label>
            <Input
              id="name"
              type="text"
              placeholder="Enter your full name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="signup-email">Email</Label>
            <Input
              id="signup-email"
              type="email"
              placeholder="Enter your email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          
          <div className="flex gap-3 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="hero"
              disabled={isLoading}
              className="flex-1"
            >
              {isLoading ? "Signing up..." : "Sign Up for Updates"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
