"use server";

import prisma, { Prisma } from "@Batman/db";

/** Public: get site mode settings (countdown, waitlist) - no auth */
export async function getSiteSettings() {
  try {
    const settings = await prisma.appSettings.findUnique({
      where: { id: "default" },
      select: {
        countdownMode: true,
        countdownTarget: true,
        countdownTitle: true,
        countdownHeadline: true,
        countdownDescription: true,
        countdownEndMessage: true,
        waitlistMode: true,
        waitlistTitle: true,
        waitlistHeadline: true,
        waitlistDescription: true,
        waitlistButtonText: true,
        waitlistSuccessMessage: true,
        waitlistShowName: true,
        waitlistShowCompany: true,
        appName: true,
        supportEmail: true,
      },
    });

    if (!settings) return { countdown: null, waitlist: null };

    const countdown =
      settings.countdownMode && settings.countdownTarget
        ? {
          target: settings.countdownTarget.toISOString(),
          title: settings.countdownTitle ?? "Coming soon",
          headline: settings.countdownHeadline ?? "We're launching soon",
          description: settings.countdownDescription ?? "",
          endMessage: settings.countdownEndMessage ?? "We're live! Check back soon.",
          appName: settings.appName ?? "Batman",
          supportEmail: settings.supportEmail ?? "",
        }
      : null;

    const waitlist = settings.waitlistMode
      ? {
          title: settings.waitlistTitle ?? "Join the waitlist",
          headline: settings.waitlistHeadline ?? "Be the first to know when we launch",
          description: settings.waitlistDescription ?? "",
          buttonText: settings.waitlistButtonText ?? "Join waitlist",
          successMessage: settings.waitlistSuccessMessage ?? "You're on the list!",
          showName: settings.waitlistShowName ?? false,
          showCompany: settings.waitlistShowCompany ?? false,
          appName: settings.appName ?? "Batman",
          supportEmail: settings.supportEmail ?? "",
        }
      : null;

    return { countdown, waitlist };
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2021") {
      return { countdown: null, waitlist: null };
    }
    // Connection errors, missing DB, or schema not pushed — show setup wizard
    return { countdown: null, waitlist: null };
  }
}
