import prisma from "@Batman/db";
import { env } from "@Batman/env/server";
import { betterAuth } from "better-auth";
import { APIError, createAuthMiddleware } from "better-auth/api";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { nextCookies } from "better-auth/next-js";
import { admin as adminPlugin, organization } from "better-auth/plugins";
import { Resend } from "resend";

import { ac, admin, user } from "./permissions";

export { ac, admin, user } from "./permissions";

let _settingsCache: {
  data: Awaited<ReturnType<typeof prisma.appSettings.findUnique>>;
  ts: number;
} | null = null;

async function getSettings() {
  try {
    if (_settingsCache && Date.now() - _settingsCache.ts < 10_000) {
      return _settingsCache.data;
    }
    const data = await prisma.appSettings.findUnique({ where: { id: "default" } });
    _settingsCache = { data, ts: Date.now() };
    return data;
  } catch {
    return null;
  }
}

export function invalidateSettingsCache() {
  _settingsCache = null;
}

async function getResendClient(): Promise<Resend | null> {
  const settings = await getSettings();
  const apiKey = settings?.resendApiKey || env.RESEND_API_KEY;
  if (!apiKey) return null;
  return new Resend(apiKey);
}

const RESEND_DEFAULT_FROM = "Batman <onboarding@resend.dev>";

async function sendEmail(to: string, subject: string, html: string) {
  try {
    const resend = await getResendClient();
    if (!resend) {
      console.error("[Auth] Email not sent: no RESEND_API_KEY configured");
      return;
    }
    const settings = await getSettings();
    const customFrom =
      settings?.resendFromEmail?.trim() || env.RESEND_FROM_EMAIL?.trim();
    const from =
      customFrom && !customFrom.includes("yourdomain.com")
        ? customFrom
        : RESEND_DEFAULT_FROM;
    const { error } = await resend.emails.send({ from, to, subject, html });
    if (error) {
      console.error("[Auth] Resend error:", error);
    }
  } catch (err) {
    console.error("[Auth] Email send failed:", err);
  }
}

async function notifyAllAdmins(data: {
  title: string;
  description: string;
  tag: string;
  senderId: string;
}) {
  try {
    const admins = await prisma.user.findMany({
      where: { role: "admin" },
      select: { id: true },
    });
    if (admins.length === 0) return;

    await prisma.notification.create({
      data: {
        ...data,
        recipients: {
          create: admins.map((a) => ({ userId: a.id })),
        },
      },
    });
  } catch {
    // Never break auth flow for notifications
  }
}

async function getGoogleCredentials() {
  const settings = await getSettings();
  const clientId = settings?.googleClientId || env.GOOGLE_CLIENT_ID;
  const clientSecret = settings?.googleClientSecret || env.GOOGLE_CLIENT_SECRET;
  return clientId && clientSecret ? { clientId, clientSecret } : null;
}

const googleCreds = env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET
  ? { clientId: env.GOOGLE_CLIENT_ID, clientSecret: env.GOOGLE_CLIENT_SECRET }
  : { clientId: "placeholder", clientSecret: "placeholder" };

let _requireEmailVerification = false;
let _sessionExpiresIn = 60 * 60 * 24 * 7; // 7 days default
let _sessionUpdateAge = 60 * 60 * 24; // 1 day
try {
  const s = await prisma.appSettings.findUnique({ where: { id: "default" } });
  _requireEmailVerification = s?.emailVerificationEnabled ?? false;
  const days = s?.sessionTimeout ?? 30;
  _sessionExpiresIn = Math.max(1, Math.min(365, days)) * 24 * 60 * 60;
  _sessionUpdateAge = Math.min(_sessionExpiresIn / 2, 60 * 60 * 24); // refresh at most every day
} catch {
  // DB not ready
}

