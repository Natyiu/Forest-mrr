"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { authClient } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";

export function VerifyEmailForm({ email }: { email: string }) {
  const [loading, setLoading] = useState(false);

  async function handleResend() {
    setLoading(true);
    try {
      await authClient.sendVerificationEmail({
        email,
        callbackURL: "/onboarding",
      });
      toast.success("Verification email sent. Check your inbox.");
    } catch {
      toast.error("Failed to send. Try again later.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={handleResend}
      disabled={loading}
      className="mt-6"
    >
      {loading ? (
        <>
          <Loader2 className="h-3 w-3 animate-spin mr-1.5" />
          Sending...
        </>
      ) : (
        "Resend verification email"
      )}
    </Button>
  );
}
