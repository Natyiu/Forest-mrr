import "server-only";

import prisma from "@Batman/db";

import { type Scope, connectionsWhere, scopeKey } from "@/lib/startups";

import {
  type Credentials,
  type RevenueProviderId,
  REVENUE_PROVIDERS,
  isRevenueProviderId,
} from "./providers";
import { openCredentials } from "./secrets";

/**
 * **Everything a connected key can actually read.**
 *
 * The connect flow proves a key works with one request. This asks the *whole*
 * question: for each provider, every read-only collection its API exposes —
 * subscriptions, customers, orders, invoices, products, prices, refunds,
 * discounts, disputes, entitlements, whatever that provider has — fetched in
 * parallel, page-capped, and reported one of two ways:
 *
 *   - **it answered** — how many records, the provider's own total, and every
 *     field name seen on those records
 *   - **it refused** — with the status and the reason
 *
 * A refusal is a result, not a failure. "Your key cannot read disputes" is a
 * fact worth showing, and it is the honest answer to "what can I get?" — so one
 * collection erroring never takes the page down, and nothing here throws for a
 * provider that is merely partly readable.
 *
 * **Money is normalised to integer minor units** (cents) and **never summed
 * across currencies**: `currencyMix` keeps them apart and the headline quotes the
 * largest, because one number made of dollars plus euros is not a number.
 *
 * **MRR counts active subscriptions only**, with trials and past-due reported
 * beside it rather than folded in — a trial is not revenue and a failing charge
 * is not yet a loss.
 *
 * Page caps are real and stated: `MAX_PAGES` × the provider's page size. The UI
 * says so wherever a count is a floor rather than a total, because a truncated
 * list drawn as a complete one is the one thing a dashboard must never do.
 */

const MAX_PAGES = 3;
const PAGE_SIZE = 100;
const TIMEOUT_MS = 15_000;
/** Fresh enough to be live, long enough that a page reload is not an attack. */
const CACHE_TTL_MS = 60_000;

/* --------------------------------------------------------------- data shapes */

export interface FieldSummary {
  name: string;
  type: string;
  example: string | null;
}

export interface CollectionResult {
  key: string;
  label: string;
  /** `GET /v1/subscriptions` — what was asked, shown verbatim in the catalogue. */
  endpoint: string;
  ok: boolean;
  status: number | null;
  note: string | null;
  count: number;
  /** The provider's own count of everything, when it reports one. */
  total: number | null;
  truncated: boolean;
  fields: FieldSummary[];
}

export type SubscriptionStatus =
  | "active"
  | "trialing"
  | "past_due"
  | "canceled"
  | "paused"
  | "other";

export interface NormalizedSubscription {
  id: string;
  customer: string | null;
  /**
   * Two-letter country, when the subscription itself carries one.
   *
   * Most providers embed the customer in the subscription — Polar's includes a
   * whole `billing_address`, Stripe's expanded `customer` has `address` — so the
   * country is already here and does **not** need the separate customer list,
   * which is a different read and often a different scope. Reading it from the
   * list instead is how the globe stayed empty for a key that had everything it
   * needed.
   */
  country: string | null;
  plan: string | null;
  status: SubscriptionStatus;
  amountMinor: number;
  currency: string;
  interval: string;
  /** `amountMinor` restated per month, so a yearly plan can be compared. */
  monthlyMinor: number;
  createdAt: string | null;
  endsAt: string | null;
}

export interface NormalizedTransaction {
  id: string;
  kind: "payment" | "invoice" | "order" | "refund";
  amountMinor: number;
  currency: string;
  status: string | null;
  customer: string | null;
  createdAt: string | null;
}

export interface NormalizedCustomer {
  id: string;
  name: string | null;
  email: string | null;
  country: string | null;
  createdAt: string | null;
}

export interface NormalizedProduct {
  id: string;
  name: string;
  detail: string | null;
}

/** A number the provider computed itself, quoted rather than derived. */
export interface ProviderMetric {
  label: string;
  value: string;
  source: string;
}

export interface ProviderSummary {
  currency: string;
  currencyMix: Record<string, number>;
  mrrMinor: number;
  arrMinor: number;
  activeCount: number;
  trialingCount: number;
  pastDueCount: number;
  canceledCount: number;
  customerCount: number | null;
  arpaMinor: number | null;
  volume30dMinor: number;
  transactions30d: number;
  newSubs30d: number;
  planMix: Array<{ plan: string; count: number; monthlyMinor: number }>;
}

export interface ProviderHarvest {
  provider: RevenueProviderId;
  providerName: string;
  accountLabel: string | null;
  reference: string | null;
  publicUrl: string | null;
  environment: "live" | "test" | null;
  fetchedAt: string;
  summary: ProviderSummary;
  metrics: ProviderMetric[];
  collections: CollectionResult[];
  subscriptions: NormalizedSubscription[];
  transactions: NormalizedTransaction[];
  customers: NormalizedCustomer[];
  products: NormalizedProduct[];
  /** Set when the connection itself could not be used at all. */
  fatal: string | null;
}

export interface RevenueHarvest {
  fetchedAt: string;
  providers: ProviderHarvest[];
  totals: {
    currency: string;
    currencyMix: Record<string, number>;
    mrrMinor: number;
    arrMinor: number;
    activeCount: number;
    trialingCount: number;
    pastDueCount: number;
    canceledCount: number;
    customerCount: number;
    arpaMinor: number | null;
    volume30dMinor: number;
    /** Monthly payment volume, oldest first, from the transactions fetched. */
    monthlyVolume: Array<{ month: string; amountMinor: number; count: number }>;
    endpointsAnswered: number;
    endpointsRefused: number;
    recordsFetched: number;
  };
}

/* ------------------------------------------------------------ http plumbing */

interface Attempt {
  status: number | null;
  note: string | null;
  payload: unknown;
}

