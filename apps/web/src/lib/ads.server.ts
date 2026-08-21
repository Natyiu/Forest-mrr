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

import { Polar } from "@polar-sh/sdk";

/**
 * Fulfil an ad checkout from its id — the reliable path.
 *
 * The webhook is the ideal fulfiller, but it depends on being registered, on
 * the right events being on, and on the secret matching; when any of that is
 * off, a paying customer sees nothing. So the success redirect carries the
 * checkout id and calls this: it asks Polar whether that checkout is paid and,
 * if so, creates the spot from its metadata. Keyed on the checkout id, so it
 * and the webhook converge on one row rather than two.
 *
 * Returns whether a spot is now live, for the page to confirm to the buyer.
 */
export async function fulfilAdCheckout(checkoutId: string): Promise<boolean> {
  if (!checkoutId) return false;

  const settings = await prisma.appSettings.findUnique({
    where: { id: "default" },
    select: { polarAccessToken: true, polarSandboxMode: true },
  });
  const token = (settings?.polarAccessToken || process.env.POLAR_ACCESS_TOKEN)?.trim();
  if (!token) return false;
  const sandbox =
    settings?.polarSandboxMode ?? (process.env.POLAR_SANDBOX_MODE === "false" ? false : true);
  const polar = new Polar({ accessToken: token, ...(sandbox && { server: "sandbox" as const }) });

  let checkout: {
    status?: string;
    metadata?: Record<string, unknown>;
  };
  try {
    checkout = (await polar.checkouts.get({ id: checkoutId })) as typeof checkout;
  } catch {
    return false;
  }

  // Inclusive on purpose: any status that is not still-open, expired or failed
  // is treated as paid. The exact success word varies across Polar versions
  // (confirmed / succeeded), and a buyer who paid must never be missed over a
  // string we did not anticipate.
  const status = String(checkout.status ?? "");
  const paid = status !== "" && !["open", "expired", "failed"].includes(status);
  if (!paid) {
    // Already fulfilled by the webhook? Then it is live regardless.
    return (await prisma.adSpot.count({ where: { orderId: checkoutId } })) > 0;
  }

  const metadata = checkout.metadata ?? {};
  if (metadata.kind !== "ad-spot") return false;

  const placementRaw = String(metadata.placement ?? "bundle");
  const placement = ["garden", "forests", "bundle"].includes(placementRaw)
    ? placementRaw
    : "bundle";
  const name = String(metadata.company ?? "").trim();
  const tagline = String(metadata.tagline ?? "").trim();
  const href = String(metadata.website ?? "").trim();
  if (!name || !href) return false;

  await prisma.adSpot.upsert({
    where: { orderId: checkoutId },
    create: { orderId: checkoutId, name, tagline, href, placement },
    update: {},
  });
  return true;
}
