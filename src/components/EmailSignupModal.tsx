import { useState } from "react";
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
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate inputs
    const validation = signupSchema.safeParse({ 
      name: name.trim(), 
      email: email.trim() 
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
      const { error } = await supabase
        .from('email_signups')
        .insert([{
          name: validation.data.name,
          email: validation.data.email,
        }]);

      if (error) {
        // Handle duplicate email error gracefully
        if (error.code === '23505') {
          toast({
            title: "Already Signed Up",
            description: "This email is already registered for updates.",
            variant: "destructive",
          });
        } else {
          toast({
            title: "Signup Failed",
            description: "Unable to sign up at this time. Please try again later.",
            variant: "destructive",
          });
        }
      } else {
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
          <div className="space-y-2">
            <Label htmlFor="name">Name</Label>
            <Input
              id="name"
              type="text"
              placeholder="Enter your name"
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
