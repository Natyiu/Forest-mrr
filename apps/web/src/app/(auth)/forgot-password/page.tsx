"use client";

import { useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { ArrowLeft, Mail } from "lucide-react";

import { authClient } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;

    setSending(true);
    try {
      await authClient.requestPasswordReset({
        email,
        redirectTo: "/reset-password",
      });
      setSent(true);
      toast.success("Reset link sent — check your email");
    } catch {
      toast.error("Failed to send reset link");
    } finally {
      setSending(false);
    }
  }

  if (sent) {
    return (
      <div className="text-center py-4">
        <div className="h-9 w-9 mx-auto bg-muted/40 border border-border/40 flex items-center justify-center mb-4 rounded-xl">
          <Mail className="h-3.5 w-3.5 text-foreground/60" />
        </div>
        <h2 className="text-sm font-semibold tracking-tight">Check your email</h2>
        <p className="text-[11px] text-muted-foreground mt-1">
          We sent a password reset link to <strong className="text-foreground">{email}</strong>.
        </p>
        <Link href="/login" className="inline-block mt-5">
          <Button variant="ghost" size="sm" className="text-[11px] h-7 gap-1.5">
            <ArrowLeft className="h-3 w-3" />
            Back to login
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-lg font-semibold tracking-tight">Reset password</h1>
        <p className="text-xs text-muted-foreground mt-0.5">
          Enter your email and we&apos;ll send you a reset link
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="email" className="text-[11px]">
            Email
          </Label>
          <Input
            id="email"
            type="email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="h-8 text-xs"
          />
        </div>
        <Button
          type="submit"
          className="w-full h-8 text-xs bg-primary text-primary-foreground hover:bg-primary/90"
          disabled={sending || !email.trim()}
        >
          {sending ? "Sending..." : "Send Reset Link"}
        </Button>
      </form>

      <div className="mt-5 text-center">
        <Link
          href="/login"
          className="text-[11px] text-muted-foreground hover:text-foreground inline-flex items-center gap-1 transition-colors"
        >
          <ArrowLeft className="h-3 w-3" />
          Back to login
        </Link>
      </div>
    </div>
  );
}