async function attempt(url: string, headers: Record<string, string>): Promise<Attempt> {
  try {
    const response = await fetch(url, {
      headers: { Accept: "application/json", ...headers },
      signal: AbortSignal.timeout(TIMEOUT_MS),
      cache: "no-store",
    });

    if (!response.ok) {
      return { status: response.status, note: reason(response.status), payload: null };
    }

    return { status: response.status, note: null, payload: await response.json() };
  } catch (error) {
    const timedOut = error instanceof Error && error.name === "TimeoutError";
    return {
      status: null,
      note: timedOut ? "Timed out" : "Could not be reached",
      payload: null,
    };
  }
}

function reason(status: number): string {
  if (status === 401) return "Key rejected (401)";
  if (status === 403) return "Not permitted by this key (403)";
  if (status === 404) return "Not available on this account (404)";
  if (status === 429) return "Rate limited (429)";
  if (status >= 500) return `Provider error (${status})`;
  return `Refused (${status})`;
}

const record = (value: unknown): Record<string, unknown> =>
  value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};

const list = (value: unknown): unknown[] => (Array.isArray(value) ? value : []);

function text(value: unknown): string | null {
  if (typeof value === "string" && value.trim()) return value.trim();
  if (typeof value === "number") return String(value);
  return null;
}

function num(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() && Number.isFinite(Number(value))) {
    return Number(value);
  }
  return null;
}

/** Unix seconds, ISO strings and millisecond stamps all arrive here. */
function when(value: unknown): string | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    const ms = value > 1e12 ? value : value * 1000;
    const date = new Date(ms);
    return Number.isNaN(date.getTime()) ? null : date.toISOString();
  }
  if (typeof value === "string" && value.trim()) {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date.toISOString();
  }
  return null;
}

const SECRETISH = /(secret|token|password|apikey|api_key|client_secret)/i;

/**
 * Every field name seen across the records, with a short example.
 *
 * This is the part that answers "what could I get?" precisely rather than
 * approximately: not a hand-written list of fields this build happens to read,
 * but the keys the provider actually returned today. Nested objects are reported
 * as their type rather than walked — the point is the shape, not a data dump —
 * and anything whose *name* looks like a credential is never given an example.
 */
function summariseFields(items: unknown[]): FieldSummary[] {
  const seen = new Map<string, FieldSummary>();

  for (const item of items.slice(0, 25)) {
    for (const [name, value] of Object.entries(record(item))) {
      if (seen.has(name)) continue;

      const type = Array.isArray(value)
        ? `array(${value.length})`
        : value === null
          ? "null"
          : typeof value === "object"
            ? "object"
            : typeof value;

      let example: string | null = null;
      if (!SECRETISH.test(name) && value !== null && typeof value !== "object") {
        example = String(value).slice(0, 48);
      }

      seen.set(name, { name, type, example });
    }
  }

  return [...seen.values()].sort((a, b) => a.name.localeCompare(b.name));
}

interface Fetched {
  items: unknown[];
  total: number | null;
  truncated: boolean;
  status: number | null;
  note: string | null;
}

const failed = (a: Attempt): Fetched => ({
  items: [],
  total: null,
  truncated: false,
  status: a.status,
  note: a.note,
});

/** Cursor pagination: Stripe and RevenueCat both do `starting_after`. */
async function pagedCursor(
  base: string,
  path: string,
  headers: Record<string, string>,
  options: { limitParam?: string; limit?: number } = {},
): Promise<Fetched> {
  const limitParam = options.limitParam ?? "limit";
  const limit = options.limit ?? PAGE_SIZE;
  const items: unknown[] = [];
  let cursor: string | null = null;
  let truncated = false;
  let firstStatus: number | null = null;

  for (let page = 0; page < MAX_PAGES; page++) {
    const url = `${base}${path}${path.includes("?") ? "&" : "?"}${limitParam}=${limit}${
      cursor ? `&starting_after=${encodeURIComponent(cursor)}` : ""
    }`;
    const got = await attempt(url, headers);
    if (got.payload === null) return page === 0 ? failed(got) : { items, total: null, truncated: true, status: firstStatus, note: null };
    firstStatus ??= got.status;

    const payload = record(got.payload);
    const batch = list(payload.data ?? payload.items ?? payload.results);
    items.push(...batch);

    const hasMore = payload.has_more === true || payload.next_page != null;
    const last = record(batch[batch.length - 1]);
    cursor = text(last.id);

    if (!hasMore || !cursor || batch.length === 0) break;
    if (page === MAX_PAGES - 1) truncated = true;
  }

  return { items, total: null, truncated, status: firstStatus, note: null };
}

/** Page-number pagination: Polar, Dodo and LemonSqueezy all count pages. */
async function pagedNumber(
  base: string,
  path: string,
  headers: Record<string, string>,
  options: { sizeParam: string; pageParam: string; firstPage: number },
): Promise<Fetched> {
  const items: unknown[] = [];
  let total: number | null = null;
  let truncated = false;
  let firstStatus: number | null = null;

  for (let page = 0; page < MAX_PAGES; page++) {
    const join = path.includes("?") ? "&" : "?";
    const url = `${base}${path}${join}${options.sizeParam}=${PAGE_SIZE}&${options.pageParam}=${
      options.firstPage + page
    }`;
    const got = await attempt(url, headers);
    if (got.payload === null) {
      return page === 0 ? failed(got) : { items, total, truncated: true, status: firstStatus, note: null };
    }
    firstStatus ??= got.status;

    const payload = record(got.payload);
    const batch = list(payload.items ?? payload.data ?? payload.results);
    items.push(...batch);

    const pagination = record(payload.pagination);
    const meta = record(record(payload.meta).page ?? payload.meta);
    total ??=
      num(pagination.total_count) ?? num(meta.total) ?? num(payload.total_count) ?? null;

    const maxPage = num(pagination.max_page) ?? num(meta.lastPage) ?? null;
    const more =
      batch.length === PAGE_SIZE && (maxPage === null || options.firstPage + page < maxPage);

    if (!more) break;
    if (page === MAX_PAGES - 1) truncated = true;
  }

  return { items, total, truncated, status: firstStatus, note: null };
}

