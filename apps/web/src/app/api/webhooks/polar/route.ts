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
