import { auth } from "@Batman/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { getSubscriptionStatus } from "@/lib/subscription";

export default async function ProLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session?.user) {
    redirect("/login");
  }

  try {
    const { isSubscribed } = await getSubscriptionStatus(session.user.id);
    if (!isSubscribed) {
      redirect("/subscribe" as never);
    }
  } catch {
    redirect("/subscribe" as never);
  }

  return <>{children}</>;
}