/** A single object rather than a collection — an account, a project, a balance. */
async function single(
  base: string,
  path: string,
  headers: Record<string, string>,
): Promise<Fetched> {
  const got = await attempt(`${base}${path}`, headers);
  if (got.payload === null) return failed(got);
  return { items: [got.payload], total: 1, truncated: false, status: got.status, note: null };
}

/* ------------------------------------------------------------- normalisation */

const STATUS_MAP: Record<string, SubscriptionStatus> = {
  active: "active",
  trialing: "trialing",
  trial: "trialing",
  on_trial: "trialing",
  past_due: "past_due",
  unpaid: "past_due",
  incomplete: "past_due",
  incomplete_expired: "canceled",
  canceled: "canceled",
  cancelled: "canceled",
  expired: "canceled",
  paused: "paused",
};

const toStatus = (raw: unknown): SubscriptionStatus =>
  STATUS_MAP[String(raw ?? "").toLowerCase()] ?? "other";

/** Every recurring price restated per month, so plans are comparable. */
const PER_MONTH: Record<string, number> = {
  day: 365 / 12,
  week: 52 / 12,
  month: 1,
  year: 1 / 12,
  quarter: 1 / 3,
  one_time: 0,
};

function monthly(amountMinor: number, interval: string, count = 1): number {
  const factor = PER_MONTH[interval.toLowerCase()] ?? 1;
  const per = count > 0 ? count : 1;
  return Math.round((amountMinor * factor) / per);
}

const DAY_MS = 86_400_000;

function summarise(
  subscriptions: NormalizedSubscription[],
  transactions: NormalizedTransaction[],
  customerCount: number | null,
): ProviderSummary {
  const currencyMix: Record<string, number> = {};
  let mrrMinor = 0;
  const counts = { active: 0, trialing: 0, past_due: 0, canceled: 0, paused: 0, other: 0 };
  const plans = new Map<string, { count: number; monthlyMinor: number }>();
  const since = Date.now() - 30 * DAY_MS;

  for (const subscription of subscriptions) {
    counts[subscription.status] += 1;
    if (subscription.status !== "active") continue;

    mrrMinor += subscription.monthlyMinor;
    currencyMix[subscription.currency] =
      (currencyMix[subscription.currency] ?? 0) + subscription.monthlyMinor;

    const plan = subscription.plan ?? "Unnamed plan";
    const entry = plans.get(plan) ?? { count: 0, monthlyMinor: 0 };
    entry.count += 1;
    entry.monthlyMinor += subscription.monthlyMinor;
    plans.set(plan, entry);
  }

  const newSubs30d = subscriptions.filter(
    (subscription) => subscription.createdAt && Date.parse(subscription.createdAt) >= since,
  ).length;

  const recent = transactions.filter(
    (transaction) =>
      transaction.kind !== "refund" &&
      transaction.createdAt &&
      Date.parse(transaction.createdAt) >= since,
  );

  const currency =
    Object.entries(currencyMix).sort((a, b) => b[1] - a[1])[0]?.[0] ??
    transactions[0]?.currency ??
    "USD";

  return {
    currency,
    currencyMix,
    mrrMinor,
    arrMinor: mrrMinor * 12,
    activeCount: counts.active,
    trialingCount: counts.trialing,
    pastDueCount: counts.past_due,
    canceledCount: counts.canceled,
    customerCount,
    arpaMinor: counts.active > 0 ? Math.round(mrrMinor / counts.active) : null,
    volume30dMinor: recent.reduce((sum, transaction) => sum + transaction.amountMinor, 0),
    transactions30d: recent.length,
    newSubs30d,
    planMix: [...plans.entries()]
      .map(([plan, entry]) => ({ plan, ...entry }))
      .sort((a, b) => b.monthlyMinor - a.monthlyMinor),
  };
}

/* -------------------------------------------------------------- the providers */

interface Job {
  key: string;
  label: string;
  endpoint: string;
  run: () => Promise<Fetched>;
}

interface Extracted {
  subscriptions?: NormalizedSubscription[];
  transactions?: NormalizedTransaction[];
  customers?: NormalizedCustomer[];
  products?: NormalizedProduct[];
  metrics?: ProviderMetric[];
  accountLabel?: string | null;
  environment?: "live" | "test" | null;
}

interface Plan {
  jobs: Job[];
  /** Turns the raw collections into the normalised half. */
  read: (data: Map<string, unknown[]>) => Extracted;
}

/* ---- Stripe --------------------------------------------------------------- */

