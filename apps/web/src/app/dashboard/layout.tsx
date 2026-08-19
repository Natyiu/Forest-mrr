import { auth } from "@Batman/auth";
import prisma from "@Batman/db";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { ALL_STARTUPS, resolveScope } from "@/lib/startups";

import { DashboardShell } from "./dashboard-shell";

export default async function DashboardLayout({
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

  let settings = await prisma.appSettings.findUnique({
    where: { id: "default" },
  });
  if (!settings) {
    settings = await prisma.appSettings.create({
      data: { id: "default" },
    });
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { emailVerified: true },
  });

  if (
    settings.maintenanceMode &&
    (session.user.role as string) !== "admin"
  ) {
    redirect("/maintenance" as never);
  }

  if (
    settings.emailVerificationEnabled &&
    user &&
    !user.emailVerified
  ) {
    redirect("/verify-email" as never);
  }

  const [unreadCount, scope] = await Promise.all([
    prisma.notificationRecipient.count({
      where: { userId: session.user.id, read: false },
    }),
    // The sidebar names the business every page below is about, so it is resolved
    // here — once per navigation — rather than fetched by the sidebar after paint.
    resolveScope(session.user.id),
  ]);

  return (
    <DashboardShell
      session={session}
      unreadNotifications={unreadCount}
      organizationsEnabled={settings.organizationsEnabled}
      startups={scope.startups}
      activeId={scope.activeId === ALL_STARTUPS ? "all" : scope.activeId}
    >
      {children}
    </DashboardShell>
  );
}
