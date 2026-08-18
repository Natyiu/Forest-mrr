import "server-only";

import type { Plant } from "@/garden/types";
import type { Scope } from "@/lib/startups";

import { harvestRevenue } from "./harvest";
import { harvestToForest } from "./to-garden";

/**
 * **The imported data, as series a chart can draw.**
 *
 * Built from the *same book* the forest is built from — `harvestToForest` — and
 * that is the point rather than a convenience: the plot and the graphs are two
 * views of one derivation, so a number cannot say $4,200 on one screen and
 * $4,380 on the other. Every monthly figure here is read off the same snapshots
 * the scrubber walks.
 *
 * Everything is **integer minor units** (cents), because that is what the whole
 * revenue surface uses and mixing conventions between a page and its charts is
 * how a chart ends up off by a hundred.
 *
 * What is *not* here matters as much: no interpolation over months with no data,
 * no smoothing, no projections. A gap in a real book is a gap.
 */

export interface MonthPoint {
  /** `YYYY-MM`. */
  key: string;
  /** `Aug 26`, pre-formatted server-side so the axis cannot vary by locale. */
  label: string;
  mrrMinor: number;
  arrMinor: number;
  active: number;
  atRisk: number;
  /** Started in this month. */
  started: number;
  /** Cancelled in this month, as a positive count. */
  churned: number;
  /** `started - churned`. */
  netLogos: number;
  arpaMinor: number | null;
  /** Payment volume in this month, from the transactions fetched. */
  volumeMinor: number;
  payments: number;
}

export interface CohortRow {
  /** `YYYY-MM` the customers signed up in. */
  cohort: string;
  label: string;
  size: number;
  /** Share still active at month 0, 1, 2 … as 0–1. `null` beyond today. */
  retention: Array<number | null>;
}

export interface RevenueGraphSeries {
  fetchedAt: string;
  providers: string[];
  currency: string;
  mixedCurrencies: string[];
  months: MonthPoint[];
  planMix: Array<{ plan: string; count: number; mrrMinor: number }>;
  statusMix: Array<{ status: string; label: string; count: number }>;
  countryMix: Array<{ code: string; label: string; flag: string | null; count: number; mrrMinor: number }>;
  topCustomers: Array<{ name: string; plan: string; mrrMinor: number; since: string | null }>;
  cohorts: CohortRow[];
  totals: {
    mrrMinor: number;
    arrMinor: number;
    active: number;
    atRisk: number;
    customers: number;
    arpaMinor: number | null;
    /** Month-over-month MRR change, as a ratio. Null with fewer than two months. */
    momGrowth: number | null;
    /** Logo churn over the last full month, as a ratio. */
    logoChurn: number | null;
    /** Volume over the trailing 30 days. */
    volume30dMinor: number;
    subscriptions: number;
  };
}

const MONTH_LABEL = new Intl.DateTimeFormat("en-US", { month: "short", year: "2-digit" });
const REGION_NAMES = new Intl.DisplayNames(["en"], { type: "region" });

function labelFor(key: string): string {
  const [year, month] = key.split("-").map(Number);
  if (!year || !month) return key;
  return MONTH_LABEL.format(new Date(Date.UTC(year, month - 1, 1)));
}

const STATUS_LABELS: Record<string, string> = {
  active: "Active",
  past_due: "Past due",
  canceled: "Canceled",
};

/** How many months of a cohort's life to draw. Twelve is a screen's worth. */
const COHORT_WIDTH = 12;
/** Cohorts older than this are folded away — a triangle is not a wall of rows. */
const MAX_COHORTS = 12;

const monthIndex = (ms: number) => {
  const date = new Date(ms);
  return date.getFullYear() * 12 + date.getMonth();
};

const keyOf = (index: number) =>
  `${Math.floor(index / 12)}-${String((index % 12) + 1).padStart(2, "0")}`;

/**
 * Retention by signup cohort.
 *
 * Counts *logos*, not revenue: a cohort's revenue retention needs the plan
 * history providers do not hand over, and a triangle labelled "retention" that
 * silently means one of the two is worse than no triangle. Cells beyond the
 * current month are `null` — the future is not zero.
 */
function cohorts(book: Plant[], nowIndex: number): CohortRow[] {
  const groups = new Map<number, Plant[]>();

  for (const plant of book) {
    const index = monthIndex(plant.started);
    const list = groups.get(index) ?? [];
    list.push(plant);
    groups.set(index, list);
  }

  return [...groups.entries()]
    .sort((a, b) => b[0] - a[0])
    .slice(0, MAX_COHORTS)
    .reverse()
    .map(([index, plants]) => ({
      cohort: keyOf(index),
      label: labelFor(keyOf(index)),
      size: plants.length,
      retention: Array.from({ length: COHORT_WIDTH }, (_, offset) => {
        const at = index + offset;
        if (at > nowIndex) return null;
        const alive = plants.filter(
          (plant) =>
            plant.canceled_at === undefined || monthIndex(plant.canceled_at) > at,
        ).length;
        return plants.length ? alive / plants.length : null;
      }),
    }));
}

