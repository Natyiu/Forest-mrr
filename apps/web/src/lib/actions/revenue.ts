"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import prisma from "@Batman/db";

import { requireSession } from "@/lib/session";
import {
  type Scope,
  type StartupView,
  ensureStartup,
  listStartups,
  ownsStartup,
  resolveScope,
} from "@/lib/startups";
import {
  type CredentialProblem,
  type Credentials,
  type RevenueProviderId,
  REVENUE_PROVIDERS,
  apiKeyLooksValid,
  isRevenueProviderId,
  normalizeCredentials,
  secretHint,
  validateCredentials,
} from "@/lib/revenue/providers";
import {
  ProviderError,
  type RemoteOption,
  fetchRemoteOptions,
  probeProvider,
} from "@/lib/revenue/providers.server";
import { forgetHarvest, harvestRevenue } from "@/lib/revenue/harvest";
import { forgetForest } from "@/lib/revenue/forest";
import { openCredentials, sealCredentials } from "@/lib/revenue/secrets";

/**
 * **Connecting a revenue source.** One action does the whole of it, in an order
 * chosen so that nothing is stored that has not been proven:
 *
 *   1. shape-check the credential locally (free, and catches most paste errors)
 *   2. ask the provider (one read, with the same permission a refresh needs)
 *   3. seal it and write the row
 *
 * A failure at step 2 leaves no row and returns the provider's own words. That
 * ordering is the difference between "connected" meaning *connected* and meaning
 * "we kept a string".
 *
 * Nothing in here ever returns a key. `RevenueConnectionView` is what a page is
 * allowed to know: which provider, which account, the last four characters, and
 * whether the last check passed.
 */

/** What a client is allowed to see of a connection. */
export interface RevenueConnectionView {
  id: string;
  provider: RevenueProviderId;
  providerName: string;
  /** Which business this key belongs to. */
  startupId: string;
  startupName: string;
  accountLabel: string | null;
  /** The logo the provider holds for this account, if it publishes a fetchable one. */
  accountImage: string | null;
  secretHint: string;
  reference: string | null;
  publicUrl: string | null;
  status: "connected" | "error";
  lastError: string | null;
  lastVerifiedAt: string | null;
  createdAt: string;
}

export type SaveResult =
  | { ok: true; connection: RevenueConnectionView; detail?: string }
  | { ok: false; message: string; problems?: CredentialProblem[] };

const saveInput = z.object({
  provider: z.string().min(1),
  credentials: z.record(z.string(), z.string()),
  /** Which startup to hang it on. Defaults to the one being looked at. */
  startupId: z.string().min(1).optional(),
});

const providerInput = z.object({
  provider: z.string().min(1),
  /** Which startup's connection. Defaults to the active one. */
  startupId: z.string().min(1).optional(),
});

const optionsInput = z.object({
  provider: z.string().min(1),
  apiKey: z.string().min(1),
});

type ConnectionRow = {
  id: string;
  provider: string;
  startupId: string;
  startup?: { name: string } | null;
  accountLabel: string | null;
  accountImage: string | null;
  secretHint: string;
  reference: string | null;
  publicUrl: string | null;
  status: string;
  lastError: string | null;
  lastVerifiedAt: Date | null;
  createdAt: Date;
};

function toView(row: ConnectionRow): RevenueConnectionView {
  const provider = isRevenueProviderId(row.provider) ? row.provider : "stripe";
  return {
    id: row.id,
    provider,
    startupId: row.startupId,
    startupName: row.startup?.name ?? "",
    // The stored string is the source of truth; the name is looked up so a
    // rename in the registry shows up everywhere at once.
    providerName: REVENUE_PROVIDERS[provider].name,
    accountLabel: row.accountLabel,
    accountImage: row.accountImage,
    secretHint: row.secretHint,
    reference: row.reference,
    publicUrl: row.publicUrl,
    status: row.status === "error" ? "error" : "connected",
    lastError: row.lastError,
    lastVerifiedAt: row.lastVerifiedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
  };
}

const VIEW_COLUMNS = {
  id: true,
  provider: true,
  startupId: true,
  startup: { select: { name: true } },
  accountLabel: true,
  accountImage: true,
  secretHint: true,
  reference: true,
  publicUrl: true,
  status: true,
  lastError: true,
  lastVerifiedAt: true,
  createdAt: true,
} as const;

function readProvider(value: string): RevenueProviderId {
  if (!isRevenueProviderId(value)) throw new Error("Unknown payment provider");
  return value;
}

function failureMessage(error: unknown, providerName: string): string {
  if (error instanceof ProviderError) return error.message;
  // Anything else is ours, and a stack trace is not an instruction.
  console.error("[revenue] connect failed", error);
  return `Could not finish connecting ${providerName}. Nothing was saved — try again.`;
}

/**
 * Every surface that draws this user's book, invalidated together.
 *
 * The two in-memory caches and the three pages are one unit: a connection that
 * changes and a plot that keeps drawing the old one for another minute is worse
 * than a slow page. The garden is not in the list because it reads through
 * `/api/garden`, which is `force-dynamic` and goes through `resolveForest`.
 */
