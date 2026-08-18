"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";

import { authClient } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function ResetPasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [resetting, setResetting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (password !== confirm) {
      toast.error("Passwords don't match");
      return;
    }
    if (password.length < 8) {
      toast.error("Password must be at least 8 characters");
      return;
    }

    setResetting(true);
    try {
      await authClient.resetPassword({ newPassword: password });
      toast.success("Password reset — you can now sign in");
      router.push("/login");
    } catch {
      toast.error("Reset link is invalid or expired");
    } finally {
      setResetting(false);
    }
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-[26px] font-bold leading-[1.1] tracking-[-0.03em]">New password</h1>
        <p className="mt-1.5 text-[13px] text-muted-foreground">
          Choose a new password for your account
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="password" className="text-[13px]">
            New Password
          </Label>
          <Input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Min 8 characters"
            required
            className="h-11 rounded-xl text-[14px]"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="confirm" className="text-[13px]">
            Confirm Password
          </Label>
          <Input
            id="confirm"
            type="password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            placeholder="Repeat password"
            required
            className="h-11 rounded-xl text-[14px]"
          />
        </div>
        <Button
          type="submit"
          className="h-12 w-full rounded-xl bg-fl-green text-[15px] font-medium text-white shadow-lg shadow-green-600/20 hover:bg-fl-green/90"
          disabled={resetting || !password || !confirm}
        >
          {resetting ? "Resetting..." : "Reset Password"}
        </Button>
      </form>

      <div className="mt-5 text-center">
        <Link
          href="/login"
          className="text-[13px] font-medium text-fl-green transition-colors hover:underline"
        >
          Back to login
        </Link>
      </div>
    </div>
  );
}
