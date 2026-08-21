"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { auth } from "@Batman/auth";
import prisma from "@Batman/db";
import { headers } from "next/headers";

import { AD_SLOTS_PER_SIDE } from "@/lib/ads";

/**
 * The admin's side of the sponsor inventory: list the companies in the spots,
 * add one after a sale, delete one when its run ends. Deleting a row removes
 * the company from every ad surface on the next render — the rails and the
 * strip read this table, nothing is cached.
 */

async function requireAdmin() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) throw new Error("Unauthorized");
  if (session.user.role !== "admin") throw new Error("Forbidden");
  return session;
}

export interface AdSpotRow {
  id: string;
  name: string;
  tagline: string;
  href: string;
  image: string | null;
  placement: string;
  createdAt: string;
}

export async function listAdSpots(): Promise<AdSpotRow[]> {
  await requireAdmin();
  const rows = await prisma.adSpot.findMany({ orderBy: { createdAt: "asc" } });
  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    tagline: row.tagline,
    href: row.href,
    image: row.image,
    placement: row.placement,
    createdAt: row.createdAt.toISOString(),
  }));
}

const addInput = z.object({
  name: z.string().trim().min(1).max(60),
  tagline: z.string().trim().min(1).max(120),
  href: z.string().trim().min(1).max(300),
  image: z.string().trim().max(300).optional(),
  placement: z.enum(["garden", "forests", "bundle"]).default("bundle"),
});

/** Same rule everywhere a stored string becomes a link: http(s) only. */
function normaliseUrl(raw: string): string | null {
  const candidate = /^[a-z][a-z0-9+.-]*:/i.test(raw) ? raw : `https://${raw}`;
  try {
    const url = new URL(candidate);
    if (url.protocol !== "https:" && url.protocol !== "http:") return null;
    return url.toString();
  } catch {
    return null;
  }
}

export async function addAdSpot(
  raw: unknown,
): Promise<{ ok: true } | { ok: false; message: string }> {
  await requireAdmin();
  const parsed = addInput.safeParse(raw);
  if (!parsed.success) return { ok: false, message: "Please fill in name, tagline and link." };

  const href = normaliseUrl(parsed.data.href);
  if (!href) return { ok: false, message: "That does not look like a web address." };

  let image: string | null = null;
  if (parsed.data.image) {
    // A local /ads/… file or an https URL; nothing else renders as an <img>.
    if (parsed.data.image.startsWith("/")) image = parsed.data.image;
    else {
      image = normaliseUrl(parsed.data.image);
      if (!image) return { ok: false, message: "The logo must be a URL or a /path." };
    }
  }

  const count = await prisma.adSpot.count();
  if (count >= AD_SLOTS_PER_SIDE * 2) {
    return { ok: false, message: "All ten spots are taken — delete one first." };
  }

  await prisma.adSpot.create({
    data: {
      name: parsed.data.name,
      tagline: parsed.data.tagline,
      href,
      image,
      placement: parsed.data.placement,
    },
  });

  revalidatePath("/dashboard/forests");
  revalidatePath("/dashboard");
  return { ok: true };
}

export async function deleteAdSpot(
  raw: unknown,
): Promise<{ ok: true } | { ok: false; message: string }> {
  await requireAdmin();
  const parsed = z.object({ id: z.string().min(1) }).safeParse(raw);
  if (!parsed.success) return { ok: false, message: "Unknown spot." };

  await prisma.adSpot.delete({ where: { id: parsed.data.id } }).catch(() => {});

  revalidatePath("/dashboard/forests");
  revalidatePath("/dashboard");
  return { ok: true };
}
