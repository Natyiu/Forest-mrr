"use server";

import { execSync } from "child_process";
import { readFile, writeFile } from "fs/promises";
import { dirname, resolve } from "path";
import { fileURLToPath } from "url";

import { createClient } from "@supabase/supabase-js";
import prisma from "@Batman/db";

const STORAGE_BUCKETS = ["avatars", "uploads", "attachments"] as const;

// Resolve apps/web/.env from this file's location (apps/web/src/lib/actions/setup.ts)
// so it works whether the app runs from monorepo root (turbo) or apps/web
const __dirname = dirname(fileURLToPath(import.meta.url));
const ENV_PATH = resolve(__dirname, "../../../.env");
const ROOT_PATH = resolve(__dirname, "../../../../");

export async function getSetupStatus() {
  try {
    const content = await readFile(ENV_PATH, "utf-8");
    const lines = content.split("\n").filter((l) => l.trim() && !l.startsWith("#"));
    const vars: Record<string, string> = {};
    for (const line of lines) {
      const eqIdx = line.indexOf("=");
      if (eqIdx === -1) continue;
      const key = line.slice(0, eqIdx).trim();
      const val = line.slice(eqIdx + 1).trim().replace(/^["']|["']$/g, "");
      vars[key] = val;
    }

    const isPlaceholder =
      vars.BETTER_AUTH_SECRET?.includes("dev-placeholder") ||
      vars.DATABASE_URL?.includes("batman_dev");
    return {
      exists: true,
      configured: !!(vars.DATABASE_URL && vars.BETTER_AUTH_SECRET) && !isPlaceholder,
      vars: {
        hasDatabase: !!vars.DATABASE_URL,
        hasDirectUrl: !!vars.DIRECT_URL,
        hasAuthSecret: !!vars.BETTER_AUTH_SECRET,
        hasAuthUrl: !!vars.BETTER_AUTH_URL,
        hasCors: !!vars.CORS_ORIGIN,
        hasSupabaseUrl: !!(vars.SUPABASE_URL || vars.NEXT_PUBLIC_SUPABASE_URL),
        hasSupabaseKey: !!(vars.SUPABASE_SERVICE_ROLE_KEY || vars.NEXT_PUBLIC_SUPABASE_ANON_KEY),
        hasResend: !!vars.RESEND_API_KEY,
        hasGoogle: !!(vars.GOOGLE_CLIENT_ID && vars.GOOGLE_CLIENT_SECRET),
      },
    };
  } catch {
    return {
      exists: false,
      configured: false,
      vars: {
        hasDatabase: false,
        hasDirectUrl: false,
        hasAuthSecret: false,
        hasAuthUrl: false,
        hasCors: false,
        hasSupabaseUrl: false,
        hasSupabaseKey: false,
        hasResend: false,
        hasGoogle: false,
      },
    };
  }
}

/** Load existing .env and DB values for pre-filling the setup wizard (e.g. on rerun) */
export async function getSetupValues(): Promise<Partial<{
  databaseUrl: string;
  directUrl: string;
  betterAuthUrl: string;
  corsOrigin: string;
  supabaseUrl: string;
  supabaseAnonKey: string;
  supabaseServiceRoleKey: string;
  resendApiKey: string;
  googleClientId: string;
  googleClientSecret: string;
  wantGoogle: boolean;
  polarAccessToken: string;
  polarOrganizationId: string;
  polarWebhookSecret: string;
  polarSandboxMode: boolean;
  emailVerificationEnabled: boolean;
  forgotPasswordEnabled: boolean;
}>> {
  const result: Record<string, string | boolean> = {};

  try {
    const content = await readFile(ENV_PATH, "utf-8");
    const lines = content.split("\n").filter((l) => l.trim() && !l.startsWith("#"));
    const vars: Record<string, string> = {};
    for (const line of lines) {
      const eqIdx = line.indexOf("=");
      if (eqIdx === -1) continue;
      const key = line.slice(0, eqIdx).trim();
      const val = line.slice(eqIdx + 1).trim().replace(/^["']|["']$/g, "");
      vars[key] = val;
    }

    if (vars.DATABASE_URL) result.databaseUrl = vars.DATABASE_URL;
    if (vars.DIRECT_URL) result.directUrl = vars.DIRECT_URL;
    if (vars.BETTER_AUTH_URL) result.betterAuthUrl = vars.BETTER_AUTH_URL;
    if (vars.CORS_ORIGIN) result.corsOrigin = vars.CORS_ORIGIN;
    if (vars.SUPABASE_URL || vars.NEXT_PUBLIC_SUPABASE_URL)
      result.supabaseUrl = vars.SUPABASE_URL || vars.NEXT_PUBLIC_SUPABASE_URL || "";
    if (vars.NEXT_PUBLIC_SUPABASE_ANON_KEY) result.supabaseAnonKey = vars.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (vars.SUPABASE_SERVICE_ROLE_KEY) result.supabaseServiceRoleKey = vars.SUPABASE_SERVICE_ROLE_KEY;
    if (vars.RESEND_API_KEY) result.resendApiKey = vars.RESEND_API_KEY;
    if (vars.RESEND_FROM_EMAIL) result.resendFromEmail = vars.RESEND_FROM_EMAIL;
    if (vars.GOOGLE_CLIENT_ID) result.googleClientId = vars.GOOGLE_CLIENT_ID;
    if (vars.GOOGLE_CLIENT_SECRET) result.googleClientSecret = vars.GOOGLE_CLIENT_SECRET;
    if (vars.POLAR_ACCESS_TOKEN) result.polarAccessToken = vars.POLAR_ACCESS_TOKEN;
    if (vars.POLAR_ORGANIZATION_ID) result.polarOrganizationId = vars.POLAR_ORGANIZATION_ID;
    if (vars.POLAR_WEBHOOK_SECRET) result.polarWebhookSecret = vars.POLAR_WEBHOOK_SECRET;
    if (vars.POLAR_SANDBOX_MODE !== undefined)
      result.polarSandboxMode = vars.POLAR_SANDBOX_MODE === "true";
    result.wantGoogle = !!(vars.GOOGLE_CLIENT_ID && vars.GOOGLE_CLIENT_SECRET);
  } catch {
    // .env missing or unreadable
  }

  try {
    const settings = await prisma.appSettings.findUnique({
      where: { id: "default" },
      select: {
        emailVerificationEnabled: true,
        forgotPasswordEnabled: true,
        socialLoginEnabled: true,
        polarSandboxMode: true,
        googleClientId: true,
        googleClientSecret: true,
        resendApiKey: true,
        resendFromEmail: true,
        polarAccessToken: true,
        polarOrganizationId: true,
        polarWebhookSecret: true,
      },
    });
    if (settings) {
      if (settings.emailVerificationEnabled !== null)
        result.emailVerificationEnabled = settings.emailVerificationEnabled;
      if (settings.forgotPasswordEnabled !== null)
        result.forgotPasswordEnabled = settings.forgotPasswordEnabled;
      if (settings.socialLoginEnabled !== null) result.wantGoogle = settings.socialLoginEnabled;
      if (settings.polarSandboxMode !== null) result.polarSandboxMode = settings.polarSandboxMode;
      // Prefer DB over env for secrets (DB may have been updated in Admin)
      if (settings.googleClientId) result.googleClientId = settings.googleClientId;
      if (settings.googleClientSecret) result.googleClientSecret = settings.googleClientSecret;
      if (settings.resendApiKey) result.resendApiKey = settings.resendApiKey;
      if (settings.resendFromEmail) result.resendFromEmail = settings.resendFromEmail;
      if (settings.polarAccessToken) result.polarAccessToken = settings.polarAccessToken;
      if (settings.polarOrganizationId) result.polarOrganizationId = settings.polarOrganizationId;
      if (settings.polarWebhookSecret) result.polarWebhookSecret = settings.polarWebhookSecret;
    }
  } catch {
    // DB not ready
  }

  return result;
}

const DB_PASSWORD_PLACEHOLDER = "[YOUR-PASSWORD]";

type SetupData = {
  databaseUrl: string;
  directUrl: string;
  databasePassword?: string;
  betterAuthUrl: string;
  corsOrigin: string;
  supabaseUrl?: string;
  supabaseAnonKey?: string;
  supabaseServiceRoleKey?: string;
  resendApiKey?: string;
  resendFromEmail?: string;
  googleClientId?: string;
  googleClientSecret?: string;
  emailVerificationEnabled?: boolean;
  forgotPasswordEnabled?: boolean;
  polarAccessToken?: string;
  polarOrganizationId?: string;
  polarWebhookSecret?: string;
  polarSandboxMode?: boolean;
};

function embedPasswordInUrl(url: string, password: string): string {
  if (!url.includes(DB_PASSWORD_PLACEHOLDER)) return url;
  const encoded = encodeURIComponent(password);
  return url.replaceAll(DB_PASSWORD_PLACEHOLDER, encoded);
}

export async function saveSetup(data: SetupData) {
  const betterAuthSecret = await generateAuthSecret();

  let databaseUrl = data.databaseUrl;
  let directUrl = data.directUrl;
  if (data.databasePassword) {
    databaseUrl = embedPasswordInUrl(databaseUrl, data.databasePassword);
    directUrl = embedPasswordInUrl(directUrl, data.databasePassword);
  }

  const lines: string[] = [
    "# Generated by Batman Setup Wizard",
    "",
    "# Auth (required)",
    `BETTER_AUTH_SECRET=${betterAuthSecret}`,
    `BETTER_AUTH_URL=${data.betterAuthUrl}`,
    `CORS_ORIGIN=${data.corsOrigin}`,
    "",
    "# Database (required)",
    `DATABASE_URL="${databaseUrl}"`,
    `DIRECT_URL="${directUrl}"`,
  ];

  if (data.supabaseUrl || data.supabaseAnonKey || data.supabaseServiceRoleKey) {
    lines.push("", "# Supabase (file uploads)");
    if (data.supabaseUrl) {
      lines.push(`SUPABASE_URL=${data.supabaseUrl}`);
      lines.push(`NEXT_PUBLIC_SUPABASE_URL=${data.supabaseUrl}`);
    }
    if (data.supabaseAnonKey) {
      lines.push(`NEXT_PUBLIC_SUPABASE_ANON_KEY=${data.supabaseAnonKey}`);
    }
    if (data.supabaseServiceRoleKey) {
      lines.push(`SUPABASE_SERVICE_ROLE_KEY=${data.supabaseServiceRoleKey}`);
    }
  }

  if (data.resendApiKey || data.resendFromEmail) {
    lines.push("", "# Email (Resend)");
    if (data.resendApiKey) lines.push(`RESEND_API_KEY=${data.resendApiKey}`);
    lines.push(`RESEND_FROM_EMAIL=${data.resendFromEmail || "Batman <onboarding@resend.dev>"}`);
  }

  if (data.googleClientId && data.googleClientSecret) {
    lines.push("", "# Google OAuth");
    lines.push(`GOOGLE_CLIENT_ID=${data.googleClientId}`);
    lines.push(`GOOGLE_CLIENT_SECRET=${data.googleClientSecret}`);
  }

  if (data.polarAccessToken || data.polarOrganizationId || data.polarWebhookSecret) {
    lines.push("", "# Polar (payments)");
    if (data.polarAccessToken) lines.push(`POLAR_ACCESS_TOKEN=${data.polarAccessToken}`);
    if (data.polarOrganizationId) lines.push(`POLAR_ORGANIZATION_ID=${data.polarOrganizationId}`);
    if (data.polarWebhookSecret) lines.push(`POLAR_WEBHOOK_SECRET=${data.polarWebhookSecret}`);
    if (data.polarSandboxMode !== undefined)
      lines.push(`POLAR_SANDBOX_MODE=${data.polarSandboxMode ? "true" : "false"}`);
  }

  lines.push("");

  await writeFile(ENV_PATH, lines.join("\n"), "utf-8");

  try {
    execSync("pnpm db:generate && pnpm db:push", {
      cwd: ROOT_PATH,
      stdio: "pipe",
      encoding: "utf-8",
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const execErr = err as { stderr?: string; stdout?: string };
    const stderr = execErr?.stderr ? String(execErr.stderr).trim() : "";
    const stdout = execErr?.stdout ? String(execErr.stdout).trim() : "";
    const output = [stderr, stdout].filter(Boolean).join("\n");
    throw new Error(
      `Database setup failed. .env was saved. Run \`pnpm db:push\` manually from the project root.\n\n${output || msg}`
    );
  }

  if (data.supabaseUrl && data.supabaseServiceRoleKey) {
    try {
      const supabase = createClient(data.supabaseUrl, data.supabaseServiceRoleKey);
      for (const bucket of STORAGE_BUCKETS) {
        const { error } = await supabase.storage.createBucket(bucket, { public: true });
        if (error && !error.message?.toLowerCase().includes("already exists")) {
          console.warn(`Supabase storage: could not create bucket "${bucket}":`, error.message);
        }
      }
    } catch (e) {
      console.warn("Supabase storage: could not create buckets:", e);
    }
  }

  const hasGoogle = !!(data.googleClientId && data.googleClientSecret);
  const hasSocial = hasGoogle;
  const hasPolar =
    data.polarAccessToken ||
    data.polarOrganizationId ||
    data.polarWebhookSecret ||
    data.polarSandboxMode !== undefined;
  const hasAuthSettings =
    hasSocial ||
    data.resendApiKey ||
    data.resendFromEmail ||
    data.emailVerificationEnabled !== undefined ||
    data.forgotPasswordEnabled !== undefined ||
    hasPolar;

  if (hasAuthSettings) {
    try {
      await prisma.appSettings.upsert({
        where: { id: "default" },
        update: {
          ...(hasSocial && {
            googleClientId: hasGoogle ? data.googleClientId! : null,
            googleClientSecret: hasGoogle ? data.googleClientSecret! : null,
            socialLoginEnabled: hasSocial,
          }),
          ...(data.resendApiKey !== undefined && {
            resendApiKey: data.resendApiKey || null,
          }),
          ...(data.resendFromEmail !== undefined && {
            resendFromEmail: data.resendFromEmail || null,
          }),
          ...(data.emailVerificationEnabled !== undefined && {
            emailVerificationEnabled: data.emailVerificationEnabled,
          }),
          ...(data.forgotPasswordEnabled !== undefined && {
            forgotPasswordEnabled: data.forgotPasswordEnabled,
          }),
          ...(hasPolar && {
            polarAccessToken: data.polarAccessToken || null,
            polarOrganizationId: data.polarOrganizationId || null,
            polarWebhookSecret: data.polarWebhookSecret || null,
            polarSandboxMode: data.polarSandboxMode ?? undefined,
          }),
        },
        create: {
          id: "default",
          googleClientId: hasGoogle ? data.googleClientId! : null,
          googleClientSecret: hasGoogle ? data.googleClientSecret! : null,
          socialLoginEnabled: hasSocial,
          resendApiKey: data.resendApiKey || null,
          resendFromEmail: data.resendFromEmail || null,
          emailVerificationEnabled: data.emailVerificationEnabled ?? false,
          forgotPasswordEnabled: data.forgotPasswordEnabled ?? true,
          polarAccessToken: data.polarAccessToken || null,
          polarOrganizationId: data.polarOrganizationId || null,
          polarWebhookSecret: data.polarWebhookSecret || null,
          polarSandboxMode: data.polarSandboxMode ?? true,
        },
      });
    } catch {
      // DB may not be migrated yet; user can add config later in Admin → API Keys
    }
  }

  return { success: true };
}

export async function generateAuthSecret() {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Buffer.from(bytes).toString("base64");
}
