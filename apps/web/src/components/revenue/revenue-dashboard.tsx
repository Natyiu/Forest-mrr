"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  CheckCircle2,
  ExternalLink,
  Loader2,
  Plus,
  RefreshCw,
  ShieldAlert,
} from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ProviderMark } from "@/components/revenue/provider-mark";
import { ColumnChart, RowChart, type Datum } from "@/components/revenue/revenue-charts";
import { refreshRevenueHarvest } from "@/lib/actions/revenue";
import { REVENUE_PROVIDERS } from "@/lib/revenue/providers";
import type {
  CollectionResult,
  ProviderHarvest,
  RevenueHarvest,
} from "@/lib/revenue/harvest";
import { cn } from "@/lib/utils";

/**
 * **Everything the connected keys can read, on one page.**
 *
 * Three layers, in the order a person asks for them:
 *
 *  1. **The headline** — MRR, ARR, active, at risk, customers, 30-day volume.
 *     Stat tiles rather than charts: a single number's job is to be read, and a
 *     chart of one number is decoration.
 *  2. **The shape** — payment volume by month, MRR by provider, MRR by plan.
 *     One measure each, so one hue each, each with a hover layer and a table.
 *  3. **The catalogue** — per provider, every endpoint asked, whether it
 *     answered, how many records came back, and *every field name on them*. This
 *     is the honest answer to "what can I get?": not a curated list, but what
 *     the provider returned today, including the endpoints your key refused.
 *
 * Two rules run through all of it. **A count that is capped says so** — page
 * caps are stated wherever a number is a floor rather than a total. And **money
 * is never summed across currencies**: the headline quotes the largest and names
 * the rest, because dollars plus euros is not an amount.
 */

const money = (minor: number, currency: string) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency || "USD",
    maximumFractionDigits: Math.abs(minor) >= 100_000 ? 0 : 2,
    // A fixed locale on purpose: this component renders on the server first, and
    // a chart whose axis is formatted by the visitor's ICU is a hydration
    // mismatch waiting for a plane ticket.
  }).format(minor / 100);

const count = (value: number) => new Intl.NumberFormat("en-US").format(value);

const MONTH_LABEL = new Intl.DateTimeFormat("en-US", { month: "short", year: "2-digit" });

function monthLabel(key: string): string {
  const [year, month] = key.split("-").map(Number);
  if (!year || !month) return key;
  return MONTH_LABEL.format(new Date(Date.UTC(year, month - 1, 1)));
}

/* ------------------------------------------------------------------- pieces */

function Stat({
  label,
  value,
  note,
  tone,
}: {
  label: string;
  value: string;
  note?: string;
  tone?: "warn" | "danger";
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-3 shadow-elev-1">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70">
        {label}
      </p>
      <p
        className={cn(
          "mt-1 font-mono text-lg font-semibold tabular-nums leading-none",
          tone === "warn" && "text-warn",
          tone === "danger" && "text-destructive",
        )}
      >
        {value}
      </p>
      {note && <p className="mt-1 text-[10px] text-muted-foreground">{note}</p>}
    </div>
  );
}

/** Status is a pill with a word in it, never a colour on its own. */
function CollectionRow({ collection }: { collection: CollectionResult }) {
  const [open, setOpen] = useState(false);

  return (
    <li className="rounded-xl border border-border bg-card p-2.5 shadow-elev-1">
      <div className="flex flex-wrap items-center gap-2">
        {collection.ok ? (
          <Badge variant="success">
            <CheckCircle2 className="size-3" />
            answered
          </Badge>
        ) : (
          <Badge variant="destructive">
            <ShieldAlert className="size-3" />
            {collection.note ?? "refused"}
          </Badge>
        )}

        <span className="text-xs font-semibold">{collection.label}</span>
        <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
          {collection.endpoint}
        </code>

        <span className="ml-auto flex items-center gap-2 text-[10px] text-muted-foreground">
          {collection.ok && (
            <>
              <span className="font-mono tabular-nums">
                {count(collection.count)}
                {collection.truncated ? "+" : ""} record
                {collection.count === 1 ? "" : "s"}
              </span>
              {collection.total !== null && (
                <span>of {count(collection.total)} reported</span>
              )}
              {collection.fields.length > 0 && (
                <button
                  type="button"
                  onClick={() => setOpen((value) => !value)}
                  className="rounded-4xl border border-border px-2 py-0.5 font-medium transition-colors hover:text-foreground"
                  aria-expanded={open}
                >
                  {collection.fields.length} fields
                </button>
              )}
            </>
          )}
        </span>
      </div>

      {collection.truncated && (
        <p className="mt-1 text-[10px] text-warn">
          Capped at 300 records for this page — the count above is a floor, not a total.
        </p>
      )}

      {open && (
        <dl className="mt-2 grid gap-x-4 gap-y-1 border-t border-border/60 pt-2 sm:grid-cols-2 lg:grid-cols-3">
          {collection.fields.map((field) => (
            <div key={field.name} className="flex items-baseline gap-1.5 text-[10px]">
              <dt className="font-mono text-foreground">{field.name}</dt>
              <dd className="text-muted-foreground">
                {field.type}
                {field.example !== null && (
                  <span className="ml-1 opacity-70">· {field.example}</span>
                )}
              </dd>
            </div>
          ))}
        </dl>
      )}
    </li>
  );
}