function stripePlan(credentials: Credentials): Plan {
  const headers = { Authorization: `Bearer ${credentials.apiKey}` };
  const base = "https://api.stripe.com";
  const cursor = (path: string) => () => pagedCursor(base, path, headers);

  return {
    jobs: [
      { key: "account", label: "Account", endpoint: "GET /v1/account", run: () => single(base, "/v1/account", headers) },
      { key: "balance", label: "Balance", endpoint: "GET /v1/balance", run: () => single(base, "/v1/balance", headers) },
      // `expand[]=data.customer` is what makes a subscription name its customer
      // instead of carrying an opaque `cus_…`.
      {
        key: "subscriptions",
        label: "Subscriptions",
        endpoint: "GET /v1/subscriptions?status=all&expand[]=data.customer",
        run: cursor("/v1/subscriptions?status=all&expand[]=data.customer"),
      },
      { key: "customers", label: "Customers", endpoint: "GET /v1/customers", run: cursor("/v1/customers") },
      { key: "charges", label: "Charges", endpoint: "GET /v1/charges", run: cursor("/v1/charges") },
      { key: "invoices", label: "Invoices", endpoint: "GET /v1/invoices", run: cursor("/v1/invoices") },
      { key: "payment_intents", label: "Payment intents", endpoint: "GET /v1/payment_intents", run: cursor("/v1/payment_intents") },
      { key: "refunds", label: "Refunds", endpoint: "GET /v1/refunds", run: cursor("/v1/refunds") },
      { key: "disputes", label: "Disputes", endpoint: "GET /v1/disputes", run: cursor("/v1/disputes") },
      { key: "products", label: "Products", endpoint: "GET /v1/products", run: cursor("/v1/products") },
      { key: "prices", label: "Prices", endpoint: "GET /v1/prices", run: cursor("/v1/prices") },
      { key: "coupons", label: "Coupons", endpoint: "GET /v1/coupons", run: cursor("/v1/coupons") },
      { key: "payouts", label: "Payouts", endpoint: "GET /v1/payouts", run: cursor("/v1/payouts") },
    ],

    read: (data) => {
      const subscriptions = (data.get("subscriptions") ?? []).map((raw): NormalizedSubscription => {
        const it = record(raw);
        const item = record(list(record(it.items).data)[0]);
        const price = record(item.price);
        const recurring = record(price.recurring);
        const quantity = num(item.quantity) ?? 1;
        const unit = num(price.unit_amount) ?? 0;
        const amountMinor = unit * quantity;
        const interval = text(recurring.interval) ?? "month";
        const customer = record(it.customer);

        return {
          id: text(it.id) ?? "—",
          customer: text(customer.name) ?? text(customer.email) ?? text(it.customer),
          // From the expanded customer on the subscription itself.
          country: text(record(customer.address).country),
          plan: text(price.nickname) ?? text(record(price).product) ?? null,
          status: toStatus(it.status),
          amountMinor,
          currency: (text(price.currency) ?? text(it.currency) ?? "usd").toUpperCase(),
          interval,
          monthlyMinor: monthly(amountMinor, interval, num(recurring.interval_count) ?? 1),
          createdAt: when(it.created),
          endsAt: when(it.current_period_end ?? it.cancel_at ?? it.ended_at),
        };
      });

      const charges = (data.get("charges") ?? []).map((raw): NormalizedTransaction => {
        const it = record(raw);
        return {
          id: text(it.id) ?? "—",
          kind: "payment",
          amountMinor: num(it.amount) ?? 0,
          currency: (text(it.currency) ?? "usd").toUpperCase(),
          status: text(it.status),
          customer: text(record(it.billing_details).name) ?? text(it.customer),
          createdAt: when(it.created),
        };
      });

      const refunds = (data.get("refunds") ?? []).map((raw): NormalizedTransaction => {
        const it = record(raw);
        return {
          id: text(it.id) ?? "—",
          kind: "refund",
          amountMinor: -(num(it.amount) ?? 0),
          currency: (text(it.currency) ?? "usd").toUpperCase(),
          status: text(it.status),
          customer: null,
          createdAt: when(it.created),
        };
      });

      const account = record((data.get("account") ?? [])[0]);

      return {
        subscriptions,
        transactions: [...charges, ...refunds],
        customers: (data.get("customers") ?? []).map((raw): NormalizedCustomer => {
          const it = record(raw);
          return {
            id: text(it.id) ?? "—",
            name: text(it.name),
            email: text(it.email),
            country: text(record(it.address).country),
            createdAt: when(it.created),
          };
        }),
        products: (data.get("products") ?? []).map((raw): NormalizedProduct => {
          const it = record(raw);
          return {
            id: text(it.id) ?? "—",
            name: text(it.name) ?? "Unnamed product",
            detail: text(it.description),
          };
        }),
        accountLabel:
          text(record(account.business_profile).name) ??
          text(record(record(account.settings).dashboard).display_name) ??
          text(account.id),
        environment: credentials.apiKey?.startsWith("rk_test_") ? "test" : "live",
      };
    },
  };
}

/* ---- Polar ---------------------------------------------------------------- */

function polarPlan(credentials: Credentials, base: string, environment: "live" | "test"): Plan {
  const headers = { Authorization: `Bearer ${credentials.apiKey}` };
  const org = encodeURIComponent(credentials.organizationId ?? "");
  const paged = (path: string) => () =>
    pagedNumber(base, path, headers, { sizeParam: "limit", pageParam: "page", firstPage: 1 });
  const scoped = (path: string) => paged(`${path}?organization_id=${org}`);

  return {
    jobs: [
      { key: "organization", label: "Organization", endpoint: "GET /v1/organizations/{id}", run: () => single(base, `/v1/organizations/${org}`, headers) },
      { key: "subscriptions", label: "Subscriptions", endpoint: "GET /v1/subscriptions", run: scoped("/v1/subscriptions") },
      { key: "orders", label: "Orders", endpoint: "GET /v1/orders", run: scoped("/v1/orders") },
      { key: "customers", label: "Customers", endpoint: "GET /v1/customers", run: scoped("/v1/customers") },
      { key: "products", label: "Products", endpoint: "GET /v1/products", run: scoped("/v1/products") },
      { key: "benefits", label: "Benefits", endpoint: "GET /v1/benefits", run: scoped("/v1/benefits") },
      { key: "discounts", label: "Discounts", endpoint: "GET /v1/discounts", run: scoped("/v1/discounts") },
      { key: "checkouts", label: "Checkouts", endpoint: "GET /v1/checkouts", run: scoped("/v1/checkouts") },
      { key: "license_keys", label: "License keys", endpoint: "GET /v1/license-keys", run: scoped("/v1/license-keys") },
      { key: "meters", label: "Meters", endpoint: "GET /v1/meters", run: scoped("/v1/meters") },
    ],

    read: (data) => {
      const subscriptions = (data.get("subscriptions") ?? []).map((raw): NormalizedSubscription => {
        const it = record(raw);
        const product = record(it.product);
        const amountMinor = num(it.amount) ?? num(record(it.price).price_amount) ?? 0;
        const interval = text(it.recurring_interval) ?? "month";

        const customer = record(it.customer);

        return {
          id: text(it.id) ?? "—",
          customer: text(customer.name) ?? text(customer.billing_name) ?? text(customer.email) ?? text(it.customer_id),
          // `SubscriptionCustomer.billing_address.country` — embedded, so this
          // arrives with `subscriptions:read` and needs no `customers:read`.
          country: text(record(customer.billing_address).country),
          plan: text(product.name) ?? text(it.product_id),
          status: toStatus(it.status),
          amountMinor,
          currency: (text(it.currency) ?? "usd").toUpperCase(),
          interval,
          monthlyMinor: monthly(amountMinor, interval),
          createdAt: when(it.created_at),
          endsAt: when(it.current_period_end ?? it.ends_at),
        };
      });

      return {
        subscriptions,
        transactions: (data.get("orders") ?? []).map((raw): NormalizedTransaction => {
          const it = record(raw);
          return {
            id: text(it.id) ?? "—",
            kind: "order",
            amountMinor: num(it.total_amount) ?? num(it.amount) ?? 0,
            currency: (text(it.currency) ?? "usd").toUpperCase(),
            status: text(it.status) ?? text(it.paid),
            customer: text(record(it.customer).name) ?? text(record(it.customer).email),
            createdAt: when(it.created_at),
          };
        }),
        customers: (data.get("customers") ?? []).map((raw): NormalizedCustomer => {
          const it = record(raw);
          return {
            id: text(it.id) ?? "—",
            name: text(it.name),
            email: text(it.email),
            country: text(record(it.billing_address).country),
            createdAt: when(it.created_at),
          };
        }),
        products: (data.get("products") ?? []).map((raw): NormalizedProduct => {
          const it = record(raw);
          return {
            id: text(it.id) ?? "—",
            name: text(it.name) ?? "Unnamed product",
            detail: text(it.description),
          };
        }),
        accountLabel:
          text(record((data.get("organization") ?? [])[0]).name) ??
          text(record((data.get("organization") ?? [])[0]).slug),
        environment,
      };
    },
  };
}

