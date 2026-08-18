"use client";

import { useMemo } from "react";
import Link from "next/link";
import { AlertTriangle, Plus, PlugZap, Table2, TrendingDown, TrendingUp } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  CohortGrid,
  ColumnChart,
  LineChart,
  MovementChart,
  RowChart,
  StatusBar,
  type Datum,
} from "@/components/revenue/revenue-charts";
import type { RevenueGraphResult, RevenueGraphSeries } from "@/lib/revenue/series";
import { pageEnabled } from "@/lib/nav-features";
import { cn } from "@/lib/utils";

/**
 * **The imported book, as graphs.**
 *
 * Every chart here answers one question, and the form follows the question rather
 * than the other way round:
 *
 *   MRR and ARR over time        a line — a level, moving
 *   Active subscriptions         its own line, never a second axis on the first
 *   Gained vs lost logos         diverging columns — polarity, above and below zero
 *   Payment volume by month      columns — discrete periods, one measure
 *   MRR by plan / by country     rows — magnitude by identity, directly labelled
 *   Subscription states          one labelled bar — reserved status colours
 *   Cohort retention             a single-hue heatmap with the numbers in the cells
 *
 * **There is no dual-axis chart on this page.** MRR and subscription count are
 * different scales, so they are two charts stacked, which is the honest way to let
 * a reader compare their shapes.
 *
 * Everything is drawn from the same book the forest is: `revenueGraphSeries`
 * derives from `harvestToForest`, so a figure here and the plot at `/dashboard`
 * cannot disagree.
 */

const money = (minor: number, currency: string) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency || "USD",
    maximumFractionDigits: Math.abs(minor) >= 100_000 ? 0 : 2,
  }).format(minor / 100);

const count = (value: number) => new Intl.NumberFormat("en-US").format(value);
const percent = (ratio: number) => `${(ratio * 100).toFixed(1)}%`;

function Stat({
  label,
  value,
  note,
  delta,
}: {
  label: string;
  value: string;
  note?: string;
  delta?: number | null;
}) {
  const rising = delta !== null && delta !== undefined && delta >= 0;
  const DeltaIcon = rising ? TrendingUp : TrendingDown;

  return (
    <div className="rounded-xl border border-border bg-card p-3 shadow-elev-1">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70">
        {label}
      </p>
      <p className="mt-1 font-mono text-lg font-semibold leading-none tabular-nums">{value}</p>
      <div className="mt-1 flex items-center gap-1 text-[10px]">
        {delta !== null && delta !== undefined && (
          <span
            className={cn(
              "flex items-center gap-0.5 font-medium",
              rising ? "text-success" : "text-destructive",
            )}
          >
            <DeltaIcon className="size-2.5" />
            {percent(Math.abs(delta))}
          </span>
        )}
        {note && <span className="text-muted-foreground">{note}</span>}
      </div>
    </div>
  );
}

/**
 * **Three outcomes, three different things to say.**
 *
 * "No graphs" was one empty state saying *connect a payment provider* — which is
 * exactly the wrong sentence for the case that actually happens: a provider is
 * connected, its key works, and the account has no subscriptions in it yet. That
 * reads as a broken integration when nothing is broken at all. So the empty case
 * now shows what each connected provider said, including the endpoints its key was
 * not allowed to read, and points at the page where the rest of that detail lives.
 *
 * Each case is its own component because the charts use hooks: a single component
 * returning early before them would call a different number of hooks depending on
 * whether anything is connected, which is the one thing React does not allow.
 */
export function GraphDashboard({ result }: { result: RevenueGraphResult }) {
  if (result.kind === "series") return <Graphs series={result.series} />;
  if (result.kind === "empty") return <ConnectedButEmpty result={result} />;
  return <NothingConnected />;
}

