import "server-only";

import prisma from "@Batman/db";

import { AD_SLOTS_PER_SIDE, type AdSpot } from "@/lib/ads";

/**
 * The sold inventory, oldest sale first — the order the ten slots fill in.
 * Managed from the admin console's Ads page; a deleted row disappears from
 * every surface on the next render, no deploy involved.
 */
export async function getAdSpots(): Promise<AdSpot[]> {
  const rows = await prisma.adSpot.findMany({
    orderBy: { createdAt: "asc" },
    take: AD_SLOTS_PER_SIDE * 2,
    select: { id: true, name: true, tagline: true, href: true, image: true },
  });
  return rows;
}