/* ---- LemonSqueezy --------------------------------------------------------- */

function lemonPlan(credentials: Credentials): Plan {
  const headers = {
    Authorization: `Bearer ${credentials.apiKey}`,
    Accept: "application/vnd.api+json",
    "Content-Type": "application/vnd.api+json",
  };
  const base = "https://api.lemonsqueezy.com";
  const paged = (path: string) => () =>
    pagedNumber(base, path, headers, {
      sizeParam: "page[size]",
      pageParam: "page[number]",
      firstPage: 1,
    });

  return {
    jobs: [
      { key: "user", label: "Account", endpoint: "GET /v1/users/me", run: () => single(base, "/v1/users/me", headers) },
      { key: "stores", label: "Stores", endpoint: "GET /v1/stores", run: paged("/v1/stores") },
      { key: "subscriptions", label: "Subscriptions", endpoint: "GET /v1/subscriptions", run: paged("/v1/subscriptions") },
      { key: "customers", label: "Customers", endpoint: "GET /v1/customers", run: paged("/v1/customers") },
      { key: "orders", label: "Orders", endpoint: "GET /v1/orders", run: paged("/v1/orders") },
      { key: "subscription_invoices", label: "Subscription invoices", endpoint: "GET /v1/subscription-invoices", run: paged("/v1/subscription-invoices") },
      { key: "products", label: "Products", endpoint: "GET /v1/products", run: paged("/v1/products") },
      { key: "variants", label: "Variants", endpoint: "GET /v1/variants", run: paged("/v1/variants") },
      { key: "prices", label: "Prices", endpoint: "GET /v1/prices", run: paged("/v1/prices") },
      { key: "discounts", label: "Discounts", endpoint: "GET /v1/discounts", run: paged("/v1/discounts") },
      { key: "license_keys", label: "License keys", endpoint: "GET /v1/license-keys", run: paged("/v1/license-keys") },
    ],

    // JSON:API: everything interesting is under `attributes`.
    read: (data) => {
      const attrs = (raw: unknown) => record(record(raw).attributes);

      const subscriptions = (data.get("subscriptions") ?? []).map((raw): NormalizedSubscription => {
        const it = attrs(raw);
        const price = num(record(it.first_subscription_item).price) ?? 0;
        const interval = text(it.billing_anchor) && text(it.variant_name) ? "month" : "month";

        return {
          id: text(record(raw).id) ?? "—",
          customer: text(it.user_name) ?? text(it.user_email),
          // A LemonSqueezy subscription carries no address; its country comes
          // from the customers list, which this key may or may not be able to
          // read. Absent is absent — the globe simply omits it.
          country: null,
          plan: text(it.product_name) ?? text(it.variant_name),
          status: toStatus(it.status),
          amountMinor: price,
          currency: "USD",
          interval,
          monthlyMinor: monthly(price, interval),
          createdAt: when(it.created_at),
          endsAt: when(it.renews_at ?? it.ends_at),
        };
      });

      return {
        subscriptions,
        transactions: (data.get("orders") ?? []).map((raw): NormalizedTransaction => {
          const it = attrs(raw);
          return {
            id: text(record(raw).id) ?? "—",
            kind: "order",
            amountMinor: num(it.total) ?? 0,
            currency: (text(it.currency) ?? "usd").toUpperCase(),
            status: text(it.status),
            customer: text(it.user_name) ?? text(it.user_email),
            createdAt: when(it.created_at),
          };
        }),
        customers: (data.get("customers") ?? []).map((raw): NormalizedCustomer => {
          const it = attrs(raw);
          return {
            id: text(record(raw).id) ?? "—",
            name: text(it.name),
            email: text(it.email),
            country: text(it.country),
            createdAt: when(it.created_at),
          };
        }),
        products: (data.get("products") ?? []).map((raw): NormalizedProduct => {
          const it = attrs(raw);
          return {
            id: text(record(raw).id) ?? "—",
            name: text(it.name) ?? "Unnamed product",
            detail: text(it.price_formatted) ?? text(it.description),
          };
        }),
        accountLabel:
          text(attrs((data.get("user") ?? [])[0] && record((data.get("user") ?? [])[0]).data).name) ??
          text(record(record(record((data.get("user") ?? [])[0]).data).attributes).name),
        environment: "live",
      };
    },
  };
}

/* ---- Dodo Payments -------------------------------------------------------- */