/** What a connected provider had to say, when it had nothing to draw. */
export interface ConnectedProviderStatus {
  provider: string;
  name: string;
  accountLabel: string | null;
  subscriptions: number;
  /** Endpoints that answered. */
  answered: number;
  /** Endpoints that refused, and what they said. */
  refused: Array<{ label: string; note: string }>;
  fatal: string | null;
}

/**
 * Three outcomes, not two.
 *
 * "No graphs" has two completely different causes and they need different words:
 * **nothing is connected**, or **something is connected and working and the
 * account has no subscriptions in it yet**. Collapsing them into one `null` is
 * what made a connected Polar organization read as "connect a payment provider" —
 * the one sentence that was certainly wrong. The empty case therefore carries the
 * evidence: which providers answered, how many subscriptions they had, and which
 * endpoints their key was not allowed to read.
 */
export type RevenueGraphResult =
  | { kind: "none" }
  | { kind: "empty"; providers: ConnectedProviderStatus[]; fetchedAt: string }
  | { kind: "series"; series: RevenueGraphSeries };

export async function revenueGraphs(userId: string, scope: Scope): Promise<RevenueGraphResult> {
  const harvest = await harvestRevenue(userId, { scope });

  if (harvest.providers.length === 0) return { kind: "none" };

  const series = buildSeries(harvest);
  if (series) return { kind: "series", series };

  return {
    kind: "empty",
    fetchedAt: harvest.fetchedAt,
    providers: harvest.providers.map((provider) => ({
      provider: provider.provider,
      name: provider.providerName,
      accountLabel: provider.accountLabel,
      subscriptions: provider.subscriptions.length,
      answered: provider.collections.filter((collection) => collection.ok).length,
      refused: provider.collections
        .filter((collection) => !collection.ok)
        .map((collection) => ({ label: collection.label, note: collection.note ?? "refused" })),
      fatal: provider.fatal,
    })),
  };
}

/**
 * The biggest accounts, one row each.
 *
 * A customer with three subscriptions is one customer worth the sum of them; the
 * `plan` column then says how many rather than naming one of the three and
 * implying it is the whole relationship.
 */
function groupCustomers(live: Plant[]): RevenueGraphSeries["topCustomers"] {
  const byCustomer = new Map<
    string,
    { name: string; plans: Set<string>; mrrMinor: number; started: number; count: number }
  >();

  for (const plant of live) {
    const entry = byCustomer.get(plant.customer_id) ?? {
      name: plant.customer_name,
      plans: new Set<string>(),
      mrrMinor: 0,
      started: plant.started,
      count: 0,
    };
    entry.plans.add(plant.plan);
    entry.mrrMinor += Math.round(plant.mrr * 100);
    entry.started = Math.min(entry.started, plant.started);
    entry.count += 1;
    byCustomer.set(plant.customer_id, entry);
  }

  return [...byCustomer.values()]
    .sort((a, b) => b.mrrMinor - a.mrrMinor)
    .slice(0, 10)
    .map((entry) => ({
      name: entry.name,
      plan:
        entry.count === 1
          ? [...entry.plans][0]
          : `${entry.count} subscriptions · ${[...entry.plans].join(", ")}`,
      mrrMinor: entry.mrrMinor,
      since: new Date(entry.started).toISOString().slice(0, 10),
    }));
}

/**
 * Every series the graph screen draws, or `null` when the harvest holds no
 * priced subscription — a chart of nothing is a chart that says the business is
 * worth nothing, so the caller says something truthful instead.
 */
