"use server";

import { z } from "zod";
import { Polar } from "@polar-sh/sdk";

import prisma from "@Batman/db";

import { requireSession } from "@/lib/session";
import { BUNDLE_PRICE, FORESTS_SPOT_PRICE, GARDEN_SPOT_PRICE } from "@/lib/ads";

/**
 * **Buying an ad spot: form → Polar checkout.**
 *
 * The dialog collects who the advertiser is — company, one line, website — and
 * this turns it into a Polar checkout for the right price and redirects them
 * to pay. The advertiser's details travel as checkout **metadata**, so the
 * order that lands in Polar carries everything needed to fill the spot: the
 * sale is completed by reading the order and adding one entry to
 * `lib/ads.ts`'s inventory.
 *
 * The three products are **ensured, not assumed**: looked up in Polar by their
 * exact names and created (one-time, fixed price) the first time anyone tries
 * to buy — so nobody has to remember to set up products in a dashboard before
 * the first sale can happen. Prices come from the same rate card the dialogs
 * quote; if the card changes, a stale product with the old price is the bug,
 * which is why the lookup checks the price too and creates a fresh product
 * when it no longer matches.
 */

const PLACEMENT_PRODUCTS = {
  garden: {
    name: "Ad spot — Garden page",
    description: "Your product pinned on the Forest MRR garden page.",
    priceCents: GARDEN_SPOT_PRICE * 100,
  },
  forests: {
    name: "Ad spot — Forests board",
    description: "Your product pinned on the Forest MRR forests board.",
    priceCents: FORESTS_SPOT_PRICE * 100,
  },
  bundle: {
    name: "Ad spots — Garden + Forests bundle",
    description: "Your product pinned on both Forest MRR pages.",
    priceCents: BUNDLE_PRICE * 100,
  },
} as const;

/**
 * The three products, pinned by id.
 *
 * When these are set, checkouts use *your* products exactly as configured in
 * Polar — name, price, tax category, everything — and the ensure-by-name
 * fallback below never runs. Leave one empty and that placement falls back to
 * finding-or-creating a product by name, so the flow works either way.
 */
const CONFIGURED_PRODUCT_IDS: Record<keyof typeof PLACEMENT_PRODUCTS, string | undefined> = {
  garden: process.env.POLAR_AD_PRODUCT_GARDEN?.trim() || undefined,
  forests: process.env.POLAR_AD_PRODUCT_FORESTS?.trim() || undefined,
  bundle: process.env.POLAR_AD_PRODUCT_BUNDLE?.trim() || undefined,
};

const input = z.object({
  placement: z.enum(["garden", "forests", "bundle"]),
  company: z.string().trim().min(1).max(60),
  tagline: z.string().trim().min(1).max(120),
  website: z.string().trim().min(1).max(200),
});

/** Same rule as startup websites: https by default, http(s) only. */
function normaliseWebsite(raw: string): string | null {
  const candidate = /^[a-z][a-z0-9+.-]*:/i.test(raw) ? raw : `https://${raw}`;
  try {
    const url = new URL(candidate);
    if (url.protocol !== "https:" && url.protocol !== "http:") return null;
    return url.toString();
  } catch {
    return null;
  }
}

async function polarClient(): Promise<Polar | null> {
  const settings = await prisma.appSettings.findUnique({
    where: { id: "default" },
    select: { polarAccessToken: true, polarSandboxMode: true },
  });
  const token = (settings?.polarAccessToken || process.env.POLAR_ACCESS_TOKEN)?.trim();
  const sandbox =
    settings?.polarSandboxMode ?? (process.env.POLAR_SANDBOX_MODE === "false" ? false : true);
  if (!token) return null;
  return new Polar({ accessToken: token, ...(sandbox && { server: "sandbox" as const }) });
}

interface ListedProduct {
  id: string;
  name: string;
  prices?: Array<{ priceAmount?: number }>;
}

async function ensureAdProduct(
  polar: Polar,
  placement: keyof typeof PLACEMENT_PRODUCTS,
): Promise<string> {
  const wanted = PLACEMENT_PRODUCTS[placement];

  const iterator = await polar.products.list({ isArchived: false });
  for await (const page of iterator) {
    const items =
      ((page as { result?: { items?: ListedProduct[] } }).result?.items ?? []) as ListedProduct[];
    const match = items.find(
      (product) =>
        product.name === wanted.name &&
        (product.prices ?? []).some((price) => price.priceAmount === wanted.priceCents),
    );
    if (match) return match.id;
    break; // first page only — three known names live near the top or not at all
  }

  const created = await polar.products.create({
    name: wanted.name,
    description: wanted.description,
    recurringInterval: null,
    prices: [
      {
        amountType: "fixed" as const,
        priceCurrency: "usd" as const,
        priceAmount: wanted.priceCents,
      },
    ],
  });
  return (created as { id: string }).id;
}

export async function createAdCheckout(
  raw: unknown,
): Promise<{ ok: true; url: string } | { ok: false; message: string }> {
  const session = await requireSession();

  const parsed = input.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, message: "Please fill in every field." };
  }

  const website = normaliseWebsite(parsed.data.website);
  if (!website) {
    return { ok: false, message: "That does not look like a web address." };
  }

  const polar = await polarClient();
  if (!polar) {
    return { ok: false, message: "Payments are not configured yet — email us instead." };
  }

  try {
    const productId =
      CONFIGURED_PRODUCT_IDS[parsed.data.placement] ??
      (await ensureAdProduct(polar, parsed.data.placement));

    const origin = (
      process.env.BETTER_AUTH_URL ||
      process.env.CORS_ORIGIN ||
      "http://localhost:3001"
    ).replace(/\/$/, "");

    const base = {
      products: [productId],
      externalCustomerId: session.user.id,
      customerName: session.user.name ?? undefined,
      successUrl: `${origin}/dashboard/forests?ad-checkout=success`,
      returnUrl: `${origin}/dashboard/forests`,
      metadata: {
        kind: "ad-spot",
        placement: parsed.data.placement,
        company: parsed.data.company,
        tagline: parsed.data.tagline,
        website,
      },
    };

    // Prefill the buyer's email, but never let it sink the sale: Polar
    // validates deliverability, and an address it refuses just means the buyer
    // types their email on the checkout page instead.
    let checkout;
    try {
      checkout = await polar.checkouts.create({
        ...base,
        customerEmail: session.user.email ?? undefined,
      });
    } catch (emailError) {
      if (emailError instanceof Error && /valid email/i.test(emailError.message)) {
        checkout = await polar.checkouts.create(base);
      } else {
        throw emailError;
      }
    }

    const url = (checkout as { url?: string }).url;
    if (!url) return { ok: false, message: "Polar returned no checkout page." };
    return { ok: true, url };
  } catch (e) {
    return {
      ok: false,
      message: e instanceof Error ? e.message : "Could not start the checkout.",
    };
  }
}
