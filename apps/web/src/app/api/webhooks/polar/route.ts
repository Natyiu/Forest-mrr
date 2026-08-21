import { NextRequest, NextResponse } from "next/server";
import prisma from "@Batman/db";
import { validateEvent, WebhookVerificationError } from "@polar-sh/sdk/webhooks";

export async function POST(req: NextRequest) {
  try {
    const body = await req.text();
    const headers: Record<string, string> = {};
    req.headers.forEach((v, k) => {
      headers[k.toLowerCase()] = v;
    });

    const settings = await prisma.appSettings.findUnique({
      where: { id: "default" },
      select: { polarWebhookSecret: true },
    });

    const secret = (settings?.polarWebhookSecret || process.env.POLAR_WEBHOOK_SECRET)?.trim();
    if (!secret) {
      console.error("[Polar webhook] No webhook secret configured");
      return NextResponse.json({ error: "Webhook not configured" }, { status: 500 });
    }

    const event = validateEvent(body, headers, secret);
    const type = (event as { type?: string }).type;
    const data = event.data as Record<string, unknown> | undefined;

    // A paid ad order fills the spot it was bought for, automatically. Polar
    // copies checkout metadata onto the order, so everything the box needs —
    // which page, the company, its line, its link — arrives here. Keyed on the
    // order id so a re-delivered webhook fills it once, not twice.
    if (data && (type === "order.paid" || type === "order.created")) {
      const paid =
        type === "order.paid" ||
        String((data as { status?: string }).status ?? "") === "paid";
      const metadata =
        ((data as { metadata?: Record<string, unknown> }).metadata ??
          {}) as Record<string, unknown>;

      if (paid && metadata.kind === "ad-spot") {
        const orderId = String((data as { id?: string }).id ?? "");
        const placementRaw = String(metadata.placement ?? "bundle");
        const placement = ["garden", "forests", "bundle"].includes(placementRaw)
          ? placementRaw
          : "bundle";
        const name = String(metadata.company ?? "").trim();
        const tagline = String(metadata.tagline ?? "").trim();
        const href = String(metadata.website ?? "").trim();

        if (orderId && name && href) {
          await prisma.adSpot.upsert({
            where: { orderId },
            create: { orderId, name, tagline, href, placement },
            update: {},
          });
        }
      }
      return NextResponse.json({ received: true });
    }

    if (!type?.startsWith("subscription.")) {
      return NextResponse.json({ received: true });
    }
    if (!data) return NextResponse.json({ received: true });

    // Polar uses snake_case in webhook payloads
    const customer = (data.customer ?? data) as { email?: string } | undefined;
    const email = (customer?.email ?? (data as { email?: string }).email) as string | undefined;
    if (!email?.trim()) {
      if (process.env.NODE_ENV === "development") {
        console.warn("[Polar webhook] No customer email in payload:", JSON.stringify(data, null, 2).slice(0, 500));
      }
      return NextResponse.json({ received: true });
    }

    const subId = String(data.id ?? data.subscription_id ?? "");
    const status = String(data.status ?? "active");
    const periodEndRaw = data.current_period_end ?? data.currentPeriodEnd;
    const periodEnd = periodEndRaw ? new Date(periodEndRaw as string) : new Date(0);
    const cancelAtPeriodEnd = Boolean(data.cancel_at_period_end ?? data.cancelAtPeriodEnd);
    const productId = (data.product_id ?? data.productId) as string | undefined;
    const customerId = String(data.customer_id ?? data.customerId ?? "");

    const emailNorm = email.toLowerCase().trim();
    const user = await prisma.user.findUnique({
      where: { email: emailNorm },
      select: { id: true },
    });

    if (!user || !subId) {
      return NextResponse.json({ received: true });
    }

    await prisma.subscription.upsert({
      where: { userId: user.id },
      create: {
        userId: user.id,
        polarSubscriptionId: subId,
        polarCustomerId: customerId,
        productId,
        status,
        currentPeriodEnd: periodEnd,
        cancelAtPeriodEnd,
      },
      update: {
        polarSubscriptionId: subId,
        polarCustomerId: customerId,
        productId,
        status,
        currentPeriodEnd: periodEnd,
        cancelAtPeriodEnd,
      },
    });

    return NextResponse.json({ received: true });
  } catch (e) {
    if (e instanceof WebhookVerificationError) {
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
    }
    console.error("[Polar webhook]", e);
    return NextResponse.json({ error: "Webhook processing failed" }, { status: 500 });
  }
}
