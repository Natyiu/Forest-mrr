import { Suspense } from "react";
import Link from "next/link";
import { Sprout, Table2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { GraphDashboard } from "@/components/revenue/graph-dashboard";
import { revenueGraphs } from "@/lib/revenue/series";
import { StartupSwitcher } from "@/components/startups/startup-switcher";
import { requireSession } from "@/lib/session";
import { pageEnabled } from "@/lib/nav-features";
import { resolveScope } from "@/lib/startups";

/**
 * **The imported data, as graphs.**
 *
 * A third view of one book: `/dashboard` draws it as a garden, `/dashboard/revenue`
 * lists every field the keys can reach, and this draws the shapes — MRR over time,
 * logo movement, plan mix, geography, cohort retention.
 *
 * Same structure as the revenue page, for the same reason: the series come from a
 * live sweep of somebody's payment providers, so the shell renders immediately and
 * the charts stream into a `Suspense` boundary behind it rather than holding the
 * whole document until the slowest provider answers.
 */
export const dynamic = "force-dynamic";

export default async function RevenueGraphPage() {
  const session = await requireSession();
  const { startups, activeId } = await resolveScope(session.user.id);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-ink-faint">
                Graphs
              </p>
              <h1 className="mt-1 text-[32px] font-extrabold leading-none tracking-[-0.03em] text-ink">
                Graphs
              </h1>
            </div>
            <StartupSwitcher startups={startups} activeId={activeId} />
          </div>
          <p className="mt-1.5 text-[12.5px] text-ink-soft">
            Your imported revenue, drawn — the same book the garden is planted from.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {pageEnabled("revenue") && (
            <Button asChild size="sm" variant="outline" className="h-8 text-xs">
              <Link href="/dashboard/revenue">
                <Table2 className="size-3.5" />
                Imported data
              </Link>
            </Button>
          )}
          <Button asChild size="sm" variant="outline" className="h-8 text-xs">
            <Link href="/dashboard">
              <Sprout className="size-3.5" />
              The garden
            </Link>
          </Button>
        </div>
      </div>

      <Suspense fallback={<GraphSkeleton />}>
        <Series />
      </Suspense>
    </div>
  );
}

async function Series() {
  const session = await requireSession();
  const { scope } = await resolveScope(session.user.id);
  const result = await revenueGraphs(session.user.id, scope);

  return <GraphDashboard result={result} />;
}

/** The shape of what is coming, so its arrival is not a jolt. */
function GraphSkeleton() {
  return (
    <div className="space-y-5" aria-busy>
      <p className="text-[11px] text-muted-foreground">
        Reading your connected providers and rebuilding the monthly history…
      </p>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
        {Array.from({ length: 6 }, (_, index) => (
          <div key={index} className="rounded-xl border border-border bg-card p-3 shadow-elev-1">
            <Skeleton className="h-2.5 w-14" />
            <Skeleton className="mt-2 h-5 w-20" />
            <Skeleton className="mt-2 h-2 w-16" />
          </div>
        ))}
      </div>

      {[0, 1].map((row) => (
        <div key={row} className="grid gap-3 lg:grid-cols-2">
          {[0, 1].map((index) => (
            <div key={index} className="rounded-xl border border-border bg-card p-4 shadow-elev-1">
              <Skeleton className="h-3 w-44" />
              <Skeleton className="mt-2 h-2 w-64" />
              <Skeleton className="mt-4 h-40 w-full" />
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
