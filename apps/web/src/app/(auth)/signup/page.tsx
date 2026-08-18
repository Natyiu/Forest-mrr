import Link from "next/link";
import { redirect } from "next/navigation";
import { getAuthConfig } from "@/lib/actions/user";
import { SignUpForm } from "@/components/sign-up-form";

export default async function SignUpPage() {
  const authConfig = await getAuthConfig();
  if (!authConfig.signupsEnabled) {
    redirect("/login?message=signups-disabled");
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-[26px] font-bold leading-[1.1] tracking-[-0.03em]">Create account</h1>
        <p className="mt-1.5 text-[13px] text-muted-foreground">
          Get started with your free account
        </p>
      </div>

      <SignUpForm />

      <p className="mt-6 text-center text-[13px] text-muted-foreground">
        Already have an account?{" "}
        <Link href="/login" className="font-medium text-fl-green hover:underline">
          Sign in
        </Link>
      </p>
    </div>
  );
}
