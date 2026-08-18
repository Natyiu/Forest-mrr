import prisma from "@Batman/db";

const ACTIVE_STATUSES = ["active", "trialing"] as const;

export type SubscriptionStatus = {
  isSubscribed: boolean;
  subscription: {
    id: string;
    status: string;
    currentPeriodEnd: Date;
    cancelAtPeriodEnd: boolean;
  } | null;
};

export async function getSubscriptionStatus(userId: string): Promise<SubscriptionStatus> {
  const sub = await prisma.subscription.findUnique({
    where: { userId },
  });

  if (!sub) {
    return { isSubscribed: false, subscription: null };
  }

  const now = new Date();
  const isActive =
    ACTIVE_STATUSES.includes(sub.status as (typeof ACTIVE_STATUSES)[number]) &&
    sub.currentPeriodEnd > now;

  return {
    isSubscribed: isActive,
    subscription: {
      id: sub.id,
      status: sub.status,
      currentPeriodEnd: sub.currentPeriodEnd,
      cancelAtPeriodEnd: sub.cancelAtPeriodEnd,
    },
  };
}

export async function requireSubscription(userId: string): Promise<SubscriptionStatus> {
  const status = await getSubscriptionStatus(userId);
  if (!status.isSubscribed) {
    throw new SubscriptionRequiredError();
  }
  return status;
}

export class SubscriptionRequiredError extends Error {
  constructor() {
    super("Subscription required");
    this.name = "SubscriptionRequiredError";
  }
}
