import "server-only";

import prisma from "@Batman/db";

import { type Scope, connectionsWhere, scopeKey } from "@/lib/startups";

import { harvestRevenue } from "./harvest";
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
};
store.__liveForest ??= new Map();

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
