import { Suspense } from "react";
import Link from "next/link";
import { LineChart, Settings2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { RevenueDashboard } from "@/components/revenue/revenue-dashboard";
import { harvestRevenue } from "@/lib/revenue/harvest";
import { StartupSwitcher } from "@/components/startups/startup-switcher";
import { requireSession } from "@/lib/session";
import { pageEnabled } from "@/lib/nav-features";
import { resolveScope } from "@/lib/startups";

/**
 * **What the connected keys can actually see.**
 *
 * The read happens here, on the server, where the keys are: `harvestRevenue`
 * opens each sealed credential, asks every provider for every collection its API
 * exposes, and hands the client a plain object. No key, and nothing derived from
 * one, ever crosses to the browser.
 *
 * **The page shell does not wait for it.** That sweep is dozens of HTTP requests
 * to other people's servers and can take several seconds on a cold cache; a page
 * that awaits it before its first byte is a blank screen for the duration, and it
 * makes the whole document's render hostage to whichever provider is slowest
 * today. The heading renders immediately, the data streams into a `Suspense`
 * boundary behind it, and the skeleton is shaped like the thing it is replacing
 * so the layout does not jump when it arrives.
 *
 * It is deliberately not cached by Next. The data is a live read of somebody's
 * payment provider, so the freshness rule belongs to the harvester (one minute,
 * shared per user, bypassable from the Refresh button) rather than to the route.
 */
export const dynamic = "force-dynamic";

export default async function RevenueDataPage() {
  const session = await requireSession();
  const { startups, activeId } = await resolveScope(session.user.id);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-ink-faint">
                Imported data
              </p>
              <h1 className="mt-1 text-[32px] font-extrabold leading-none tracking-[-0.03em] text-ink">
                Revenue data
              </h1>
            </div>
            <StartupSwitcher startups={startups} activeId={activeId} />
          </div>
          <p className="mt-1.5 text-[12.5px] text-ink-soft">
            Every field your read-only keys can reach, from every provider you have
            connected.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* The way through to the charts — while the charts are switched on. This
              page is the ledger, and a ledger is not where you read a trend. */}
          {pageEnabled("graphs") && (
            <Button asChild size="sm" className="h-8 text-xs">
              <Link href="/dashboard/graph">
                <LineChart className="size-3.5" />
                Open graphs
              </Link>
            </Button>
          )}
          <Button asChild size="sm" variant="outline" className="h-8 text-xs">
            <Link href="/dashboard/startups">
              <Settings2 className="size-3.5" />
              Manage startups
            </Link>
          </Button>
        </div>
      </div>

      <Suspense fallback={<HarvestSkeleton />}>
        <Harvest />
      </Suspense>
    </div>
  );
}

async function Harvest() {
  const session = await requireSession();
  const { scope } = await resolveScope(session.user.id);
  const harvest = await harvestRevenue(session.user.id, { scope });

  return <RevenueDashboard harvest={harvest} />;
}

/** The shape of what is coming, so its arrival is not a jolt. */
function HarvestSkeleton() {
  return (
    <div className="space-y-5" aria-busy>
      <p className="text-[11px] text-muted-foreground">
        Asking every connected provider for everything your keys can read…
      </p>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-7">
        {Array.from({ length: 7 }, (_, index) => (
          <div key={index} className="rounded-xl border border-border bg-card p-3 shadow-elev-1">
            <Skeleton className="h-2.5 w-14" />
            <Skeleton className="mt-2 h-5 w-20" />
            <Skeleton className="mt-2 h-2 w-16" />
          </div>
        ))}
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        {[0, 1].map((index) => (
          <div key={index} className="rounded-xl border border-border bg-card p-4 shadow-elev-1">
            <Skeleton className="h-3 w-40" />
            <Skeleton className="mt-2 h-2 w-56" />
            <Skeleton className="mt-4 h-40 w-full" />
          </div>
        ))}
      </div>
    </div>
  );
}
