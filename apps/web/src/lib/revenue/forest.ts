import "server-only";

import prisma from "@Batman/db";

import { type Scope, connectionsWhere, scopeKey } from "@/lib/startups";

import { type RevenueHarvest, harvestRevenue } from "./harvest";
import { type ForestBook, harvestToForest } from "./to-garden";

/**
 * **Whose garden is this?**
 *
 * One question, asked by every `/api/garden/*` handler: does this user have
 * connected providers with subscriptions in them? If so the plot is their book;
 * if not it is the sample one, which is what the app has always drawn and what a
 * new account should still see rather than an empty field.
 *
 * **The garden and the history must come from one book.** They are two requests,
 * a few milliseconds apart, and the client fetches them together precisely
 * because taking one without the other splits the app across two customer bases.
 * `harvestRevenue` already caches its reads for a minute, but the *derived* book
 * is cached here too, keyed by the harvest it came from — so the second request
 * cannot rebuild a ladder that differs from the first's, and sixty API calls do
 * not turn into a hundred and twenty.
 */

const CACHE_TTL_MS = 60_000;

const store = globalThis as unknown as {
  __liveForest?: Map<string, { at: number; fetchedAt: string; value: ForestBook | null }>;
  /** Which harvest (`fetchedAt`) each scope last wrote startup snapshots from. */
  __forestSnapshotted?: Map<string, string>;
};
store.__liveForest ??= new Map();
store.__forestSnapshotted ??= new Map();

/**
 * Write each startup's headline reading onto its row, as a side effect of the
 * owner deriving their own forest. This is what the public Forests board reads:
 * the board never opens anyone's sealed keys, so a startup's public numbers are
 * exactly as fresh as the last time its *owner* looked at their garden. Written
 * for every startup in the harvest, public or not, so flipping one public shows
 * its last reading immediately rather than a dash until the next visit. Fire
 * and forget — a failed snapshot write must never take the garden down.
 */
