import "server-only";

import prisma from "@Batman/db";

import { AD_SLOTS_PER_SIDE, type AdSpot } from "@/lib/ads";

/**
 * The sold inventory for one surface, oldest sale first.
 *
 * A spot appears exactly where it was bought for: the garden strip shows spots
 * bought for `garden` or the `bundle`; the forests rails show `forests` or the
 * `bundle`. A bundle buyer stands on both pages from one row.
 */
export async function getAdSpots(surface: "garden" | "forests"): Promise<AdSpot[]> {
  const rows = await prisma.adSpot.findMany({
    where: { placement: { in: [surface, "bundle"] } },
    orderBy: { createdAt: "asc" },
    take: AD_SLOTS_PER_SIDE * 2,
    select: { id: true, name: true, tagline: true, href: true, image: true },
  });
  return rows;
}