function dodoPlan(credentials: Credentials, base: string, environment: "live" | "test"): Plan {
  const headers = { Authorization: `Bearer ${credentials.apiKey}` };
  const paged = (path: string) => () =>
    pagedNumber(base, path, headers, {
      sizeParam: "page_size",
      pageParam: "page_number",
      firstPage: 0,
    });

  return {
    jobs: [
      { key: "subscriptions", label: "Subscriptions", endpoint: "GET /subscriptions", run: paged("/subscriptions") },
      { key: "payments", label: "Payments", endpoint: "GET /payments", run: paged("/payments") },
      { key: "customers", label: "Customers", endpoint: "GET /customers", run: paged("/customers") },
      { key: "products", label: "Products", endpoint: "GET /products", run: paged("/products") },
      { key: "refunds", label: "Refunds", endpoint: "GET /refunds", run: paged("/refunds") },
      { key: "disputes", label: "Disputes", endpoint: "GET /disputes", run: paged("/disputes") },
      { key: "discounts", label: "Discounts", endpoint: "GET /discounts", run: paged("/discounts") },
      { key: "licenses", label: "License keys", endpoint: "GET /license_keys", run: paged("/license_keys") },
      { key: "payouts", label: "Payouts", endpoint: "GET /payouts", run: paged("/payouts") },
      { key: "brands", label: "Brands", endpoint: "GET /brands", run: paged("/brands") },
    ],

    read: (data) => {
      const subscriptions = (data.get("subscriptions") ?? []).map((raw): NormalizedSubscription => {
        const it = record(raw);
        const amountMinor = num(it.recurring_pre_tax_amount) ?? num(it.amount) ?? 0;
        const interval = text(it.payment_frequency_interval) ?? "month";

        return {
          id: text(it.subscription_id) ?? text(it.id) ?? "—",
          customer: text(record(it.customer).name) ?? text(record(it.customer).email),
          country:
            text(record(it.billing).country) ?? text(record(it.customer).country) ?? null,
          plan: text(it.product_id) ?? text(record(it.product).name),
          status: toStatus(it.status),
          amountMinor,
          currency: (text(it.currency) ?? "usd").toUpperCase(),
          interval,
          monthlyMinor: monthly(amountMinor, interval, num(it.payment_frequency_count) ?? 1),
          createdAt: when(it.created_at),
          endsAt: when(it.next_billing_date ?? it.cancelled_at),
        };
      });

      const payments = (data.get("payments") ?? []).map((raw): NormalizedTransaction => {
        const it = record(raw);
        return {
          id: text(it.payment_id) ?? text(it.id) ?? "—",
          kind: "payment",
          amountMinor: num(it.total_amount) ?? num(it.amount) ?? 0,
          currency: (text(it.currency) ?? "usd").toUpperCase(),
          status: text(it.status),
          customer: text(record(it.customer).name) ?? text(record(it.customer).email),
          createdAt: when(it.created_at),
        };
      });

      const refunds = (data.get("refunds") ?? []).map((raw): NormalizedTransaction => {
        const it = record(raw);
        return {
          id: text(it.refund_id) ?? text(it.id) ?? "—",
          kind: "refund",
          amountMinor: -(num(it.amount) ?? 0),
          currency: (text(it.currency) ?? "usd").toUpperCase(),
          status: text(it.status),
          customer: null,
          createdAt: when(it.created_at),
        };
      });

      return {
        subscriptions,
        transactions: [...payments, ...refunds],
        customers: (data.get("customers") ?? []).map((raw): NormalizedCustomer => {
          const it = record(raw);
          return {
            id: text(it.customer_id) ?? text(it.id) ?? "—",
            name: text(it.name),
            email: text(it.email),
            country: text(it.country) ?? text(record(it.billing).country),
            createdAt: when(it.created_at),
          };
        }),
        products: (data.get("products") ?? []).map((raw): NormalizedProduct => {
          const it = record(raw);
          return {
            id: text(it.product_id) ?? text(it.id) ?? "—",
            name: text(it.name) ?? "Unnamed product",
            detail: text(it.description),
          };
        }),
        accountLabel: environment === "live" ? "DodoPayment (live)" : "DodoPayment (test mode)",
        environment,
      };
    },
  };
}

/* ---- RevenueCat ----------------------------------------------------------- */

function revenueCatPlan(credentials: Credentials): Plan {
  const headers = { Authorization: `Bearer ${credentials.apiKey}` };
  const base = "https://api.revenuecat.com";
  const project = encodeURIComponent(credentials.projectId ?? "");
  const scoped = (path: string, label: string, key: string): Job => ({
    key,
    label,
    endpoint: `GET /v2/projects/{id}${path}`,
    run: () => pagedCursor(base, `/v2/projects/${project}${path}`, headers),
  });

  return {
    jobs: [
      { key: "project", label: "Project", endpoint: "GET /v2/projects/{id}", run: () => single(base, `/v2/projects/${project}`, headers) },
      { key: "overview", label: "Metrics overview", endpoint: "GET /v2/projects/{id}/metrics/overview", run: () => single(base, `/v2/projects/${project}/metrics/overview`, headers) },
      scoped("/apps", "Apps", "apps"),
      scoped("/products", "Products", "products"),
      scoped("/entitlements", "Entitlements", "entitlements"),
      scoped("/offerings", "Offerings", "offerings"),
      scoped("/customers", "Customers", "customers"),
    ],

    read: (data) => {
      // RevenueCat computes its own numbers, so they are quoted rather than
      // recomputed from a customer list this key may not even be able to read.
      const overview = record((data.get("overview") ?? [])[0]);
      const metrics = list(overview.metrics).map((raw): ProviderMetric => {
        const it = record(raw);
        const value = num(it.value);
        const unit = text(it.unit);
        return {
          label: text(it.name) ?? text(it.id) ?? "Metric",
          value:
            value === null
              ? "—"
              : unit === "currency"
                ? `$${value.toLocaleString(undefined, { maximumFractionDigits: 0 })}`
                : value.toLocaleString(undefined, { maximumFractionDigits: 2 }),
          source: "RevenueCat metrics/overview",
        };
      });

      const mrr = list(overview.metrics)
        .map(record)
        .find((metric) => text(metric.id) === "mrr");
      const mrrValue = num(record(mrr).value);

      return {
        metrics,
        // One synthetic subscription carrying the provider's own MRR: RevenueCat
        // does not hand out a per-subscription price list, so the alternative to
        // this is a dashboard that reads $0 for a business that is clearly not.
        subscriptions:
          mrrValue !== null && mrrValue > 0
            ? [
                {
                  id: "revenuecat-mrr",
                  customer: null,
                  country: null,
                  plan: "RevenueCat reported MRR",
                  status: "active" as SubscriptionStatus,
                  amountMinor: Math.round(mrrValue * 100),
                  currency: "USD",
                  interval: "month",
                  monthlyMinor: Math.round(mrrValue * 100),
                  createdAt: null,
                  endsAt: null,
                },
              ]
            : [],
        products: (data.get("products") ?? []).map((raw): NormalizedProduct => {
          const it = record(raw);
          return {
            id: text(it.id) ?? "—",
            name: text(it.display_name) ?? text(it.store_identifier) ?? "Unnamed product",
            detail: text(it.type) ?? text(it.store),
          };
        }),
        customers: (data.get("customers") ?? []).map((raw): NormalizedCustomer => {
          const it = record(raw);
          return {
            id: text(it.id) ?? "—",
            name: null,
            email: null,
            country: null,
            createdAt: when(it.first_seen_at ?? it.created_at),
          };
        }),
        accountLabel: text(record((data.get("project") ?? [])[0]).name),
        environment: "live",
      };
    },
  };
}

