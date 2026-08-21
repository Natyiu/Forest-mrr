import "server-only";

import { cookies } from "next/headers";

import prisma from "@Batman/db";

/**
 * **Which business are we looking at?**
 *
 * A person can run more than one thing, so "your revenue" is not one book. A
 * `Startup` owns the connections; the user owns startups; and every read — the
 * forest, the imported-data page, the graphs — happens inside a **scope**.
 *
 * Two scopes exist. A single startup, and `all`: every startup's subscriptions on
 * one plot. `all` is not a fourth kind of book, it is the same derivation over a
 * wider set of connections, which is why nothing downstream needs to know about it.
 *
 * **The active scope lives in a cookie, not in the URL.** The garden already
 * mirrors its whole view into the query string — month, filters, selection, shape —
 * and a startup is not part of *that* view: it is which book those filters apply
 * to. Putting it in the URL would mean every link anybody shares carries somebody
 * else's startup id, and the plot would change business on a back button.
 */

export const ACTIVE_STARTUP_COOKIE = "forestmrr.startup";

/** Every startup's book at once. */
export const ALL_STARTUPS = "all" as const;

export type Scope = { kind: "startup"; id: string } | { kind: "all" };

/** A stable string for cache keys. */
export const scopeKey = (scope: Scope): string =>
  scope.kind === "all" ? "all" : `s:${scope.id}`;

export interface StartupView {
  id: string;
  name: string;
  emoji: string | null;
  /**
   * The logo imported from a connected provider, when one of them publishes one.
   *
   * It is *derived*, not stored on the startup: the provider is the owner of that
   * image, so a copy on this row would be the wrong logo the first time somebody
   * re-branded on Polar. The first connection that has one wins — a business with
   * two providers has one mark, and the order is stable (oldest connection first)
   * so it does not change under a reader between page loads.
   */
  image: string | null;
  tone: string | null;
  /** How many providers this startup has connected. */
  connections: number;
  createdAt: string;
}

export async function listStartups(userId: string): Promise<StartupView[]> {
  const rows = await prisma.startup.findMany({
    where: { userId },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      name: true,
      emoji: true,
      tone: true,
      createdAt: true,
      _count: { select: { connections: true } },
      connections: {
        where: { accountImage: { not: null } },
        orderBy: { createdAt: "asc" },
        take: 1,
        select: { accountImage: true },
      },
    },
  });

  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    emoji: row.emoji,
    tone: row.tone,
    image: row.connections[0]?.accountImage ?? null,
    connections: row._count.connections,
    createdAt: row.createdAt.toISOString(),
  }));
}

export interface ResolvedScope {
  scope: Scope;
  /** What the switcher shows. */
  startups: StartupView[];
  /** The active startup, when the scope is a single one. */
  active: StartupView | null;
  /** `all`, a startup id, or null when the user has no startups yet. */
  activeId: string | typeof ALL_STARTUPS | null;
}

/**
 * The scope for this request.
 *
 * The cookie is a *preference*, not a permission: it is checked against the
 * user's own startups every time, so a stale id — a deleted startup, or one
 * copied from another account — falls back to their first rather than reading
 * somebody else's revenue.
 */
export async function resolveScope(userId: string): Promise<ResolvedScope> {
  const startups = await listStartups(userId);
  const requested = (await cookies()).get(ACTIVE_STARTUP_COOKIE)?.value ?? null;

  if (!startups.length) {
    return { scope: { kind: "all" }, startups, active: null, activeId: null };
  }

  if (requested === ALL_STARTUPS) {
    return { scope: { kind: "all" }, startups, active: null, activeId: ALL_STARTUPS };
  }

  const active = startups.find((startup) => startup.id === requested) ?? startups[0];
  return {
    scope: { kind: "startup", id: active.id },
    startups,
    active,
    activeId: active.id,
  };
}

/** The `where` clause every scoped connection read shares. */
export function connectionsWhere(userId: string, scope: Scope) {
  return scope.kind === "all"
    ? { userId }
    : { userId, startupId: scope.id };
}

/**
 * A startup to hang a first connection on.
 *
 * Connecting a provider is the moment somebody actually needs a startup, so it
 * makes one rather than asking them to create a container first — the container
 * is a means, and a form that demands one before anything useful can happen is a
 * tax on the first thirty seconds of the product.
 */
export async function ensureStartup(userId: string, name = "My startup"): Promise<string> {
  const existing = await prisma.startup.findFirst({
    where: { userId },
    orderBy: { createdAt: "asc" },
    select: { id: true },
  });
  if (existing) return existing.id;

  const created = await prisma.startup.create({
    data: { userId, name },
    select: { id: true },
  });
  return created.id;
}

/** Whether this startup is the caller's, before anything is done to it. */
export async function ownsStartup(userId: string, startupId: string): Promise<boolean> {
  const found = await prisma.startup.findFirst({
    where: { id: startupId, userId },
    select: { id: true },
  });
  return found !== null;
}
