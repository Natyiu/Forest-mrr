"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import prisma from "@Batman/db";

import { requireSession } from "@/lib/session";
import {
  ACTIVE_STARTUP_COOKIE,
  ALL_STARTUPS,
  type StartupView,
  listStartups,
  ownsStartup,
  resolveScope,
} from "@/lib/startups";
import { forgetHarvest } from "@/lib/revenue/harvest";
import { forgetForest } from "@/lib/revenue/forest";

/**
 * **Startups: create, rename, switch, delete.**
 *
 * The switch is a cookie write rather than a URL parameter — see `lib/startups.ts`
 * for why — so it has to be a server action: a cookie set from the client cannot be
 * read by the server render that follows it.
 *
 * Every mutation invalidates the whole revenue surface, because the caches are keyed
 * by *(user, scope)* and a startup that gained, lost or renamed a connection changes
 * at least two books: its own and the `all` view.
 */

const MAX_NAME = 60;

const nameInput = z.object({
  name: z.string().trim().min(1).max(MAX_NAME),
  emoji: z.string().trim().max(8).optional(),
});

/** Everything a startup's settings page can change about it. */
const updateInput = nameInput.extend({
  id: z.string().min(1),
  /** A key into the app's categorical tones. Decorative; means nothing. */
  tone: z.string().trim().max(24).optional(),
});

const idInput = z.object({ id: z.string().min(1) });

const switchInput = z.object({ id: z.string().min(1) });

function invalidate(userId: string) {
  forgetHarvest(userId);
  forgetForest(userId);
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/revenue");
  revalidatePath("/dashboard/graph");
  revalidatePath("/dashboard/startups");
}

export type StartupResult =
  | { ok: true; startups: StartupView[]; activeId: string | typeof ALL_STARTUPS | null }
  | { ok: false; message: string };

/** The switcher's own data, for client components that need it on demand. */
export async function getStartups(): Promise<{
  startups: StartupView[];
  activeId: string | typeof ALL_STARTUPS | null;
}> {
  const session = await requireSession();
  const resolved = await resolveScope(session.user.id);
  return { startups: resolved.startups, activeId: resolved.activeId };
}

export async function createStartup(raw: unknown): Promise<StartupResult> {
  const session = await requireSession();
  const parsed = nameInput.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, message: "A startup needs a name of 1–60 characters." };
  }

  const existing = await prisma.startup.findFirst({
    where: { userId: session.user.id, name: parsed.data.name },
    select: { id: true },
  });
  if (existing) {
    return { ok: false, message: `You already have a startup called “${parsed.data.name}”.` };
  }

  const created = await prisma.startup.create({
    data: {
      userId: session.user.id,
      name: parsed.data.name,
      emoji: parsed.data.emoji || null,
    },
    select: { id: true },
  });

  // A startup you have just made is the one you want to be looking at.
  (await cookies()).set(ACTIVE_STARTUP_COOKIE, created.id, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });

  invalidate(session.user.id);
  const startups = await listStartups(session.user.id);
  return { ok: true, startups, activeId: created.id };
}

/** Rename, re-emoji, re-tone. One action, because they are one form. */
export async function updateStartup(raw: unknown): Promise<StartupResult> {
  const session = await requireSession();
  const parsed = updateInput.safeParse(raw);
  if (!parsed.success) return { ok: false, message: "That change did not arrive intact." };

  if (!(await ownsStartup(session.user.id, parsed.data.id))) {
    return { ok: false, message: "That startup is not yours." };
  }

  const clash = await prisma.startup.findFirst({
    where: { userId: session.user.id, name: parsed.data.name, id: { not: parsed.data.id } },
    select: { id: true },
  });
  if (clash) {
    return { ok: false, message: `You already have a startup called “${parsed.data.name}”.` };
  }

  await prisma.startup.update({
    where: { id: parsed.data.id },
    data: {
      name: parsed.data.name,
      emoji: parsed.data.emoji || null,
      // Absent means "leave it": the switcher edits a name inline and has no
      // opinion about the tone.
      ...(parsed.data.tone === undefined ? {} : { tone: parsed.data.tone || null }),
    },
  });

  invalidate(session.user.id);
  const resolved = await resolveScope(session.user.id);
  return { ok: true, startups: resolved.startups, activeId: resolved.activeId };
}

/**
 * Delete a startup **and its connections**.
 *
 * The cascade is the schema's (`onDelete: Cascade`), which is the honest behaviour:
 * a connection has no meaning without the business it belongs to. The keys are
 * deleted here and stay valid at the provider until revoked there — the confirm
 * dialog says so.
 */
export async function deleteStartup(raw: unknown): Promise<StartupResult> {
  const session = await requireSession();
  const parsed = idInput.safeParse(raw);
  if (!parsed.success) return { ok: false, message: "Unknown startup." };

  if (!(await ownsStartup(session.user.id, parsed.data.id))) {
    return { ok: false, message: "That startup is not yours." };
  }

  await prisma.startup.delete({ where: { id: parsed.data.id } });

  const startups = await listStartups(session.user.id);
  const jar = await cookies();
  // Never leave the cookie pointing at something that no longer exists: the next
  // resolve would silently fall back, and "silently" is how a person ends up
  // looking at the wrong business.
  if (jar.get(ACTIVE_STARTUP_COOKIE)?.value === parsed.data.id) {
    if (startups.length) {
      jar.set(ACTIVE_STARTUP_COOKIE, startups[0].id, {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        maxAge: 60 * 60 * 24 * 365,
      });
    } else {
      jar.delete(ACTIVE_STARTUP_COOKIE);
    }
  }

  invalidate(session.user.id);
  return { ok: true, startups, activeId: startups[0]?.id ?? null };
}

/** Switch the active book. `id` may be a startup id or `all`. */
export async function switchStartup(raw: unknown): Promise<StartupResult> {
  const session = await requireSession();
  const parsed = switchInput.safeParse(raw);
  if (!parsed.success) return { ok: false, message: "Unknown startup." };

  const target = parsed.data.id;
  if (target !== ALL_STARTUPS && !(await ownsStartup(session.user.id, target))) {
    return { ok: false, message: "That startup is not yours." };
  }

  (await cookies()).set(ACTIVE_STARTUP_COOKIE, target, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });

  // No cache to drop — the books are keyed by scope, so switching just reads a
  // different key. The pages are revalidated because they were rendered for the
  // old one.
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/revenue");
  revalidatePath("/dashboard/graph");
  revalidatePath("/dashboard/startups");

  const resolved = await resolveScope(session.user.id);
  return { ok: true, startups: resolved.startups, activeId: resolved.activeId };
}