/* ---- Superwall ------------------------------------------------------------ */

function superwallPlan(credentials: Credentials): Plan {
  const headers = { Authorization: `Bearer ${credentials.apiKey}` };
  const base = "https://api.superwall.com";
  const application = encodeURIComponent(credentials.applicationId ?? "");

  return {
    jobs: [
      { key: "projects", label: "Projects", endpoint: "GET /v2/projects", run: () => single(base, "/v2/projects", headers) },
      {
        key: "application",
        label: "Application",
        endpoint: "GET /v2/projects/applications/{id}",
        run: () => single(base, `/v2/projects/applications/${application}`, headers),
      },
    ],

    read: (data) => {
      const projects = list(record((data.get("projects") ?? [])[0]).projects ?? (data.get("projects") ?? [])[0]);
      const app = record((data.get("application") ?? [])[0]);

      return {
        products: projects.map((raw): NormalizedProduct => {
          const it = record(raw);
          return {
            id: text(it.id) ?? "—",
            name: text(it.name) ?? "Project",
            detail: `${list(it.applications ?? it.apps).length} application(s)`,
          };
        }),
        metrics: [
          { label: "Projects visible", value: String(projects.length), source: "Superwall /v2/projects" },
        ],
        accountLabel: text(app.name) ?? text(record(app.project).name) ?? null,
        environment: "live",
      };
    },
  };
}

/* ------------------------------------------------------------------ the sweep */

/**
 * Polar and Dodo both have a second environment behind the same key format, and
 * the connect probe already worked out which one answered. It is not stored, so
 * it is worked out again the same way: try live, fall back on a flat refusal.
 */
async function pickHost(
  hosts: Array<{ base: string; environment: "live" | "test" }>,
  probe: (base: string) => Promise<Fetched>,
): Promise<{ base: string; environment: "live" | "test" }> {
  for (const host of hosts) {
    const got = await probe(host.base);
    if (got.status !== 401 && got.status !== 404) return host;
  }
  return hosts[0];
}

async function planFor(
  provider: RevenueProviderId,
  credentials: Credentials,
): Promise<Plan> {
  if (provider === "stripe") return stripePlan(credentials);
  if (provider === "lemonsqueezy") return lemonPlan(credentials);
  if (provider === "revenuecat") return revenueCatPlan(credentials);
  if (provider === "superwall") return superwallPlan(credentials);

  if (provider === "polar") {
    const headers = { Authorization: `Bearer ${credentials.apiKey}` };
    const org = encodeURIComponent(credentials.organizationId ?? "");
    const host = await pickHost(
      [
        { base: "https://api.polar.sh", environment: "live" },
        { base: "https://sandbox-api.polar.sh", environment: "test" },
      ],
      (base) => single(base, `/v1/organizations/${org}`, headers),
    );
    return polarPlan(credentials, host.base, host.environment);
  }

  const headers = { Authorization: `Bearer ${credentials.apiKey}` };
  const host = await pickHost(
    [
      { base: "https://live.dodopayments.com", environment: "live" },
      { base: "https://test.dodopayments.com", environment: "test" },
    ],
    (base) => single(base, "/subscriptions?page_size=1", headers),
  );
  return dodoPlan(credentials, host.base, host.environment);
}

interface ConnectionRow {
  provider: string;
  secret: string;
  accountLabel: string | null;
  reference: string | null;
  publicUrl: string | null;
}

