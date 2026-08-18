import path from "node:path";
import { config } from "dotenv";

// Load .env: try apps/web and apps/marketing when running from monorepo root
const cwd = process.cwd();
[path.resolve(cwd, "apps/web/.env"), path.resolve(cwd, "apps/marketing/.env"), path.resolve(cwd, ".env")].forEach(
  (p) => config({ path: p })
);

import { createEnv } from "@t3-oss/env-core";
import { z } from "zod";

export const env = createEnv({
  server: {
    DATABASE_URL: z.string().min(1),
    BETTER_AUTH_SECRET: z.string().min(32),
    // Allow any non-empty string here so local/dev setups with custom hosts still work
    BETTER_AUTH_URL: z.string().min(1),
    CORS_ORIGIN: z.string().min(1),
    NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
    // All keys below are optional fallbacks — prefer configuring via Admin > Settings > API Keys
    SUPABASE_URL: z.string().url().optional(),
    SUPABASE_SERVICE_ROLE_KEY: z.string().optional(),
    RESEND_API_KEY: z.string().optional(),
    RESEND_FROM_EMAIL: z.string().optional(),
    GOOGLE_CLIENT_ID: z.string().optional(),
    GOOGLE_CLIENT_SECRET: z.string().optional(),
    // Seals the payment-provider keys users import (see
    // apps/web/src/lib/revenue/secrets.ts). Optional: it falls back to
    // BETTER_AUTH_SECRET, which is already required and already 32+ chars. Set
    // it when those keys should survive rotating the auth secret.
    REVENUE_ENCRYPTION_KEY: z.string().min(32).optional(),
  },
  runtimeEnv: process.env,
  emptyStringAsUndefined: true,
});
