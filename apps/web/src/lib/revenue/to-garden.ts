import "server-only";

import { type PlanDefinition, sampleRamp } from "@/garden/lib/plans";
import type {
  GardenState,
  HistoricalSnapshot,
  Plant,
  WeatherState,
} from "@/garden/types";

import type { NormalizedSubscription, ProviderHarvest, RevenueHarvest } from "./harvest";

/**
 * **The real book of business, as a garden.**
 *
 * The plot has always drawn a `Plant[]` — one plant per subscription — sampled
 * at a date. Nothing about that changes here: this file turns the harvested
 * providers into exactly that book, and the canvas, the beds, the metrics, the
 * scrubber and the globe all carry on reading what they always read. A tree is
 * still a subscription drawn at the size it actually pays; the only difference
 * is that the subscription is now somebody's.
 *
 * Three things had to be *derived* rather than invented, because the garden
 * needs them and no provider hands them over:
 *
 *  - **The plan ladder.** `lib/plans` wants a catalogue ordered cheapest-first,
 *    and that is what decides tree shape, size, canopy green and the filter
 *    chips. So the ladder is read *out of* the book: group the subscriptions by
 *    the plan name the provider gave them, price each rung at the median of what
 *    those subscriptions actually pay, sort ascending. A product with two plans
 *    gets two rungs; one with forty gets the five biggest by headcount and an
 *    "Other plans" rung for the tail, because forty rungs is not a ladder a
 *    reader can use.
 *  - **The timeline.** Snapshots are recomputed from signup and cancellation
 *    dates — real ones — from the earliest signup (capped at 24 months) to now.
 *  - **The weather.** Rain is payment volume in the trailing hour, drought is
 *    six hours without one. Both are real events now rather than a simulator's.
 *
 * And three things are deliberately **absent**, because inventing them would put
 * fiction on a plot the user is about to trust:
 *
 *  - **No meadow.** The synthetic long tail (`meadowCount`, `MEADOW_ARPA`) is
 *    zero here. It exists so the sample garden looks like a real business; adding
 *    it to a real one would add revenue nobody earned.
 *  - **No plan history.** Providers do not hand over a subscription's upgrade
 *    path in one read, so `changes[]` is empty and the movement waterfall reports
 *    no expansion or contraction. A month's growth still reconciles — it is
 *    carried by new and churned — and an invented upgrade would be worse than a
 *    missing one.
 *  - **No dunning depth.** A past-due subscription is `failed_attempts: 1`
 *    (yellowing), not a guessed 2 or 3. It is in trouble; how deep is not
 *    something the list endpoints say.
 */

/** How long a cancelled subscription stays on the plot as a stump. */
const STUMP_DAYS_MS = 30 * 24 * 60 * 60 * 1000;
/** The longest history worth rebuilding from signup dates alone. */
const MAX_HISTORY_MONTHS = 24;
/** Named rungs before the tail folds into one. Five plus "Other" reads; forty does not. */
const MAX_NAMED_PLANS = 5;
const OTHER_PLAN = "Other plans";
/** The same percentile control points the sample book reports. */
const PERCENTILE_RAMP = [40, 65, 85, 98];

export interface ForestBook {
  garden: GardenState;
  snapshots: HistoricalSnapshot[];
  planCatalogue: PlanDefinition[];
  weather: WeatherState;
  /** What the plot is standing on, for the response and for the logs. */
  source: {
    providers: string[];
    subscriptions: number;
    currency: string;
    /** More than one currency was summed. The plot has one MRR figure. */
    mixedCurrencies: string[];
    /** Providers that answered but had no subscription list to give. */
    quoted: string[];
    fetchedAt: string;
  };
}

/* ------------------------------------------------------------------ the geo */

/**
 * Centroids for the countries a subscription is likely to come from.
 *
 * The globe needs a lat/lng per plant and providers give a two-letter code, so
 * this is the join. It is deliberately a short list: a customer in a country
 * that is not here keeps its name and its filter chip (the name comes from
 * `Intl.DisplayNames`, not from a table) and is simply absent from the globe,
 * which is better than a marker planted in the sea. The flag is computed from
 * the code rather than stored — regional indicators are arithmetic.
 */