function forgetRevenue(userId: string): void {
  forgetHarvest(userId);
  forgetForest(userId);
  revalidatePath("/dashboard/startups");
  revalidatePath("/dashboard/revenue");
  revalidatePath("/dashboard/graph");
}

/**
 * Which startup a write lands on.
 *
 * An explicit id wins (the settings page connects *into* a named startup), then
 * whichever one is being looked at, and failing both a startup is created —
 * connecting a provider is the moment somebody actually needs one, and demanding
 * they make a container first is a tax on the first thirty seconds of the product.
 * While the scope is `all` there is no single startup to mean, so the first one
 * does.
 */
async function targetStartup(
  userId: string,
  explicit: string | undefined,
  scope: Scope,
): Promise<string | null> {
  if (explicit) return (await ownsStartup(userId, explicit)) ? explicit : null;
  if (scope.kind === "startup") return scope.id;
  return ensureStartup(userId);
}

/** The connections in the book currently being looked at. */
export async function listRevenueConnections(): Promise<RevenueConnectionView[]> {
  const session = await requireSession();
  const { scope } = await resolveScope(session.user.id);

  const rows = await prisma.revenueConnection.findMany({
    where:
      scope.kind === "all"
        ? { userId: session.user.id }
        : { userId: session.user.id, startupId: scope.id },
    orderBy: { createdAt: "asc" },
    select: VIEW_COLUMNS,
  });

  return rows.map(toView);
}

/**
 * Every startup with its connections, for the page that manages them.
 *
 * Startups with nothing connected are included — an empty business is exactly the
 * one that needs the connect button in front of it.
 */
export async function listConnectionsByStartup(): Promise<
  Array<{ startup: StartupView; connections: RevenueConnectionView[] }>
> {
  const session = await requireSession();
  const [startups, rows] = await Promise.all([
    listStartups(session.user.id),
    prisma.revenueConnection.findMany({
      where: { userId: session.user.id },
      orderBy: { createdAt: "asc" },
      select: VIEW_COLUMNS,
    }),
  ]);

  const views = rows.map(toView);
  return startups.map((startup) => ({
    startup,
    connections: views.filter((connection) => connection.startupId === startup.id),
  }));
}

/**
 * Save a credential, having first proven it reads.
 *
 * Re-connecting a provider is an upsert on `(userId, provider)`: a person
 * rotating a revoked key means to replace it, and a second row would leave the
 * refresh picking one of two keys by luck.
 */
export async function saveRevenueConnection(raw: unknown): Promise<SaveResult> {
  const session = await requireSession();
  const parsed = saveInput.safeParse(raw);
  if (!parsed.success) return { ok: false, message: "That form did not arrive intact." };

  const providerId = readProvider(parsed.data.provider);
  const provider = REVENUE_PROVIDERS[providerId];
  const credentials = normalizeCredentials(providerId, parsed.data.credentials as Credentials);

  const { scope } = await resolveScope(session.user.id);
  const startupId = await targetStartup(session.user.id, parsed.data.startupId, scope);
  if (!startupId) return { ok: false, message: "That startup is not yours." };

  const problems = validateCredentials(providerId, credentials);
  if (problems.length) {
    return {
      ok: false,
      message: problems.length === 1 ? problems[0].message : "Some of those values need another look.",
      problems,
    };
  }

  let probe;
  try {
    probe = await probeProvider(providerId, credentials);
  } catch (error) {
    return { ok: false, message: failureMessage(error, provider.name) };
  }

  const apiKey = credentials.apiKey!;
  const sealed = sealCredentials(credentials);

  const row = await prisma.revenueConnection.upsert({
    where: { startupId_provider: { startupId, provider: providerId } },
    create: {
      userId: session.user.id,
      startupId,
      provider: providerId,
      secret: sealed,
      secretHint: secretHint(apiKey),
      reference:
        credentials.projectId ?? credentials.applicationId ?? credentials.organizationId ?? null,
      publicUrl: credentials.shareUrl ?? null,
      accountLabel: probe.accountLabel,
      accountImage: probe.logoUrl ?? null,
      status: "connected",
      lastError: null,
      lastVerifiedAt: new Date(),
    },
    update: {
      secret: sealed,
      secretHint: secretHint(apiKey),
      reference:
        credentials.projectId ?? credentials.applicationId ?? credentials.organizationId ?? null,
      publicUrl: credentials.shareUrl ?? null,
      accountLabel: probe.accountLabel,
      accountImage: probe.logoUrl ?? null,
      status: "connected",
      lastError: null,
      lastVerifiedAt: new Date(),
    },
    select: VIEW_COLUMNS,
  });

  forgetRevenue(session.user.id);

  const detail = [probe.detail, probe.environment === "test" ? "test mode" : null]
    .filter(Boolean)
    .join(" · ");

  return { ok: true, connection: toView(row), detail: detail || undefined };
}

