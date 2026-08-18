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
        <p className="mt-1.5 text-[13px] text-muted-foreground">
          We sent a password reset link to <strong className="text-foreground">{email}</strong>.
        </p>
        <Link href="/login" className="inline-block mt-5">
          <Button variant="ghost" size="sm" className="h-8 gap-1.5 text-[13px] text-fl-green hover:text-fl-green">
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
        <h1 className="text-[26px] font-bold leading-[1.1] tracking-[-0.03em]">Reset password</h1>
        <p className="mt-1.5 text-[13px] text-muted-foreground">
          Enter your email and we&apos;ll send you a reset link
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="email" className="text-[13px]">
            Email
          </Label>
          <Input
            id="email"
            type="email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="h-11 rounded-xl text-[14px]"
          />
        </div>
        <Button
          type="submit"
          className="h-12 w-full rounded-xl bg-fl-green text-[15px] font-medium text-white shadow-lg shadow-green-600/20 hover:bg-fl-green/90"
          disabled={sending || !email.trim()}
        >
          {sending ? "Sending..." : "Send Reset Link"}
        </Button>
      </form>

      <div className="mt-5 text-center">
        <Link
          href="/login"
          className="inline-flex items-center gap-1 text-[13px] font-medium text-fl-green transition-colors hover:underline"
        >
          <ArrowLeft className="h-3 w-3" />
          Back to login
        </Link>
      </div>
    </div>
  );
}
