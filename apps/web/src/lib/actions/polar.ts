"use server";

import { auth } from "@Batman/auth";
import prisma from "@Batman/db";
import { headers } from "next/headers";
import { Polar } from "@polar-sh/sdk";

async function requireAdmin() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) throw new Error("Unauthorized");
  if (session.user.role !== "admin") throw new Error("Forbidden");
  return session;
}

async function getPolarClient() {
  await requireAdmin();

  const settings = await prisma.appSettings.findUnique({
    where: { id: "default" },
    select: { polarAccessToken: true, polarSandboxMode: true },
  });

  const token = (settings?.polarAccessToken || process.env.POLAR_ACCESS_TOKEN)?.trim();
  const sandbox = settings?.polarSandboxMode ?? (process.env.POLAR_SANDBOX_MODE === "false" ? false : true);

  if (!token?.trim()) {
    throw new Error("Polar is not configured. Add your access token in Admin → API Keys.");
  }

  return {
    polar: new Polar({
      accessToken: token,
      ...(sandbox && { server: "sandbox" as const }),
    }),
  };
}

async function getPolarClientForCheckout() {
  const settings = await prisma.appSettings.findUnique({
    where: { id: "default" },
    select: { polarAccessToken: true, polarSandboxMode: true },
  });

  const token = (settings?.polarAccessToken || process.env.POLAR_ACCESS_TOKEN)?.trim();
  const sandbox = settings?.polarSandboxMode ?? (process.env.POLAR_SANDBOX_MODE === "false" ? false : true);

  if (!token?.trim()) {
    return null;
  }

  return {
    polar: new Polar({
      accessToken: token,
      ...(sandbox && { server: "sandbox" as const }),
    }),
  };
}

export type PolarProduct = {
  id: string;
  name: string;
  description: string | null;
  isRecurring: boolean;
  recurringInterval: string | null;
  isArchived: boolean;
  prices: Array<{
    id: string;
    amountType: string;
    priceAmount: number | null;
    priceCurrency: string;
  }>;
  createdAt: string;
};

function mapProduct(p: {
  id: string;
  name: string;
  description: string | null;
  isRecurring: boolean;
  recurringInterval: string | null;
  isArchived: boolean;
  prices: Array<{
    id: string;
    amountType: string;
    priceAmount: number | null;
    priceCurrency: string;
  }>;
  createdAt: Date;
}): PolarProduct {
  return {
    id: p.id,
    name: p.name,
    description: p.description,
    isRecurring: p.isRecurring,
    recurringInterval: p.recurringInterval,
    isArchived: p.isArchived,
    prices: (p.prices ?? []).map((pr: { id: string; amountType: string; priceAmount: number | null; priceCurrency: string }) => ({
      id: pr.id,
      amountType: pr.amountType,
      priceAmount: pr.priceAmount,
      priceCurrency: pr.priceCurrency,
    })),
    createdAt: p.createdAt instanceof Date ? p.createdAt.toISOString() : String(p.createdAt),
  };
}

export async function listPolarProducts(opts?: {
  includeArchived?: boolean;
}): Promise<{ products: PolarProduct[]; error?: string }> {
  try {
    const { polar } = await getPolarClient();

    const iterator = await polar.products.list({
      isArchived: opts?.includeArchived ? undefined : false,
    });

    const items: PolarProduct[] = [];
    for await (const page of iterator) {
      const result = (page as { result?: { items?: unknown[] } }).result;
      const listItems = result?.items ?? [];
      for (const p of listItems) {
        items.push(mapProduct(p as Parameters<typeof mapProduct>[0]));
      }
      break; // first page only
    }

    return { products: items };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Failed to list products";
    return { products: [], error: msg };
  }
}

function toCurrency(c: string): "usd" | "eur" | "gbp" {
  const lower = c.toLowerCase();
  if (lower === "eur" || lower === "gbp") return lower;
  return "usd";
}