const CENTROIDS: Record<string, [number, number, string]> = {
  US: [37.09, -95.71, "North America"], CA: [56.13, -106.34, "North America"],
  MX: [23.63, -102.55, "Latin America"], BR: [-14.23, -51.92, "Latin America"],
  AR: [-38.42, -63.62, "Latin America"], CL: [-35.68, -71.54, "Latin America"],
  CO: [4.57, -74.30, "Latin America"], PE: [-9.19, -75.02, "Latin America"],
  GB: [55.37, -3.43, "Europe"], IE: [53.41, -8.24, "Europe"],
  FR: [46.22, 2.21, "Europe"], DE: [51.16, 10.45, "Europe"],
  NL: [52.13, 5.29, "Europe"], BE: [50.50, 4.47, "Europe"],
  ES: [40.46, -3.74, "Europe"], PT: [39.40, -8.22, "Europe"],
  IT: [41.87, 12.56, "Europe"], CH: [46.81, 8.22, "Europe"],
  AT: [47.52, 14.55, "Europe"], SE: [60.12, 18.64, "Europe"],
  NO: [60.47, 8.47, "Europe"], DK: [56.26, 9.50, "Europe"],
  FI: [61.92, 25.75, "Europe"], PL: [51.92, 19.15, "Europe"],
  CZ: [49.82, 15.47, "Europe"], RO: [45.94, 24.97, "Europe"],
  GR: [39.07, 21.82, "Europe"], HU: [47.16, 19.50, "Europe"],
  UA: [48.38, 31.17, "Europe"], TR: [38.96, 35.24, "Europe"],
  IL: [31.05, 34.85, "Europe"], AE: [23.42, 53.85, "Asia Pacific"],
  SA: [23.89, 45.08, "Asia Pacific"], ZA: [-30.56, 22.94, "Europe"],
  NG: [9.08, 8.68, "Europe"], KE: [-0.02, 37.91, "Europe"],
  EG: [26.82, 30.80, "Europe"], IN: [20.59, 78.96, "Asia Pacific"],
  PK: [30.38, 69.35, "Asia Pacific"], BD: [23.68, 90.36, "Asia Pacific"],
  CN: [35.86, 104.20, "Asia Pacific"], HK: [22.32, 114.17, "Asia Pacific"],
  TW: [23.70, 120.96, "Asia Pacific"], JP: [36.20, 138.25, "Asia Pacific"],
  KR: [35.91, 127.77, "Asia Pacific"], SG: [1.35, 103.81, "Asia Pacific"],
  MY: [4.21, 101.98, "Asia Pacific"], TH: [15.87, 100.99, "Asia Pacific"],
  VN: [14.06, 108.28, "Asia Pacific"], PH: [12.88, 121.77, "Asia Pacific"],
  ID: [-0.79, 113.92, "Asia Pacific"], AU: [-25.27, 133.77, "Asia Pacific"],
  NZ: [-40.90, 174.89, "Asia Pacific"],
};

const REGIONS = new Intl.DisplayNames(["en"], { type: "region" });

function flagOf(code: string): string | undefined {
  if (!/^[A-Z]{2}$/.test(code)) return undefined;
  return String.fromCodePoint(
    ...[...code].map((letter) => 0x1f1e6 + letter.charCodeAt(0) - 65),
  );
}

interface Geo {
  countryCode?: string;
  countryName?: string;
  countryFlag?: string;
  region?: string;
  lat?: number;
  lng?: number;
}

function geoOf(rawCode: string | null): Geo {
  if (!rawCode) return {};
  const code = rawCode.trim().toUpperCase();
  if (!/^[A-Z]{2}$/.test(code)) return {};

  let name: string | undefined;
  try {
    name = REGIONS.of(code);
  } catch {
    name = undefined;
  }

  const centroid = CENTROIDS[code];

  return {
    countryCode: code,
    countryName: name ?? code,
    countryFlag: flagOf(code),
    region: centroid?.[2],
    lat: centroid?.[0],
    lng: centroid?.[1],
  };
}

/* ----------------------------------------------------------- the plan ladder */

interface Rung {
  name: string;
  priceMinor: number;
  count: number;
}

const median = (values: number[]): number => {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : Math.round((sorted[middle - 1] + sorted[middle]) / 2);
};

