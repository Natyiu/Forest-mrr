// Imported for its side effect, not its export: `@Batman/env/server` loads
// `apps/web/.env` through dotenv and validates the required variables. Anything
// running outside Next — a script, the seeder — depends on that having happened
// before the connection string below is read.
import "@Batman/env/server";
import { PrismaPg } from "@prisma/adapter-pg";

import { Prisma, PrismaClient } from "../prisma/generated/client";

/**
 * The Prisma client, and the three things that were burning through the
 * database's connection ceiling.
 *
 * Symptom: `(EMAXCONNSESSION) max clients reached in session mode — pool_size:
 * 15`, from anything that touched the database, including the session lookup in
 * `dashboard/layout.tsx`.
 *
 * **1. The runtime was pointed at the migration URL.** Supabase's pooler answers
 * on two ports: 6543 is *transaction* mode, which hands a server connection back
 * after each statement and is what an app should use; 5432 is *session* mode,
 * which holds one per client and is capped at 15 — it exists for migrations and
 * for `psql`. `DATABASE_URL` here is 6543 and `DIRECT_URL` is 5432, and this
 * resolver preferred `DIRECT_URL`, so every page view, every session check and
 * every API route queued for one of fifteen session slots while the pool built
 * for thousands sat unused. The order is now pooled-first. Nothing about
 * migrations changes: `prisma.config.ts` reads `DIRECT_URL` explicitly, which is
 * correct — a schema change wants a real session.
 *
 * **2. Every hot reload leaked a pool.** This module created a `PrismaPg` (which
 * *is* a `pg.Pool`) and a `PrismaClient` at import time, unpinned. Next
 * re-evaluates server modules on edit, so each save built another pool while the
 * previous one kept its sockets — the same reason the garden's server state is
 * pinned to `globalThis`. Editing files for an afternoon is then indistinguishable
 * from a connection leak, because it is one. Both are pinned now.
 *
 * **3. Nothing bounded a single process.** `pg.Pool` defaults to 10 connections,
 * so two processes — a dev server and a build, or a dev server and Studio — can
 * ask for 20 against a ceiling of 15 and the fifteenth wins. The cap below is
 * deliberately small: this app's queries are short, and a request waiting 50ms
 * for a free connection is invisible next to one that fails.
 */

/**
 * Pooled connections first. Session-mode and direct URLs are the fallback, for a
 * setup that only has one of those (a local Postgres, say, where there is no
 * pooler and the distinction does not exist).
 */
function resolveConnectionString(): string {
  const candidates = [
    process.env.DATABASE_URL,
    process.env.POSTGRES_URL,
    process.env.DIRECT_URL,
    process.env.POSTGRES_URL_NON_POOLING,
  ];

  for (const value of candidates) {
    const url = value?.trim();
    if (!url) continue;
    if (url.startsWith("postgres://") || url.startsWith("postgresql://")) {
      return url;
    }
  }

  throw new Error(
    "No valid Postgres connection string found. Set DATABASE_URL, POSTGRES_URL, DIRECT_URL, or POSTGRES_URL_NON_POOLING to a postgres:// URL.",
  );
}

/**
 * How many server connections one process may hold.
 *
 * Small on purpose, and smaller in development, where the same machine is also
 * running builds, Studio and whatever else — the ceiling is shared by every
 * process, not per process. `PRISMA_POOL_MAX` overrides it for a deployment that
 * has the headroom.
 */
function poolMax(): number {
  const configured = Number(process.env.PRISMA_POOL_MAX);
  if (Number.isFinite(configured) && configured > 0) return Math.floor(configured);
  return process.env.NODE_ENV === "production" ? 5 : 3;
}

function createClient(): PrismaClient {
  const adapter = new PrismaPg({
    connectionString: resolveConnectionString(),
    max: poolMax(),
    // Give idle connections back rather than sitting on them: on a shared pooler
    // an idle socket is somebody else's failed query.
    idleTimeoutMillis: 10_000,
    // Fail with a clear message instead of hanging when the ceiling is genuinely
    // reached.
    connectionTimeoutMillis: 10_000,
  });

  return new PrismaClient({ adapter });
}

const KEY = Symbol.for("batman.prisma");

/**
 * The pinned client is kept **with the generated class it was built from**.
 *
 * Pinning alone has a trap, and it bit: after `prisma generate` adds a model, the
 * dev server keeps handing out the instance it pinned earlier, which has no
 * delegate for the new table — `prisma.startup.findMany` is `undefined is not a
 * function`, and no amount of editing app code fixes it because the app code is not
 * what is stale.
 *
 * Comparing the *constructor identity* solves both problems at once. A hot reload
 * that re-evaluates this module sees the same generated class and reuses the same
 * pool (which is why the pin exists). A regeneration replaces
 * `prisma/generated/client`, so the class is a different object, and the client is
 * rebuilt — with the old pool disconnected first, so a schema change costs one
 * connection cycle rather than a leak.
 */
interface Pinned {
  ctor: typeof PrismaClient;
  client: PrismaClient;
}

type GlobalWithPrisma = typeof globalThis & { [KEY]?: Pinned };

const scope = globalThis as GlobalWithPrisma;

if (!scope[KEY] || scope[KEY].ctor !== PrismaClient) {
  const stale = scope[KEY]?.client;
  scope[KEY] = { ctor: PrismaClient, client: createClient() };
  // Let the old pool's sockets go rather than stranding them for the life of the
  // process. Failure here is not worth surfacing: the client is already replaced.
  void stale?.$disconnect().catch(() => {});
}

const prisma = scope[KEY].client;

export default prisma;
export { Prisma };