export const auth = betterAuth({
  database: prismaAdapter(prisma, {
    provider: "postgresql",
  }),

  baseURL: env.BETTER_AUTH_URL,
  trustedOrigins: [env.CORS_ORIGIN],

  session: {
    expiresIn: _sessionExpiresIn,
    updateAge: _sessionUpdateAge,
  },

  emailAndPassword: {
    enabled: true,
    requireEmailVerification: _requireEmailVerification,
    async sendResetPassword({ user, url }) {
      const settings = await getSettings();
      const appName = settings?.appName ?? "Batman";
      await sendEmail(
        user.email,
        `Reset your ${appName} password`,
        `<p>Hi ${user.name ?? "there"},</p><p>Click the link below to reset your password:</p><p><a href="${url}">${url}</a></p><p>If you didn't request this, ignore this email.</p>`,
      );
    },
  },

  emailVerification: {
    sendOnSignUp: true,
    sendOnSignIn: true,
    autoSignInAfterVerification: true,
    async sendVerificationEmail({ user, url }) {
      const settings = await getSettings();
      if (!settings?.emailVerificationEnabled) return;
      const appName = settings.appName ?? "Batman";
      // Land on the dashboard after verification
      try {
        const urlObj = new URL(url);
        urlObj.searchParams.set("callbackURL", "/dashboard");
        url = urlObj.toString();
      } catch {
        // url might be relative, keep as-is
      }
      await sendEmail(
        user.email,
        `Verify your ${appName} email`,
        `<p>Hi ${user.name ?? "there"},</p><p>Click the link below to verify your email:</p><p><a href="${url}">${url}</a></p>`,
      );
    },
  },

  socialProviders: {
    google: googleCreds,
  },

  user: {
    additionalFields: {
      bio: { type: "string", required: false, input: true },
    },
  },

  databaseHooks: {
    user: {
      create: {
        before: async (_user, ctx) => {
          // Allow admin-created users (admin.createUser)
          const session = ctx?.context
            ? (ctx.context as { session?: { user?: { role?: string } } })?.session
            : undefined;
          if (session?.user?.role === "admin") {
            return { data: _user };
          }

          const settings = await getSettings();
          if (!settings?.signupsEnabled) {
            throw new APIError("BAD_REQUEST", {
              message: "Signups are currently disabled.",
            });
          }

          if (settings.maxUsersEnabled && settings.maxUsers > 0) {
            const count = await prisma.user.count();
            if (count >= settings.maxUsers) {
              throw new APIError("BAD_REQUEST", {
                message: "Registration is closed. Maximum user limit reached.",
              });
            }
          }

          return { data: _user };
        },
        after: async (newUser) => {
          const settings = await getSettings();
          const count = await prisma.user.count();
          const isFirstUser = count === 1;

          const role = isFirstUser
            ? "admin"
            : (settings?.defaultUserRole === "admin" ? "admin" : "user");

          await prisma.user.update({
            where: { id: newUser.id },
            data: { role },
          });

          if (isFirstUser) {
            try {
              await prisma.notification.create({
                data: {
                  title: "You're the admin",
                  description: "As the first user, you have full admin access. You can manage users, settings, and everything from the admin dashboard.",
                  tag: "general",
                  senderId: "system",
                  recipients: {
                    create: [{ userId: newUser.id }],
                  },
                },
              });
            } catch {
              // Never break auth flow for notifications
            }
          } else {
            try {
              await prisma.notification.create({
                data: {
                  title: "Welcome",
                  description: "You've created your account. Get started by exploring the dashboard.",
                  tag: "general",
                  senderId: "system",
                  recipients: {
                    create: [{ userId: newUser.id }],
                  },
                },
              });
            } catch {
              // Never break auth flow for notifications
            }
          }
        },
      },
    },
  },

  hooks: {
    after: createAuthMiddleware(async (ctx) => {
      const session =
        ctx.context.newSession ??
        ((ctx.context as Record<string, unknown>).session as
          | { user: { id: string; name?: string; email?: string } }
          | undefined);

      if (ctx.path === "/change-password" && session?.user) {
        try {
          await prisma.notification.create({
            data: {
              title: "Password changed",
              description: "Your password was updated successfully.",
              tag: "security",
              senderId: "system",
              recipients: {
                create: [{ userId: session.user.id }],
              },
            },
          });
        } catch {
          // Never break auth flow for notifications
        }
      }
      // delete-user: user is gone, no notification needed
    }),
  },

  plugins: [
    nextCookies(),
    adminPlugin({
      ac,
      roles: { admin, user },
    }),
    organization({
      async sendInvitationEmail({ email, organization: org, inviter }) {
        const settings = await getSettings();
        if (!settings?.invitesEnabled) return;
        const appName = settings.appName ?? "Batman";
        const acceptUrl = `${env.BETTER_AUTH_URL}/dashboard/invitations`;
        await sendEmail(
          email,
          `You're invited to ${org.name} on ${appName}`,
          `<p>${inviter.user.name ?? "Someone"} invited you to join <strong>${org.name}</strong> on ${appName}.</p><p><a href="${acceptUrl}">Accept Invitation</a></p>`,
        );
      },
    }),
  ],
});

export { getGoogleCredentials, getResendClient };