/**
 * The ladder, read out of the book.
 *
 * Priced at the **median** rather than the mean because one enterprise deal on a
 * plan called "Pro" should not move that rung above the plan above it. The
 * catalogue is only ever used for *order* and for the ramps sampled off it — a
 * plant's own MRR is whatever the subscription pays — so the exact rung price
 * matters far less than the sequence being right.
 *
 * `validatePlanCatalogue` (correctly) refuses a ladder whose prices do not
 * strictly ascend, and two real plans can easily share a median. Rather than
 * merging them — they are different plans, and a reader filtering by one means
 * that one — the tie is broken by a cent. Nothing downstream reads the price
 * itself, only the order it implies.
 */
function deriveLadder(subscriptions: NormalizedSubscription[]): PlanDefinition[] {
  const groups = new Map<string, number[]>();

  for (const subscription of subscriptions) {
    const name = (subscription.plan ?? "Unnamed plan").trim() || "Unnamed plan";
    const prices = groups.get(name) ?? [];
    // A cancelled subscription still tells you what that plan costs.
    if (subscription.monthlyMinor > 0) prices.push(subscription.monthlyMinor);
    groups.set(name, prices);
  }

  let rungs: Rung[] = [...groups.entries()].map(([name, prices]) => ({
    name,
    priceMinor: median(prices),
    count: prices.length,
  }));

  if (rungs.length > MAX_NAMED_PLANS + 1) {
    const byHeadcount = [...rungs].sort((a, b) => b.count - a.count);
    const kept = byHeadcount.slice(0, MAX_NAMED_PLANS);
    const tail = byHeadcount.slice(MAX_NAMED_PLANS);
    rungs = [
      ...kept,
      {
        name: OTHER_PLAN,
        priceMinor: median(tail.map((rung) => rung.priceMinor)),
        count: tail.reduce((sum, rung) => sum + rung.count, 0),
      },
    ];
  }

  rungs.sort((a, b) => a.priceMinor - b.priceMinor);

  let previous = 0;
  return rungs.map((rung) => {
    const dollars = Math.max(rung.priceMinor / 100, previous + 0.01);
    previous = dollars;
    const headcount = Math.max(rung.count, 1);
    return {
      name: rung.name,
      baseMrr: Number(dollars.toFixed(2)),
      accounts: [headcount, headcount] as [number, number],
    };
  });
}

/** Which rung a provider's plan name lands on, once the tail has been folded. */
function rungIndexer(ladder: PlanDefinition[]) {
  const index = new Map(ladder.map((plan, i) => [plan.name, i]));
  const other = index.get(OTHER_PLAN);

  return (plan: string | null): { plan: string; tier: number } => {
    const name = (plan ?? "Unnamed plan").trim() || "Unnamed plan";
    const exact = index.get(name);
    if (exact !== undefined) return { plan: name, tier: exact };
    // Folded into the tail: the plant is drawn on the "Other plans" rung, and the
    // detail drawer still shows what it actually pays.
    if (other !== undefined) return { plan: OTHER_PLAN, tier: other };
    return { plan: ladder[0]?.name ?? name, tier: 0 };
  };
}

/* ------------------------------------------------------------------ the book */

const monthKey = (ms: number) => {
  const date = new Date(ms);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
};

/** A stable id, so the same customer keeps their spot between refreshes. */
function stableId(seed: string): number {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  return hash;
}