function ConnectedButEmpty({
  result,
}: {
  result: Extract<RevenueGraphResult, { kind: "empty" }>;
}) {
  const names = result.providers.map((provider) => provider.name).join(", ");

  return (
    <div className="space-y-3">
      <div className="rounded-xl border border-border bg-card p-6 shadow-elev-1">
        <div className="flex items-start gap-2">
          <PlugZap className="mt-0.5 size-4 shrink-0 text-success" />
          <div>
            <p className="text-xs font-medium">
              {names} {result.providers.length === 1 ? "is" : "are"} connected — there are no
              subscriptions to graph yet
            </p>
            <p className="mt-1 max-w-prose text-[11px] text-muted-foreground">
              The key works and the subscription endpoint answered; it returned nothing,
              which is what a brand-new account looks like. The first subscription that
              exists here will draw itself: MRR over time, logo movement, plan mix,
              geography and cohort retention all come from that list.
            </p>
          </div>
        </div>

        <ul className="mt-4 space-y-2">
          {result.providers.map((provider) => (
            <li key={provider.provider} className="rounded-lg bg-muted/40 p-2.5">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[11px] font-semibold">
                  {provider.accountLabel ?? provider.name}
                </span>
                <Badge variant={provider.subscriptions > 0 ? "success" : "outline"}>
                  {count(provider.subscriptions)} subscription
                  {provider.subscriptions === 1 ? "" : "s"}
                </Badge>
                <span className="text-[10px] text-muted-foreground">
                  {provider.answered} endpoint{provider.answered === 1 ? "" : "s"} answered
                </span>
              </div>

              {provider.fatal && (
                <p className="mt-1 text-[11px] text-destructive">{provider.fatal}</p>
              )}

              {provider.refused.length > 0 && (
                <p className="mt-1 text-[10px] text-muted-foreground">
                  Not readable with this key:{" "}
                  {provider.refused
                    .map((entry) => `${entry.label} (${entry.note.toLowerCase()})`)
                    .join(", ")}
                  .
                </p>
              )}
            </li>
          ))}
        </ul>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          {pageEnabled("revenue") && (
            <Button asChild size="sm" variant="outline" className="h-8 text-xs">
              <Link href="/dashboard/revenue">
                <Table2 className="size-3.5" />
                See every field, endpoint by endpoint
              </Link>
            </Button>
          )}
          <Button asChild size="sm" variant="ghost" className="h-8 text-xs">
            <Link href="/dashboard/startups">
              <Plus className="size-3.5" />
              Connect another provider
            </Link>
          </Button>
        </div>
      </div>

      <p className="text-[11px] text-muted-foreground">
        The garden at <span className="font-medium">/dashboard</span> is showing the same
        thing: an unplanted plot. Nothing anywhere in this app invents a business to fill
        the space.
      </p>
    </div>
  );
}

function NothingConnected() {
  return (
    <div className="rounded-xl border border-border bg-card p-8 text-center shadow-elev-1">
      <p className="text-xs font-medium">Nothing to graph yet</p>
      <p className="mx-auto mt-1 max-w-sm text-[11px] text-muted-foreground">
        Connect a payment provider and this page fills with your MRR over time, logo
        movement, plan mix, geography and cohort retention.
      </p>
      <Button asChild size="sm" className="mt-3 h-8 text-xs">
        <Link href="/dashboard/startups">
          <Plus className="size-3.5" />
          Connect a provider
        </Link>
      </Button>
    </div>
  );
}