export async function createPolarProduct(data: {
  name: string;
  description?: string;
  type: "saas-monthly" | "saas-yearly" | "one-time";
  priceAmountCents: number;
  priceCurrency?: string;
}): Promise<{ product?: PolarProduct; error?: string }> {
  try {
    const { polar } = await getPolarClient();

    const isRecurring = data.type.startsWith("saas-");
    const recurringInterval =
      data.type === "saas-monthly"
        ? ("month" as const)
        : data.type === "saas-yearly"
          ? ("year" as const)
          : null;

    const price = {
      amountType: "fixed" as const,
      priceCurrency: toCurrency(data.priceCurrency ?? "usd"),
      priceAmount: Math.max(50, data.priceAmountCents),
    };

    if (isRecurring) {
      const product = await polar.products.create({
        name: data.name,
        description: data.description ?? null,
        recurringInterval: recurringInterval!,
        recurringIntervalCount: 1,
        prices: [price],
      });
      return { product: mapProduct(product as Parameters<typeof mapProduct>[0]) };
    }

    const product = await polar.products.create({
      name: data.name,
      description: data.description ?? null,
      recurringInterval: null,
      prices: [price],
    });
    return { product: mapProduct(product as Parameters<typeof mapProduct>[0]) };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Failed to create product";
    return { error: msg };
  }
}

export async function archivePolarProduct(productId: string): Promise<{ error?: string }> {
  try {
    const { polar } = await getPolarClient();
    await polar.products.update({
      id: productId,
      productUpdate: { isArchived: true },
    });
    return {};
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Failed to archive product";
    return { error: msg };
  }
}

export async function listProductsForPricing(): Promise<{
  products: PolarProduct[];
  error?: string;
}> {
  const client = await getPolarClientForCheckout();
  if (!client) {
    return { products: [] };
  }

  try {
    const { polar } = client;
    const iterator = await polar.products.list({
      isArchived: false,
    });

    const items: PolarProduct[] = [];
    for await (const page of iterator) {
      const result = (page as { result?: { items?: unknown[] } }).result;
      const listItems = result?.items ?? [];
      for (const p of listItems) {
        items.push(mapProduct(p as Parameters<typeof mapProduct>[0]));
      }
      break;
    }
    return { products: items };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Failed to list products";
    return { products: [], error: msg };
  }
}

export async function createCheckoutSession(
  productId: string,
  baseUrl?: string
): Promise<{ url?: string; error?: string }> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) {
    return { error: "You must be logged in to subscribe" };
  }

  const client = await getPolarClientForCheckout();
  if (!client) {
    return { error: "Payments are not configured" };
  }

  try {
    const origin =
      baseUrl ||
      process.env.BETTER_AUTH_URL ||
      process.env.CORS_ORIGIN ||
      "http://localhost:3001";
    const root = origin.replace(/\/$/, "");
    const successUrl = `${root}/dashboard/pro?checkout=success`;
    const returnUrl = `${root}/pricing`;

    const checkout = await client.polar.checkouts.create({
      products: [productId],
      customerEmail: session.user.email ?? undefined,
      externalCustomerId: session.user.id,
      customerName: session.user.name ?? undefined,
      successUrl,
      returnUrl,
    });

    const url = (checkout as { url?: string }).url;
    if (!url) {
      return { error: "No checkout URL returned" };
    }
    return { url };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Failed to create checkout";
    return { error: msg };
  }
}

export async function updatePolarProduct(
  productId: string,
  data: { name?: string; description?: string }
): Promise<{ product?: PolarProduct; error?: string }> {
  try {
    const { polar } = await getPolarClient();

    const product = await polar.products.update({
      id: productId,
      productUpdate: {
        name: data.name,
        description: data.description ?? null,
      },
    });

    return {
      product: mapProduct(product as Parameters<typeof mapProduct>[0]),
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Failed to update product";
    return { error: msg };
  }
}