function buildBook(harvest: RevenueHarvest): { book: Plant[]; ladder: PlanDefinition[] } {
  const all: Array<{ provider: ProviderHarvest; subscription: NormalizedSubscription }> = [];
  for (const provider of harvest.providers) {
    for (const subscription of provider.subscriptions) {
      all.push({ provider, subscription });
    }
  }

  const ladder = deriveLadder(all.map((entry) => entry.subscription));
  const toRung = rungIndexer(ladder);
  const now = Date.now();
  const seen = new Set<string>();

  const book = all.map(({ provider, subscription }): Plant => {
    const { plan, tier } = toRung(subscription.plan);

    // Two providers can both call a subscription `1`; the plot's hit test, the
    // camera flight and the palette all key off this id.
    let id = subscription.id;
    if (seen.has(id)) id = `${provider.provider}:${subscription.id}`;
    seen.add(id);

    const started = subscription.createdAt ? Date.parse(subscription.createdAt) : now;
    const ends = subscription.endsAt ? Date.parse(subscription.endsAt) : null;
    const canceled = subscription.status === "canceled";

    const status: Plant["status"] =
      subscription.status === "past_due"
        ? "past_due"
        : canceled
          ? "canceled"
          : "active";

    const customerName =
      subscription.customer ?? `${provider.providerName} ${subscription.id.slice(0, 8)}`;

    // The subscription's own embedded customer first, the separate customer list
    // only as a fallback. The list is a different read and often a different
    // scope — a Polar token with `subscriptions:read` alone already carries
    // `customer.billing_address.country`, and sourcing it from the list is how
    // the globe stayed empty for a key that had everything it needed.
    const country =
      subscription.country ??
      provider.customers.find(
        (customer) =>
          customer.name === subscription.customer || customer.email === subscription.customer,
      )?.country ??
      null;

    return {
      subscription_id: id,
      customer_id: `cus_${stableId(customerName + provider.provider).toString(36)}`,
      customer_name: customerName,
      started: Number.isFinite(started) ? started : now,
      plan,
      tier,
      mrr: subscription.monthlyMinor / 100,
      // No `changes[]`: a provider's subscription list does not carry the plan
      // history, and an invented upgrade is worse than a missing one.
      status,
      failed_attempts: status === "past_due" ? 1 : 0,
      // The freshest real date this subscription has. Never `now` for the sake
      // of looking healthy.
      last_payment: canceled ? (ends ?? started) : Math.min(ends ?? started, now),
      canceled_at: canceled ? (ends ?? now) : undefined,
      cohort: monthKey(Number.isFinite(started) ? started : now),
      ...geoOf(country),
      variantSeed: stableId(id),
    };
  });

  return { book, ladder };
}

/* --------------------------------------------------- the book, sampled at a date */

function percentiles(ladder: PlanDefinition[]): Record<string, number> {
  const table: Record<string, number> = {};
  const last = Math.max(ladder.length - 1, 1);
  ladder.forEach((plan, i) => {
    table[plan.name] = Math.round(sampleRamp(PERCENTILE_RAMP, i / last));
  });
  return table;
}

/**
 * The same reading `toGardenState` takes of the sample book, minus the meadow.
 *
 * It is not a call to that function for exactly one reason: `toGardenState` adds
 * the synthetic long tail to `mrr`, `activeCount` and `totalCustomers`. On a real
 * book that is revenue nobody earned. Everything else — the stump window, the
 * "cancelled later than this date is simply live" rule, the at-risk count — is
 * the same, because the scrubber and today have to be the same scene.
 */
function stateAt(book: Plant[], atMs: number, ladder: PlanDefinition[]): GardenState {
  const plants = book
    .filter(
      (plant) =>
        plant.started <= atMs &&
        !(plant.canceled_at && plant.canceled_at + STUMP_DAYS_MS < atMs),
    )
    .map((plant) => {
      const cancelled = plant.canceled_at !== undefined && plant.canceled_at <= atMs;
      const status: Plant["status"] = cancelled
        ? "canceled"
        : plant.status === "canceled"
          ? "active"
          : plant.status;

      return {
        ...plant,
        status,
        failed_attempts: status === "canceled" ? 0 : plant.failed_attempts,
        canceled_at: cancelled ? plant.canceled_at : undefined,
      };
    });

  const active = plants.filter((plant) => plant.status !== "canceled");
  const atRisk = active.filter((plant) => plant.failed_attempts > 0);

  return {
    plants,
    planCatalogue: ladder.map((plan) => ({ ...plan })),
    tierPercentiles: percentiles(ladder),
    meadowCount: 0,
    meadowHealth: 1,
    mrr: active.reduce((sum, plant) => sum + plant.mrr, 0),
    activeCount: active.length,
    atRiskCount: atRisk.length,
    totalCustomers: plants.length,
  };
}

function snapshotsFrom(
  book: Plant[],
  nowMs: number,
  ladder: PlanDefinition[],
): HistoricalSnapshot[] {
  const earliest = book.reduce((min, plant) => Math.min(min, plant.started), nowMs);
  const now = new Date(nowMs);
  const start = new Date(earliest);

  // Never more than two years, and never fewer than the current month.
  const first = new Date(now.getFullYear(), now.getMonth() - (MAX_HISTORY_MONTHS - 1), 1);
  const cursor = start > first ? new Date(start.getFullYear(), start.getMonth(), 1) : first;

  const snapshots: HistoricalSnapshot[] = [];

  while (
    cursor.getFullYear() < now.getFullYear() ||
    (cursor.getFullYear() === now.getFullYear() && cursor.getMonth() <= now.getMonth())
  ) {
    const isCurrent =
      cursor.getFullYear() === now.getFullYear() && cursor.getMonth() === now.getMonth();
    // Months close on the 28th; the current one closes now, so the right-hand
    // end of the scrubber is genuinely today.
    const at = isCurrent
      ? nowMs
      : new Date(cursor.getFullYear(), cursor.getMonth(), 28).getTime();
    const state = stateAt(book, at, ladder);

    snapshots.push({
      dateStr: `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, "0")}`,
      year: cursor.getFullYear(),
      month: cursor.getMonth(),
      mrr: state.mrr,
      activeCount: state.activeCount,
      atRiskCount: state.atRiskCount,
      plants: state.plants,
      meadowCount: 0,
    });

    cursor.setMonth(cursor.getMonth() + 1);
  }

  return snapshots;
}