function Graphs({ series }: { series: RevenueGraphSeries }) {
  const currency = series.currency;
  const money0 = (value: number) => money(value, currency);

  const mrr: Datum[] = useMemo(
    () =>
      series.months.map((month) => ({
        label: month.label,
        detail: `${count(month.active)} active`,
        value: month.mrrMinor,
      })),
    [series.months],
  );

  const active: Datum[] = useMemo(
    () =>
      series.months.map((month) => ({
        label: month.label,
        detail: month.atRisk ? `${count(month.atRisk)} at risk` : undefined,
        value: month.active,
      })),
    [series.months],
  );

  const arpa: Datum[] = useMemo(
    () =>
      series.months
        .filter((month) => month.arpaMinor !== null)
        .map((month) => ({ label: month.label, value: month.arpaMinor! })),
    [series.months],
  );

  const volume: Datum[] = useMemo(
    () =>
      series.months.map((month) => ({
        label: month.label,
        detail: `${count(month.payments)} payment${month.payments === 1 ? "" : "s"}`,
        value: month.volumeMinor,
      })),
    [series.months],
  );

  const movement = useMemo(
    () =>
      series.months.map((month) => ({
        label: month.label,
        gained: month.started,
        lost: month.churned,
      })),
    [series.months],
  );

  const plans: Datum[] = series.planMix.map((entry) => ({
    label: entry.plan,
    detail: `${count(entry.count)} subs`,
    value: entry.mrrMinor,
  }));

  const countries: Datum[] = series.countryMix.slice(0, 10).map((entry) => ({
    label: `${entry.flag ?? ""} ${entry.label}`.trim(),
    detail: `${count(entry.count)} subs`,
    value: entry.mrrMinor,
  }));

  const customers: Datum[] = series.topCustomers.map((customer) => ({
    label: customer.name,
    detail: customer.plan,
    value: customer.mrrMinor,
  }));

  const statuses = series.statusMix.map((entry) => ({
    label: entry.label,
    count: entry.count,
    tone:
      entry.status === "active"
        ? ("good" as const)
        : entry.status === "past_due"
          ? ("warn" as const)
          : ("bad" as const),
  }));

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-[11px] text-muted-foreground">
          {series.providers.join(" · ")} · {count(series.totals.subscriptions)} subscriptions ·{" "}
          {series.months.length} month{series.months.length === 1 ? "" : "s"} of history ·
          fetched {series.fetchedAt.slice(0, 16).replace("T", " ")} UTC
        </p>
        <Badge variant="outline">
          <Table2 className="size-3" />
          Every chart has a table view
        </Badge>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
        <Stat
          label="MRR"
          value={money0(series.totals.mrrMinor)}
          delta={series.totals.momGrowth}
          note="vs last month"
        />
        <Stat label="ARR" value={money0(series.totals.arrMinor)} note="MRR × 12" />
        <Stat label="Active" value={count(series.totals.active)} />
        <Stat
          label="ARPA"
          value={series.totals.arpaMinor === null ? "—" : money0(series.totals.arpaMinor)}
        />
        <Stat
          label="Logo churn"
          value={series.totals.logoChurn === null ? "—" : percent(series.totals.logoChurn)}
          note="this month"
        />
        <Stat label="30-day volume" value={money0(series.totals.volume30dMinor)} />
      </div>

      {series.mixedCurrencies.length > 0 && (
        <p className="flex items-start gap-1.5 rounded-xl bg-warn-soft p-2.5 text-[11px] text-warn">
          <AlertTriangle className="mt-px size-3.5 shrink-0" />
          This book spans {series.mixedCurrencies.length + 1} currencies (
          {[currency, ...series.mixedCurrencies].join(", ")}) and these charts add them
          together. Treat the money figures as approximate until one currency dominates.
        </p>
      )}

      {/* Two scales, two charts. Never two axes. */}
      <div className="grid gap-3 lg:grid-cols-2">
        <LineChart
          title="MRR over time"
          caption="Monthly recurring revenue at each month's close, from your own signup and cancellation dates."
          data={mrr}
          format={money0}
        />
        <LineChart
          title="Active subscriptions over time"
          caption="Counted the same way, on its own scale — a second axis over the chart on the left would invite a comparison neither number supports."
          data={active}
          format={count}
        />
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        <MovementChart
          title="Subscriptions gained and lost"
          caption="Signups above the line, cancellations below it, by the month they happened."
          data={movement}
          gainedLabel="New"
          lostLabel="Churned"
        />
        <ColumnChart
          title="Payment volume by month"
          caption="From the payments your keys returned — the most recent pages only, so early months may be short."
          data={volume}
          format={money0}
          emptyNote="No dated payments came back from these keys."
        />
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        <RowChart
          title="MRR by plan"
          caption="Active subscriptions, at the price they actually pay."
          data={plans}
          format={money0}
        />
        <RowChart
          title="Top 10 customers by MRR"
          caption="Concentration: how much of the run rate sits with a few names."
          data={customers}
          format={money0}
          emptyNote="No named customers came back from these keys."
        />
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        <StatusBar
          title="Subscription states"
          caption="Everything on the plot right now, including recent cancellations."
          segments={statuses}
        />
        <RowChart
          title="MRR by country"
          caption={
            series.countryMix.length > 10
              ? `Top 10 of ${series.countryMix.length} countries.`
              : "Where the customers with a country on file are."
          }
          data={countries}
          format={money0}
          emptyNote="None of these providers returned a country for their customers."
        />
      </div>

      <LineChart
        title="ARPA over time"
        caption="Average revenue per active subscription, month by month."
        data={arpa}
        format={money0}
      />

      <CohortGrid
        title="Logo retention by signup cohort"
        caption="Share of each month's signups still active later. Logos, not revenue — revenue retention needs the plan history providers do not hand over. Blank cells have not happened yet."
        rows={series.cohorts}
      />
    </div>
  );
}
