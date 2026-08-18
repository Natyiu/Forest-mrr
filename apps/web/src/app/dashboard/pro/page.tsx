import { auth } from "@Batman/auth";
import { headers } from "next/headers";

import { getSubscriptionStatus } from "@/lib/subscription";

export default async function ProDashboardPage() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  const { subscription } = await getSubscriptionStatus(session!.user.id);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-base font-semibold tracking-tight">Pro</h1>
        <p className="text-[11px] text-muted-foreground mt-0.5">
          You have an active subscription.
        </p>
      </div>

      {subscription && (
        <div className="border border-border/40 bg-card shadow-elev-1 p-4 rounded-xl">
          <p className="text-xs font-medium">Subscription</p>
          <p className="text-[11px] text-muted-foreground mt-1">
            Status: <span className="capitalize">{subscription.status}</span>
            {subscription.cancelAtPeriodEnd && (
              <span className="ml-1">(ends at period end)</span>
            )}
          </p>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            Current period ends:{" "}
            {subscription.currentPeriodEnd.toLocaleDateString()}
          </p>
        </div>
      )}

      <p className="text-xs text-muted-foreground">
        This is a subscription-protected area. Add your premium content here.
      </p>
    </div>
  );
}
