import { auth } from "@Batman/auth";
import prisma from "@Batman/db";
import { headers } from "next/headers";

import { ALL_STARTUPS, resolveScope } from "@/lib/startups";

import { GardenView } from "./garden-view";

/**
 * The dashboard is the garden, full screen.
 *
 * It replaced `DashboardHome` — the card grid of links — which is still
 * exported from `./dashboard-shell` if it is ever wanted back. Auth, email
 * verification, onboarding and maintenance are all settled by
 * `dashboard/layout.tsx` before this renders, so the session read below cannot
 * come back empty; it is here for the *contents* of the account menu, not as a
 * second gate.
 *
 * The shell draws no header on this route, so these are the only handles the
 * reader has on their own account — which is why they are fetched here rather
 * than left to a client fetch that would pop in a second late.
 *
 * The book of business it draws comes from `/api/garden` (+ `/api/garden/history`,
 * fetched together), scoped to the startup this browser has selected. Which one
 * that is has to be resolved *here* rather than fetched by the switcher, so the
 * toolbar opens already naming the right business instead of saying "loading" over
 * a plot that is already drawn.
 */
export default async function DashboardPage() {
  const session = await auth.api.getSession({ headers: await headers() });

  const unreadNotifications = session?.user
    ? await prisma.notificationRecipient.count({
        where: { userId: session.user.id, read: false },
      })
    : 0;

  const { active, activeId } = session?.user
    ? await resolveScope(session.user.id)
    : { active: null, activeId: null };

  return (
    <GardenView
      startup={{
        name: active?.name ?? null,
        emoji: active?.emoji ?? null,
        image: active?.image ?? null,
        isAll: activeId === ALL_STARTUPS,
      }}
      account={{
        name: session?.user?.name ?? "",
        email: session?.user?.email ?? "",
        image: session?.user?.image,
        isAdmin: (session?.user?.role as string) === "admin",
        unreadNotifications,
      }}
    />
  );
}