/**
 * Re-check a key that is already stored.
 *
 * Read-only keys get revoked and expire, and the first anyone hears of it is
 * usually a dashboard that has quietly stopped moving. A connection that cannot
 * answer is marked `error` with the reason on it, so it reads as broken rather
 * than as connected.
 */
export async function verifyRevenueConnection(raw: unknown): Promise<SaveResult> {
  const session = await requireSession();
  const parsed = providerInput.safeParse(raw);
  if (!parsed.success) return { ok: false, message: "Unknown provider." };

  const providerId = readProvider(parsed.data.provider);
  const provider = REVENUE_PROVIDERS[providerId];

  const { scope } = await resolveScope(session.user.id);
  const startupId = await targetStartup(session.user.id, parsed.data.startupId, scope);
  if (!startupId) return { ok: false, message: "That startup is not yours." };

  const existing = await prisma.revenueConnection.findUnique({
    where: { startupId_provider: { startupId, provider: providerId } },
    select: { secret: true },
  });
  if (!existing) return { ok: false, message: `${provider.name} is not connected.` };

  let credentials: Credentials;
  try {
    credentials = openCredentials(existing.secret) as Credentials;
  } catch {
    return {
      ok: false,
      message: `The stored ${provider.name} key cannot be opened by this server. Paste the key again.`,
    };
  }

  try {
    const probe = await probeProvider(providerId, credentials);
    const row = await prisma.revenueConnection.update({
      where: { startupId_provider: { startupId, provider: providerId } },
      data: {
        accountLabel: probe.accountLabel,
        accountImage: probe.logoUrl ?? null,
        status: "connected",
        lastError: null,
        lastVerifiedAt: new Date(),
      },
      select: VIEW_COLUMNS,
    });
    forgetRevenue(session.user.id);
    return { ok: true, connection: toView(row), detail: probe.detail };
  } catch (error) {
    const message = failureMessage(error, provider.name);
    await prisma.revenueConnection.update({
      where: { startupId_provider: { startupId, provider: providerId } },
      data: { status: "error", lastError: message },
    });
    forgetRevenue(session.user.id);
    return { ok: false, message };
  }
}

/**
 * Re-read every connected provider, ignoring the one-minute cache.
 *
 * The dashboard's Refresh button. It returns nothing but a verdict: the page is
 * revalidated, so the numbers arrive the same way they arrived the first time
 * rather than as a second copy of the data travelling back through an action.
 */
export async function refreshRevenueHarvest(): Promise<{ ok: boolean; message?: string }> {
  const session = await requireSession();

  try {
    // The harvest is re-read here; the *derived* book must not be served from a
    // cache keyed to the harvest that has just been replaced.
    forgetForest(session.user.id);
    const { scope } = await resolveScope(session.user.id);
    await harvestRevenue(session.user.id, { scope, force: true });
  } catch (error) {
    console.error("[revenue] refresh failed", error);
    return { ok: false, message: "Could not reach the connected providers just now." };
  }

  revalidatePath("/dashboard/revenue");
  revalidatePath("/dashboard/graph");
  return { ok: true };
}

export async function removeRevenueConnection(raw: unknown): Promise<{ ok: boolean; message?: string }> {
  const session = await requireSession();
  const parsed = providerInput.safeParse(raw);
  if (!parsed.success) return { ok: false, message: "Unknown provider." };

  const providerId = readProvider(parsed.data.provider);
  const { scope } = await resolveScope(session.user.id);
  const startupId = await targetStartup(session.user.id, parsed.data.startupId, scope);
  if (!startupId) return { ok: false, message: "That startup is not yours." };

  // Scoped on purpose: the same provider may be connected to two startups, and
  // disconnecting one must not take the other's key with it.
  await prisma.revenueConnection.deleteMany({
    where: { userId: session.user.id, startupId, provider: providerId },
  });

  forgetRevenue(session.user.id);
  return { ok: true };
}

/**
 * The options behind a `remote-select` step — Superwall's application list.
 *
 * The key is used and dropped: this runs before there is anything to save, and
 * a provider that will not answer here is one whose dialog should not offer a
 * dead select.
 */
export async function listRevenueProviderOptions(
  raw: unknown,
): Promise<{ ok: true; options: RemoteOption[] } | { ok: false; message: string }> {
  await requireSession();
  const parsed = optionsInput.safeParse(raw);
  if (!parsed.success) return { ok: false, message: "Missing API key." };

  const providerId = readProvider(parsed.data.provider);
  const provider = REVENUE_PROVIDERS[providerId];

  if (!apiKeyLooksValid(providerId, parsed.data.apiKey)) {
    return { ok: false, message: `That does not look like a ${provider.name} API key yet.` };
  }

  try {
    const options = await fetchRemoteOptions(providerId, parsed.data.apiKey.trim());
    return { ok: true, options };
  } catch (error) {
    return { ok: false, message: failureMessage(error, provider.name) };
  }
}