function snapshotStartups(harvest: RevenueHarvest): void {
  const perStartup = new Map<
    string,
    {
      mrrMinor: number;
      mrr30dMinor: number;
      trees: number;
      byCurrency: Map<string, number>;
      canopy: number[];
    }
  >();

  // Thirty days ago, read from the subscriptions' own dates — the same trick
  // the plot's timeline uses, so "growth this month" exists from the very
  // first snapshot instead of waiting a month for stored history. A
  // subscription counted then if it had started by then and either still runs
  // or was cancelled after; statuses that pay nothing now (trialing, past-due,
  // paused) count on neither side, so the delta compares like with like.
  const t30 = Date.parse(harvest.fetchedAt) - 30 * 86_400_000;

  for (const provider of harvest.providers) {
    const entry =
      perStartup.get(provider.startupId) ??
      { mrrMinor: 0, mrr30dMinor: 0, trees: 0, byCurrency: new Map<string, number>(), canopy: [] };
    entry.mrrMinor += provider.summary.mrrMinor;
    entry.trees += provider.summary.activeCount;
    for (const [currency, minor] of Object.entries(provider.summary.currencyMix)) {
      entry.byCurrency.set(currency, (entry.byCurrency.get(currency) ?? 0) + minor);
    }
    for (const subscription of provider.subscriptions) {
      if (subscription.status === "active") entry.canopy.push(subscription.monthlyMinor);
      if (!subscription.createdAt) continue;
      const started = Date.parse(subscription.createdAt);
      if (Number.isNaN(started) || started > t30) continue;
      if (subscription.status === "active") {
        entry.mrr30dMinor += subscription.monthlyMinor;
      } else if (subscription.status === "canceled") {
        const ended = subscription.endsAt ? Date.parse(subscription.endsAt) : started;
        if (ended > t30) entry.mrr30dMinor += subscription.monthlyMinor;
      }
    }
    perStartup.set(provider.startupId, entry);
  }

  const at = new Date(harvest.fetchedAt);
  void Promise.all(
    [...perStartup].map(([startupId, reading]) => {
      // The plot's known limit, kept honestly: mixed currencies are summed into
      // one figure, quoted in whichever currency carries the most of it.
      const currency =
        [...reading.byCurrency.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? "USD";
      return prisma.startup.update({
        where: { id: startupId },
        data: {
          publicMrrMinor: reading.mrrMinor,
          publicMrrMinor30d: reading.mrr30dMinor,
          publicCurrency: currency,
          publicTrees: reading.trees,
          // Largest first so the cap keeps the trees that carry the revenue.
          publicCanopy: reading.canopy.sort((a, b) => b - a).slice(0, 60),
          publicSnapshotAt: at,
        },
      });
    }),
  ).catch(() => {});
}

/** Per user *and* scope: one startup's book must never be served for another's. */
const cacheKey = (userId: string, scope: Scope) => `${userId}|${scopeKey(scope)}`;

/**
 * What the plot is standing on, and — when it is the sample book — *why*.
 *
 * "No live book" has two causes that need different words: nothing is connected,
 * or something is connected and working and has no subscriptions in it yet. The
 * garden looks identical either way, so the reason has to travel with the answer;
 * without it the status chip tells a user with a working Polar key to go and
 * connect a payment provider.
 */
export interface ForestResolution {
  forest: ForestBook | null;
  /** How many providers this user has connected. */
  connected: number;
  /** Their display names, for the chip and the logs. */
  providers: string[];
  /** Subscriptions returned across all of them. */
  subscriptions: number;
}

/**
 * The user's real forest and the reason if there isn't one.
 *
 * The connection count is checked first because it is one indexed query, and for
 * everybody who has not connected anything it is the whole of the work.
 */
export async function resolveForest(userId: string, scope: Scope): Promise<ForestResolution> {
  const connected = await prisma.revenueConnection.count({
    where: connectionsWhere(userId, scope),
  });
  if (connected === 0) {
    return { forest: null, connected: 0, providers: [], subscriptions: 0 };
  }

  const harvest = await harvestRevenue(userId, { scope });

  const snapKey = cacheKey(userId, scope);
  if (store.__forestSnapshotted!.get(snapKey) !== harvest.fetchedAt) {
    store.__forestSnapshotted!.set(snapKey, harvest.fetchedAt);
    snapshotStartups(harvest);
  }

  const providers = harvest.providers.map((provider) => provider.providerName);
  const subscriptions = harvest.providers.reduce(
    (sum, provider) => sum + provider.subscriptions.length,
    0,
  );

  const key = cacheKey(userId, scope);
  const cached = store.__liveForest!.get(key);
  if (cached && cached.fetchedAt === harvest.fetchedAt && Date.now() - cached.at < CACHE_TTL_MS) {
    return { forest: cached.value, connected, providers, subscriptions };
  }

  const forest = harvestToForest(harvest);
  store.__liveForest!.set(key, {
    at: Date.now(),
    fetchedAt: harvest.fetchedAt,
    value: forest,
  });

  return { forest, connected, providers, subscriptions };
}

/** Just the book, for the handlers that have nothing to say about the reason. */
export async function liveForest(userId: string, scope: Scope): Promise<ForestBook | null> {
  return (await resolveForest(userId, scope)).forest;
}

/** Drop every derived book for a user, for the same reason `forgetHarvest` does. */
export function forgetForest(userId: string): void {
  const map = store.__liveForest;
  if (!map) return;
  for (const key of [...map.keys()]) {
    if (key.startsWith(`${userId}|`)) map.delete(key);
  }
}

/** Whether this scope has anything connected, without building the book. */
export async function hasLiveBook(userId: string, scope: Scope): Promise<boolean> {
  return (
    (await prisma.revenueConnection.count({ where: connectionsWhere(userId, scope) })) > 0
  );
}
