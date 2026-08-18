"use server";

import { auth } from "@Batman/auth";
import prisma, { Prisma } from "@Batman/db";
import { headers } from "next/headers";
import { notifyUser } from "@/lib/notify";

/** Default settings when app_settings table doesn't exist yet (e.g. before db:push) */
const DEFAULT_APP_SETTINGS = {
  id: "default",
  onboardingEnabled: true,
  appName: "Batman",
  appDescription: "",
  appUrl: "",
  metaTitle: null as string | null,
  metaDescription: null as string | null,
  ogImage: null as string | null,
  appTheme: "default",
  emailVerificationEnabled: false,
  forgotPasswordEnabled: true,
  socialLoginEnabled: false,
  organizationsEnabled: false,
  invitesEnabled: false,
  maintenanceMode: false,
  maintenanceMessage: "We're performing scheduled maintenance. We'll be back shortly.",
  defaultUserRole: "user",
  maxUsersEnabled: false,
  maxUsers: 0,
  supportEmail: "",
  privacyContent: "",
  termsContent: "",
  signupsEnabled: true,
  sessionTimeout: 30,
  supabaseUrl: null as string | null,
  supabaseAnonKey: null as string | null,
  supabaseServiceRoleKey: null as string | null,
  resendApiKey: null as string | null,
  resendFromEmail: "noreply@updates.yourdomain.com",
  googleClientId: null as string | null,
  googleClientSecret: null as string | null,
  githubClientId: null as string | null,
  githubClientSecret: null as string | null,
  polarAccessToken: null as string | null,
  polarOrganizationId: null as string | null,
  polarWebhookSecret: null as string | null,
  polarSandboxMode: true,
  waitlistMode: false,
  waitlistTitle: "Join the waitlist",
  waitlistHeadline: "Be the first to know when we launch",
  waitlistDescription: "",
  waitlistButtonText: "Join waitlist",
  waitlistSuccessMessage: "You're on the list! We'll notify you when we launch.",
  waitlistShowName: false,
  waitlistShowCompany: false,
  countdownMode: false,
  countdownTarget: null as Date | null,
  countdownTitle: "Coming soon",
  countdownHeadline: "We're launching soon",
  countdownDescription: "",
  countdownEndMessage: "We're live! Check back soon.",
  updatedAt: new Date(),
};

export async function updateProfile(data: {
  name?: string;
  bio?: string;
  image?: string;
}) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) throw new Error("Unauthorized");

  await prisma.user.update({
    where: { id: session.user.id },
    data,
  });

  const changes: string[] = [];
  if (data.name) changes.push("name");
  if (data.bio) changes.push("bio");
  if (data.image) changes.push("avatar");

  if (changes.length > 0) {
    await notifyUser(session.user.id, {
      title: "Profile updated",
      description: `You updated your ${changes.join(", ")}.`,
      tag: "update",
      senderId: session.user.id,
    });
  }

  return { success: true };
}

export async function completeOnboarding() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) throw new Error("Unauthorized");

  await prisma.user.update({
    where: { id: session.user.id },
    data: { onboardingCompleted: true },
  });

  await notifyUser(session.user.id, {
    title: "Onboarding completed",
    description: "You've completed the onboarding flow. Welcome to the dashboard!",
    tag: "general",
    senderId: session.user.id,
  });

  return { success: true };
}

export async function getAppSettings() {
  try {
    let settings = await prisma.appSettings.findUnique({
      where: { id: "default" },
    });

    if (!settings) {
      // Sync from .env when creating first row — onboarding config should apply
      const hasGoogle = !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
      const hasResend = !!process.env.RESEND_API_KEY;
      settings = await prisma.appSettings.create({
        data: {
          id: "default",
          socialLoginEnabled: hasGoogle,
          emailVerificationEnabled: hasResend,
          forgotPasswordEnabled: true,
          googleClientId: process.env.GOOGLE_CLIENT_ID || null,
          googleClientSecret: process.env.GOOGLE_CLIENT_SECRET || null,
          resendApiKey: process.env.RESEND_API_KEY || null,
        },
      });
    } else {
      // One-time sync: if .env has creds but DB has schema defaults, update from env
      const hasGoogleEnv = !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
      const hasResendEnv = !!process.env.RESEND_API_KEY;
      const needsSync =
        (hasGoogleEnv && !settings.googleClientId) ||
        (hasResendEnv && !settings.resendApiKey);
      if (needsSync) {
        try {
          settings = await prisma.appSettings.update({
            where: { id: "default" },
            data: {
              ...(hasGoogleEnv && {
                googleClientId: process.env.GOOGLE_CLIENT_ID || null,
                googleClientSecret: process.env.GOOGLE_CLIENT_SECRET || null,
                socialLoginEnabled: true,
              }),
              ...(hasResendEnv && {
                resendApiKey: process.env.RESEND_API_KEY || null,
                emailVerificationEnabled: true,
                forgotPasswordEnabled: true,
              }),
            },
          });
        } catch {
          // Ignore update failures
        }
      }
    }

    return settings;
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2021") {
      return DEFAULT_APP_SETTINGS;
    }
    // Connection refused, schema not pushed, or DB not ready — return defaults
    return DEFAULT_APP_SETTINGS;
  }
}

export async function getStorageUrl(): Promise<string> {
  const settings = await getAppSettings();
  return settings.supabaseUrl || process.env.NEXT_PUBLIC_SUPABASE_URL || "";
}

export async function getAuthConfig() {
  const settings = await getAppSettings();
  const hasGoogleFromEnv = !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
  const hasGoogleFromDb = !!(settings.googleClientId && settings.googleClientSecret);
  const hasGoogle = hasGoogleFromEnv || hasGoogleFromDb;

  // When env has Google creds (from onboarding), always show — DB may have schema default false
  // Otherwise respect DB toggle (Admin can disable)
  const googleEnabled =
    hasGoogle && (hasGoogleFromEnv || settings.socialLoginEnabled !== false);

  return {
    socialLoginEnabled: settings.socialLoginEnabled,
    googleEnabled,
    forgotPasswordEnabled: settings.forgotPasswordEnabled ?? true,
    organizationsEnabled: settings.organizationsEnabled,
    invitesEnabled: settings.invitesEnabled,
    signupsEnabled: settings.signupsEnabled ?? true,
  };
}