/* ----------------------------------------------------------------- weather */

const HOUR_MS = 60 * 60 * 1000;

const SEASONS: WeatherState["season"][] = [
  "winter", "winter", "spring", "spring", "spring", "summer",
  "summer", "summer", "autumn", "autumn", "autumn", "winter",
];

/**
 * Weather from real payments.
 *
 * Rain is the count of payments in the trailing hour — the same quantity the
 * simulator used to fake — and drought is six hours without one. On a real book
 * both are readings rather than effects: a quiet plot at 3am is a true statement
 * about the business.
 */
function weatherFrom(harvest: RevenueHarvest, nowMs: number): WeatherState {
  const payments = harvest.providers
    .flatMap((provider) => provider.transactions)
    .filter((transaction) => transaction.kind !== "refund" && transaction.createdAt);

  const stamps = payments
    .map((transaction) => Date.parse(transaction.createdAt!))
    .filter((ms) => Number.isFinite(ms));

  const lastPaymentTime = stamps.length ? Math.max(...stamps) : nowMs;
  const trailingHour = stamps.filter((ms) => ms >= nowMs - HOUR_MS).length;

  const biggest = payments.reduce<{ id: string; amount: number } | null>((best, transaction) => {
    const amount = transaction.amountMinor / 100;
    const recent = Date.parse(transaction.createdAt!) >= nowMs - HOUR_MS;
    return recent && (!best || amount > best.amount)
      ? { id: transaction.id, amount }
      : best;
  }, null);

  return {
    rainIntensity: trailingHour,
    // A sunbeam is "somebody big just paid", so it only exists if somebody did.
    sunbeamPlantId: biggest && biggest.amount >= 500 ? biggest.id : null,
    sunbeamAmount: biggest && biggest.amount >= 500 ? biggest.amount : null,
    cloudShadow: false,
    drought: nowMs - lastPaymentTime >= 6 * HOUR_MS,
    season: SEASONS[new Date(nowMs).getMonth()],
    lastPaymentTime,
  };
}

/* ------------------------------------------------------------------ surface */

/**
 * The harvested providers as a garden — or `null` when there is nothing real to
 * draw, which is the signal to serve the sample book instead.
 *
 * A connected provider with no subscriptions is not nothing: RevenueCat quotes
 * its own MRR as a single line, and that is one tree standing for the business.
 * But a connection that returned no priced subscription at all would draw an
 * empty plot, and an empty plot reads as a broken page rather than as a new
 * account — so the sample garden keeps the screen until there is something.
 */
export function harvestToForest(harvest: RevenueHarvest, nowMs = Date.now()): ForestBook | null {
  const { book, ladder } = buildBook(harvest);
  if (!book.length || !ladder.length) return null;

  const currencies = new Set<string>();
  for (const provider of harvest.providers) {
    for (const code of Object.keys(provider.summary.currencyMix)) currencies.add(code);
  }
  const [primary, ...rest] = [...currencies];

  return {
    garden: stateAt(book, nowMs, ladder),
    snapshots: snapshotsFrom(book, nowMs, ladder),
    planCatalogue: ladder,
    weather: weatherFrom(harvest, nowMs),
    source: {
      providers: harvest.providers.map((provider) => provider.providerName),
      subscriptions: book.length,
      currency: primary ?? "USD",
      mixedCurrencies: rest,
      quoted: harvest.providers
        .filter((provider) => provider.provider === "revenuecat" && provider.subscriptions.length)
        .map((provider) => provider.providerName),
      fetchedAt: harvest.fetchedAt,
    },
  };
}
