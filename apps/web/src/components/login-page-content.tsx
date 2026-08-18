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
        <h1 className="text-[26px] font-bold leading-[1.1] tracking-[-0.03em]">Welcome back</h1>
        <p className="mt-1.5 text-[13px] text-muted-foreground">
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
        <p className="mt-6 text-center text-[13px] text-muted-foreground">
          No account?{" "}
          <Link href="/signup" className="font-medium text-fl-green hover:underline">
            Sign up
          </Link>
        </p>
      ) : (
        <p className="mt-6 text-center text-[13px] text-muted-foreground">
          Registration is currently closed.
        </p>
      )}
    </div>
  );
}