function buildSeries(
  harvest: Awaited<ReturnType<typeof harvestRevenue>>,
): RevenueGraphSeries | null {
  const forest = harvestToForest(harvest);
  if (!forest) return null;

  const nowMs = Date.now();
  const nowIndex = monthIndex(nowMs);

  // The book behind the plot: every subscription, live or cancelled, once.
  const book = new Map<string, Plant>();
  for (const snapshot of forest.snapshots) {
    for (const plant of snapshot.plants) book.set(plant.subscription_id, plant);
  }
  for (const plant of forest.garden.plants) book.set(plant.subscription_id, plant);
  const plants = [...book.values()];

  // Payments by month, from every provider that had transactions to give.
  const volume = new Map<string, { amountMinor: number; payments: number }>();
  for (const provider of harvest.providers) {
    for (const transaction of provider.transactions) {
      if (transaction.kind === "refund" || !transaction.createdAt) continue;
      const key = transaction.createdAt.slice(0, 7);
      const entry = volume.get(key) ?? { amountMinor: 0, payments: 0 };
      entry.amountMinor += transaction.amountMinor;
      entry.payments += 1;
      volume.set(key, entry);
    }
  }

  const months: MonthPoint[] = forest.snapshots.map((snapshot) => {
    const index = snapshot.year * 12 + snapshot.month;
    const started = plants.filter((plant) => monthIndex(plant.started) === index).length;
    const churned = plants.filter(
      (plant) => plant.canceled_at !== undefined && monthIndex(plant.canceled_at) === index,
    ).length;
    const mrrMinor = Math.round(snapshot.mrr * 100);
    const paid = volume.get(snapshot.dateStr) ?? { amountMinor: 0, payments: 0 };

    return {
      key: snapshot.dateStr,
      label: labelFor(snapshot.dateStr),
      mrrMinor,
      arrMinor: mrrMinor * 12,
      active: snapshot.activeCount,
      atRisk: snapshot.atRiskCount,
      started,
      churned,
      netLogos: started - churned,
      arpaMinor: snapshot.activeCount ? Math.round(mrrMinor / snapshot.activeCount) : null,
      volumeMinor: paid.amountMinor,
      payments: paid.payments,
    };
  });

  const live = forest.garden.plants.filter((plant) => plant.status !== "canceled");

  const plansTable = new Map<string, { count: number; mrrMinor: number }>();
  for (const plant of live) {
    const entry = plansTable.get(plant.plan) ?? { count: 0, mrrMinor: 0 };
    entry.count += 1;
    entry.mrrMinor += Math.round(plant.mrr * 100);
    plansTable.set(plant.plan, entry);
  }

  const statusTable = new Map<string, number>();
  for (const plant of forest.garden.plants) {
    statusTable.set(plant.status, (statusTable.get(plant.status) ?? 0) + 1);
  }

  const countryTable = new Map<string, { count: number; mrrMinor: number }>();
  for (const plant of live) {
    if (!plant.countryCode) continue;
    const entry = countryTable.get(plant.countryCode) ?? { count: 0, mrrMinor: 0 };
    entry.count += 1;
    entry.mrrMinor += Math.round(plant.mrr * 100);
    countryTable.set(plant.countryCode, entry);
  }

  const last = months[months.length - 1];
  const previous = months.length > 1 ? months[months.length - 2] : null;
  const trailing30 = harvest.providers.reduce(
    (sum, provider) => sum + provider.summary.volume30dMinor,
    0,
  );

  return {
    fetchedAt: harvest.fetchedAt,
    providers: forest.source.providers,
    currency: forest.source.currency,
    mixedCurrencies: forest.source.mixedCurrencies,
    months,
    planMix: [...plansTable.entries()]
      .map(([plan, entry]) => ({ plan, ...entry }))
      .sort((a, b) => b.mrrMinor - a.mrrMinor),
    statusMix: [...statusTable.entries()]
      .map(([status, count]) => ({
        status,
        label: STATUS_LABELS[status] ?? status,
        count,
      }))
      .sort((a, b) => b.count - a.count),
    countryMix: [...countryTable.entries()]
      .map(([code, entry]) => {
        let label = code;
        try {
          label = REGION_NAMES.of(code) ?? code;
        } catch {
          label = code;
        }
        return {
          code,
          label,
          flag: /^[A-Z]{2}$/.test(code)
            ? String.fromCodePoint(...[...code].map((c) => 0x1f1e6 + c.charCodeAt(0) - 65))
            : null,
          ...entry,
        };
      })
      .sort((a, b) => b.count - a.count),
    // **Per customer, not per subscription.** A chart headed "customers" that
    // lists one row per subscription shows the same name twice the moment somebody
    // buys a second plan, understates what they are worth, and — before this —
    // collided on its React key. Grouped by `customer_id`, which is stable across
    // refreshes, so two subscriptions become one row at their combined value.
    topCustomers: groupCustomers(live),
    cohorts: cohorts(plants, nowIndex),
    totals: {
      mrrMinor: last?.mrrMinor ?? 0,
      arrMinor: (last?.mrrMinor ?? 0) * 12,
      active: forest.garden.activeCount,
      atRisk: forest.garden.atRiskCount,
      customers: forest.garden.totalCustomers,
      arpaMinor: forest.garden.activeCount
        ? Math.round(((last?.mrrMinor ?? 0) / forest.garden.activeCount))
        : null,
      momGrowth:
        previous && previous.mrrMinor > 0
          ? (last.mrrMinor - previous.mrrMinor) / previous.mrrMinor
          : null,
      logoChurn:
        previous && previous.active > 0 ? (last?.churned ?? 0) / previous.active : null,
      volume30dMinor: trailing30,
      subscriptions: plants.length,
    },
  };
}
