"use server";

import prisma from "@Batman/db";
import { z } from "zod";

const joinSchema = z.object({
  email: z.string().email(),
  name: z.string().optional(),
  company: z.string().optional(),
});

export type JoinWaitlistResult =
  | { success: true }
  | { success: false; error: string };

/** Public: get waitlist UI settings (no auth) */
export async function getWaitlistSettings() {
  const settings = await prisma.appSettings.findUnique({
    where: { id: "default" },
    select: {
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

  if (!settings?.waitlistMode) return null;

  return {
    title: settings.waitlistTitle,
    headline: settings.waitlistHeadline,
    description: settings.waitlistDescription,
    buttonText: settings.waitlistButtonText,
    successMessage: settings.waitlistSuccessMessage,
    showName: settings.waitlistShowName ?? false,
    showCompany: settings.waitlistShowCompany ?? false,
    appName: settings.appName ?? "Forest MRR",
    supportEmail: settings.supportEmail ?? "",
  };
}

/** Public: join waitlist (no auth) */
export async function joinWaitlist(
  data: { email: string; name?: string; company?: string }
): Promise<JoinWaitlistResult> {
  const parsed = joinSchema.safeParse(data);
  if (!parsed.success) {
    return { success: false, error: "Invalid email address" };
  }

  const settings = await prisma.appSettings.findUnique({
    where: { id: "default" },
    select: { waitlistMode: true, waitlistShowName: true, waitlistShowCompany: true },
  });

  if (!settings?.waitlistMode) {
    return { success: false, error: "Waitlist is not open" };
  }

  const payload = {
    email: parsed.data.email.toLowerCase(),
    name: settings.waitlistShowName ? parsed.data.name ?? null : null,
    company: settings.waitlistShowCompany ? parsed.data.company ?? null : null,
  };

  try {
    await prisma.waitlistEntry.upsert({
      where: { email: payload.email },
      update: payload,
      create: payload,
    });
    return { success: true };
  } catch {
    return { success: false, error: "Something went wrong. Please try again." };
  }
}