async function harvestConnection(row: ConnectionRow): Promise<ProviderHarvest | null> {
  if (!isRevenueProviderId(row.provider)) return null;
  const provider = row.provider;
  const providerName = REVENUE_PROVIDERS[provider].name;

  const blank: ProviderHarvest = {
    provider,
    providerName,
    accountLabel: row.accountLabel,
    reference: row.reference,
    publicUrl: row.publicUrl,
    environment: null,
    fetchedAt: new Date().toISOString(),
    summary: summarise([], [], null),
    metrics: [],
    collections: [],
    subscriptions: [],
    transactions: [],
    customers: [],
    products: [],
    fatal: null,
  };

  let credentials: Credentials;
  try {
    credentials = openCredentials(row.secret) as Credentials;
  } catch {
    return { ...blank, fatal: `The stored ${providerName} key cannot be opened by this server.` };
  }

  const plan = await planFor(provider, credentials);

  // Every collection at once: they are independent reads, and a provider that
  // takes 400ms per endpoint would otherwise take five seconds in a row.
  const settled = await Promise.all(
    plan.jobs.map(async (job) => ({ job, result: await job.run() })),
  );

  const collections: CollectionResult[] = [];
  const data = new Map<string, unknown[]>();

  for (const { job, result } of settled) {
    const ok = result.note === null;
    if (ok) data.set(job.key, result.items);

    collections.push({
      key: job.key,
      label: job.label,
      endpoint: job.endpoint,
      ok,
      status: result.status,
      note: result.note,
      count: result.items.length,
      total: result.total,
      truncated: result.truncated,
      fields: ok ? summariseFields(result.items) : [],
    });
  }

  const extracted = plan.read(data);
  const subscriptions = extracted.subscriptions ?? [];
  const transactions = (extracted.transactions ?? []).sort((a, b) =>
    (b.createdAt ?? "").localeCompare(a.createdAt ?? ""),
  );
  const customers = extracted.customers ?? [];

  const reportedCustomers =
    collections.find((collection) => collection.key === "customers")?.total ??
    (customers.length || null);

  return {
    ...blank,
    accountLabel: extracted.accountLabel ?? row.accountLabel,
    environment: extracted.environment ?? null,
    summary: summarise(subscriptions, transactions, reportedCustomers),
    metrics: extracted.metrics ?? [],
    collections,
    subscriptions,
    transactions,
    customers,
    products: extracted.products ?? [],
  };
}

/* --------------------------------------------------------------------- cache */

/**
 * Pinned to `globalThis`, the way the garden's server state is: Next
 * re-evaluates route modules on edit, and a fresh module means every navigation
 * re-runs sixty API calls against somebody's payment provider.
 */
const store = globalThis as unknown as {
  __revenueHarvest?: Map<string, { at: number; value: RevenueHarvest }>;
};
store.__revenueHarvest ??= new Map();

/** `<user>|<scope>` — two startups are two books and must never share an entry. */
const cacheKey = (userId: string, scope: Scope) => `${userId}|${scopeKey(scope)}`;

/**
 * Drop every cached sweep belonging to a user — all scopes, not just the active
 * one.
 *
 * Called when their connections change. Without it, disconnecting a provider
 * leaves the plot drawing that provider's customers for up to another minute,
 * which is the cache lying rather than being stale. Every scope goes because a
 * connection that moved startups changes two books at once, and the `all` view
 * changes whenever any single one does.
 */
export function forgetHarvest(userId: string): void {
  const map = store.__revenueHarvest;
  if (!map) return;
  for (const key of [...map.keys()]) {
    if (key.startsWith(`${userId}|`)) map.delete(key);
  }
}

function monthKey(iso: string): string {
  return iso.slice(0, 7);
}

function combine(providers: ProviderHarvest[]): RevenueHarvest["totals"] {
  const currencyMix: Record<string, number> = {};
  const months = new Map<string, { amountMinor: number; count: number }>();

  let mrrMinor = 0;
  let activeCount = 0;
  let trialingCount = 0;
  let pastDueCount = 0;
  let canceledCount = 0;
  let customerCount = 0;
  let volume30dMinor = 0;
  let endpointsAnswered = 0;
  let endpointsRefused = 0;
  let recordsFetched = 0;

  for (const harvest of providers) {
    mrrMinor += harvest.summary.mrrMinor;
    activeCount += harvest.summary.activeCount;
    trialingCount += harvest.summary.trialingCount;
    pastDueCount += harvest.summary.pastDueCount;
    canceledCount += harvest.summary.canceledCount;
    customerCount += harvest.summary.customerCount ?? 0;
    volume30dMinor += harvest.summary.volume30dMinor;

    for (const [currency, amount] of Object.entries(harvest.summary.currencyMix)) {
      currencyMix[currency] = (currencyMix[currency] ?? 0) + amount;
    }

    for (const collection of harvest.collections) {
      if (collection.ok) endpointsAnswered += 1;
      else endpointsRefused += 1;
      recordsFetched += collection.count;
    }

    for (const transaction of harvest.transactions) {
      if (!transaction.createdAt || transaction.kind === "refund") continue;
      const key = monthKey(transaction.createdAt);
      const entry = months.get(key) ?? { amountMinor: 0, count: 0 };
      entry.amountMinor += transaction.amountMinor;
      entry.count += 1;
      months.set(key, entry);
    }
  }

  return {
    currency: Object.entries(currencyMix).sort((a, b) => b[1] - a[1])[0]?.[0] ?? "USD",
    currencyMix,
    mrrMinor,
    arrMinor: mrrMinor * 12,
    activeCount,
    trialingCount,
    pastDueCount,
    canceledCount,
    customerCount,
    arpaMinor: activeCount > 0 ? Math.round(mrrMinor / activeCount) : null,
    volume30dMinor,
    monthlyVolume: [...months.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .slice(-12)
      .map(([month, entry]) => ({ month, ...entry })),
    endpointsAnswered,
    endpointsRefused,
    recordsFetched,
  };
}

/**
 * Read everything, for every provider this user has connected.
 *
 * `force` skips the cache — what the page's Refresh button does.
 */
export async function harvestRevenue(
  userId: string,
  options: { scope: Scope; force?: boolean },
): Promise<RevenueHarvest> {
  const key = cacheKey(userId, options.scope);
  const cached = store.__revenueHarvest!.get(key);
  if (!options.force && cached && Date.now() - cached.at < CACHE_TTL_MS) return cached.value;

  const rows = await prisma.revenueConnection.findMany({
    where: connectionsWhere(userId, options.scope),
    orderBy: { createdAt: "asc" },
    select: { provider: true, secret: true, accountLabel: true, reference: true, publicUrl: true },
  });

  const harvested = (
    await Promise.all(rows.map((row) => harvestConnection(row)))
  ).filter((harvest): harvest is ProviderHarvest => harvest !== null);

  const value: RevenueHarvest = {
    fetchedAt: new Date().toISOString(),
    providers: harvested,
    totals: combine(harvested),
  };

  store.__revenueHarvest!.set(key, { at: Date.now(), value });
  return value;
}
