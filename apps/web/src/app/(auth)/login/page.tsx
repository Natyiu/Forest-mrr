import { Suspense } from "react";
import { getAuthConfig } from "@/lib/actions/user";
import { LoginPageContent } from "@/components/login-page-content";

export default async function LoginPage() {
  const authConfig = await getAuthConfig();

  return (
    <Suspense fallback={<div className="h-8" />}>
      <LoginPageContent signupsEnabled={authConfig.signupsEnabled} />
    </Suspense>
  );
}