function MiniTable({
  title,
  head,
  rows,
  note,
}: {
  title: string;
  head: string[];
  rows: Array<Array<string | number>>;
  note?: string;
}) {
  if (!rows.length) return null;

  return (
    <div className="rounded-xl border border-border bg-card shadow-elev-1">
      <div className="flex items-baseline justify-between gap-3 border-b border-border/60 px-3 py-2">
        <h4 className="text-xs font-semibold">{title}</h4>
        {note && <span className="text-[10px] text-muted-foreground">{note}</span>}
      </div>
      <div className="max-h-72 overflow-auto">
        <table className="w-full text-[11px]">
          <thead className="sticky top-0 bg-card">
            <tr className="text-left text-muted-foreground">
              {head.map((column, index) => (
                <th
                  key={column}
                  className={cn(
                    "px-3 py-1.5 font-medium",
                    index > 0 && index === head.length - 1 && "text-right",
                  )}
                >
                  {column}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, rowIndex) => (
              <tr key={rowIndex} className="border-t border-border/30">
                {row.map((cell, index) => (
                  <td
                    key={index}
                    className={cn(
                      "px-3 py-1.5",
                      index === 0 && "font-mono text-[10px] text-muted-foreground",
                      index === row.length - 1 && index > 0 && "text-right tabular-nums",
                    )}
                  >
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ProviderPanel({ harvest }: { harvest: ProviderHarvest }) {
  const provider = REVENUE_PROVIDERS[harvest.provider];
  const currency = harvest.summary.currency;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-border bg-card p-3 shadow-elev-1">
        <ProviderMark provider={provider} />
        <div className="min-w-[12rem] flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-xs font-semibold">{harvest.accountLabel ?? provider.name}</p>
            {harvest.environment === "test" && <Badge variant="warn">test mode</Badge>}
            {harvest.fatal && (
              <Badge variant="destructive">
                <AlertTriangle className="size-3" />
                unusable
              </Badge>
            )}
          </div>
          <p className="mt-0.5 text-[10px] text-muted-foreground">
            {harvest.reference && <span className="font-mono">{harvest.reference} · </span>}
            fetched {harvest.fetchedAt.slice(0, 16).replace("T", " ")} UTC
          </p>
          {harvest.publicUrl && (
            <a
              href={harvest.publicUrl}
              target="_blank"
              rel="noreferrer noopener"
              className="inline-flex items-center gap-1 text-[10px] text-primary underline-offset-4 hover:underline"
            >
              {harvest.publicUrl.replace(/^https:\/\//, "")}
              <ExternalLink className="size-2.5" />
            </a>
          )}
        </div>
      </div>

      {harvest.fatal && (
        <p className="rounded-xl bg-destructive/10 p-3 text-[11px] text-destructive">
          {harvest.fatal}
        </p>
      )}

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
        <Stat label="MRR" value={money(harvest.summary.mrrMinor, currency)} />
        <Stat label="ARR" value={money(harvest.summary.arrMinor, currency)} />
        <Stat label="Active" value={count(harvest.summary.activeCount)} />
        <Stat
          label="Trialing"
          value={count(harvest.summary.trialingCount)}
          note="not counted in MRR"
        />
        <Stat
          label="Past due"
          value={count(harvest.summary.pastDueCount)}
          tone={harvest.summary.pastDueCount > 0 ? "warn" : undefined}
        />
        <Stat
          label="Canceled"
          value={count(harvest.summary.canceledCount)}
          note="in the records fetched"
        />
      </div>

      {harvest.metrics.length > 0 && (
        <div className="rounded-xl border border-border bg-card p-3 shadow-elev-1">
          <h4 className="text-xs font-semibold">Numbers {provider.name} computed itself</h4>
          <p className="mt-0.5 text-[10px] text-muted-foreground">
            Quoted from the provider rather than recomputed here.
          </p>
          <dl className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
            {harvest.metrics.map((metric) => (
              <div key={metric.label} className="rounded-lg bg-muted/50 p-2">
                <dt className="text-[10px] text-muted-foreground">{metric.label}</dt>
                <dd className="font-mono text-xs font-semibold tabular-nums">{metric.value}</dd>
              </div>
            ))}
          </dl>
        </div>
      )}

      <div>
        <h4 className="mb-2 text-xs font-semibold">
          Endpoints asked · {harvest.collections.filter((c) => c.ok).length} answered,{" "}
          {harvest.collections.filter((c) => !c.ok).length} refused
        </h4>
        <ul className="space-y-1.5">
          {harvest.collections.map((collection) => (
            <CollectionRow key={collection.key} collection={collection} />
          ))}
        </ul>
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        <MiniTable
          title="Subscriptions"
          note={`${harvest.subscriptions.length} fetched · showing 25`}
          head={["ID", "Customer", "Plan", "Status", "Per month"]}
          rows={harvest.subscriptions.slice(0, 25).map((subscription) => [
            subscription.id.slice(0, 14),
            subscription.customer ?? "—",
            subscription.plan ?? "—",
            subscription.status.replace("_", " "),
            money(subscription.monthlyMinor, subscription.currency),
          ])}
        />
        <MiniTable
          title="Transactions"
          note={`${harvest.transactions.length} fetched · showing 25`}
          head={["ID", "Kind", "When", "Status", "Amount"]}
          rows={harvest.transactions.slice(0, 25).map((transaction) => [
            transaction.id.slice(0, 14),
            transaction.kind,
            transaction.createdAt?.slice(0, 10) ?? "—",
            transaction.status ?? "—",
            money(transaction.amountMinor, transaction.currency),
          ])}
        />
        <MiniTable
          title="Customers"
          note={`${harvest.customers.length} fetched · showing 25`}
          head={["ID", "Name", "Email", "Country", "Since"]}
          rows={harvest.customers.slice(0, 25).map((customer) => [
            customer.id.slice(0, 14),
            customer.name ?? "—",
            customer.email ?? "—",
            customer.country ?? "—",
            customer.createdAt?.slice(0, 10) ?? "—",
          ])}
        />
        <MiniTable
          title="Products"
          note={`${harvest.products.length} fetched · showing 25`}
          head={["ID", "Name", "Detail"]}
          rows={harvest.products.slice(0, 25).map((product) => [
            product.id.slice(0, 14),
            product.name,
            product.detail ?? "—",
          ])}
        />
      </div>
    </div>
  );
}

/* --------------------------------------------------------------------- page */

export function RevenueDashboard({ harvest }: { harvest: RevenueHarvest }) {
  const [isPending, startTransition] = useTransition();
  const totals = harvest.totals;
  const currency = totals.currency;

  const volume: Datum[] = useMemo(
    () =>
      totals.monthlyVolume.map((entry) => ({
        label: monthLabel(entry.month),
        detail: `${count(entry.count)} payment${entry.count === 1 ? "" : "s"}`,
        value: entry.amountMinor,
      })),
    [totals.monthlyVolume],
  );

  const byProvider: Datum[] = useMemo(
    () =>
      harvest.providers
        .map((provider) => ({
          label: provider.providerName,
          detail: `${count(provider.summary.activeCount)} active`,
          value: provider.summary.mrrMinor,
        }))
        .sort((a, b) => b.value - a.value),
    [harvest.providers],
  );

  const byPlan: Datum[] = useMemo(() => {
    const plans = new Map<string, { value: number; count: number }>();
    for (const provider of harvest.providers) {
      for (const entry of provider.summary.planMix) {
        const key = harvest.providers.length > 1 ? `${entry.plan} · ${provider.providerName}` : entry.plan;
        const current = plans.get(key) ?? { value: 0, count: 0 };
        current.value += entry.monthlyMinor;
        current.count += entry.count;
        plans.set(key, current);
      }
    }
    return [...plans.entries()]
      .map(([label, entry]) => ({
        label,
        detail: `${count(entry.count)} subs`,
        value: entry.value,
      }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 8);
  }, [harvest.providers]);

  const otherCurrencies = Object.entries(totals.currencyMix)
    .filter(([code]) => code !== currency)
    .sort((a, b) => b[1] - a[1]);

  function refresh() {
    startTransition(async () => {
      const result = await refreshRevenueHarvest();
      if (result.ok) toast.success("Refetched from every connected provider");
      else toast.error(result.message ?? "Could not refresh");
    });
  }

  if (!harvest.providers.length) {
    return (
      <div className="rounded-xl border border-border bg-card p-8 text-center shadow-elev-1">
        <p className="text-xs font-medium">Nothing connected yet</p>
        <p className="mx-auto mt-1 max-w-sm text-[11px] text-muted-foreground">
          Import a read-only API key and this page fills with everything that key can
          read — subscriptions, customers, orders, invoices, products, payouts.
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

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <p className="max-w-prose text-[11px] text-muted-foreground">
          {count(totals.endpointsAnswered)} endpoint
          {totals.endpointsAnswered === 1 ? "" : "s"} answered across{" "}
          {harvest.providers.length} provider
          {harvest.providers.length === 1 ? "" : "s"},{" "}
          {count(totals.endpointsRefused)} refused, {count(totals.recordsFetched)} records
          read. Fetched {harvest.fetchedAt.slice(0, 16).replace("T", " ")} UTC and cached for
          a minute.
        </p>
        <Button
          size="sm"
          variant="outline"
          className="h-8 shrink-0 text-xs"
          onClick={refresh}
          disabled={isPending}
        >
          {isPending ? (
            <Loader2 className="size-3.5 animate-spin" />
          ) : (
            <RefreshCw className="size-3.5" />
          )}
          Refresh
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-7">
        <Stat
          label="MRR"
          value={money(totals.mrrMinor, currency)}
          note={otherCurrencies.length ? `plus ${otherCurrencies.length} other currency` : "active subscriptions"}
        />
        <Stat label="ARR" value={money(totals.arrMinor, currency)} note="MRR × 12" />
        <Stat label="Active" value={count(totals.activeCount)} />
        <Stat label="Trialing" value={count(totals.trialingCount)} note="not in MRR" />
        <Stat
          label="Past due"
          value={count(totals.pastDueCount)}
          tone={totals.pastDueCount > 0 ? "warn" : undefined}
        />
        <Stat
          label="Customers"
          value={count(totals.customerCount)}
          note="as reported"
        />
        <Stat
          label="ARPA"
          value={totals.arpaMinor === null ? "—" : money(totals.arpaMinor, currency)}
          note="MRR ÷ active"
        />
      </div>

      {otherCurrencies.length > 0 && (
        <p className="flex items-start gap-1.5 rounded-xl bg-warn-soft p-2.5 text-[11px] text-warn">
          <AlertTriangle className="mt-px size-3.5 shrink-0" />
          More than one currency is in play, and they are not added together. The headline is{" "}
          {currency}; also present:{" "}
          {otherCurrencies.map(([code, amount]) => `${money(amount, code)}`).join(", ")} of
          monthly recurring revenue.
        </p>
      )}

      <div className="grid gap-3 lg:grid-cols-2">
        <ColumnChart
          title="Payment volume by month"
          caption={`From the ${count(totals.recordsFetched)} records fetched — the most recent pages only, so early months may be short.`}
          data={volume}
          format={(value) => money(value, currency)}
          emptyNote="No dated payments came back from these keys."
        />
        <RowChart
          title="MRR by provider"
          caption="Active subscriptions only, each in its own currency."
          data={byProvider}
          format={(value) => money(value, currency)}
        />
      </div>

      <RowChart
        title="MRR by plan"
        caption={byPlan.length === 8 ? "Top 8 plans by monthly value." : "Every plan with an active subscription."}
        data={byPlan}
        format={(value) => money(value, currency)}
        emptyNote="No priced subscriptions came back — check the endpoint catalogue below."
      />

      <Tabs defaultValue={harvest.providers[0].provider}>
        <TabsList className="w-full justify-start overflow-x-auto">
          {harvest.providers.map((provider) => (
            <TabsTrigger key={provider.provider} value={provider.provider} className="text-xs">
              <ProviderMark provider={REVENUE_PROVIDERS[provider.provider]} size="sm" />
              {provider.providerName}
            </TabsTrigger>
          ))}
        </TabsList>

        {harvest.providers.map((provider) => (
          <TabsContent key={provider.provider} value={provider.provider} className="mt-4">
            <ProviderPanel harvest={provider} />
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}
