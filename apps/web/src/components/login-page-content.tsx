"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { SignInForm } from "@/components/sign-in-form";

export function LoginPageContent({
  signupsEnabled,
}: {
  signupsEnabled: boolean;
}) {
  const searchParams = useSearchParams();
  const message = searchParams.get("message");

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-lg font-semibold tracking-tight">Welcome back</h1>
        <p className="text-xs text-muted-foreground mt-0.5">
          Enter your credentials to continue
        </p>
        {message === "signups-disabled" && (
          <p className="text-xs text-warn mt-2">
            Registration is currently closed.
          </p>
        )}
      </div>

      <SignInForm />

      {signupsEnabled ? (
        <p className="mt-5 text-center text-[11px] text-muted-foreground">
          No account?{" "}
          <Link href="/signup" className="text-foreground hover:underline font-medium">
            Sign up
          </Link>
        </p>
      ) : (
        <p className="mt-5 text-center text-[11px] text-muted-foreground">
          Registration is currently closed.
        </p>
      )}
    </div>
  );
}
