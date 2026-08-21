# Forest MRR — Environment Variables Setup Guide

This guide explains every environment variable used by Forest MRR, where to get each value, and how they map to features (auth, database, email, OAuth, payments, storage).

> **Tip:** The Setup Wizard (`pnpm dev` → localhost:3001) generates `.env` for you. Use this guide when configuring manually or troubleshooting.

---

## Required (minimum to run)

### Auth

| Variable | Description | Where to get it |
|----------|-------------|-----------------|
| `BETTER_AUTH_SECRET` | Secret for signing sessions/tokens. Min 32 chars. | Generate: `openssl rand -base64 32` |
| `BETTER_AUTH_URL` | Your app URL (e.g. `http://localhost:3001` or `https://yourapp.com`) | Your deployed URL |
| `CORS_ORIGIN` | Allowed origin for auth requests. Usually same as `BETTER_AUTH_URL` | Same as above |

**Used for:** Login, signup, sessions, password reset, OAuth callbacks.

---

### Database

| Variable | Description | Where to get it |
|----------|-------------|-----------------|
| `DATABASE_URL` | **Transaction** connection string (for queries). Use port **6543** with Supabase Pooler. | Supabase Dashboard → Settings → Database → Connection string (Transaction, port 6543) |
| `DIRECT_URL` | **Session** connection string (for migrations). Use port **5432**. | Supabase Dashboard → Settings → Database → Connection string (Session, port 5432) |

**Used for:** Prisma ORM, all app data, auth sessions, admin settings.

**Supabase note:** Transaction URL uses `?pgbouncer=true`; Direct URL does not. Both are in the Supabase connection string panel.

---

## Optional (enable features)

### Supabase Storage (file uploads, avatars)

| Variable | Description | Where to get it |
|----------|-------------|-----------------|
| `SUPABASE_URL` | Supabase project URL | Supabase Dashboard → Settings → API |
| `NEXT_PUBLIC_SUPABASE_URL` | Same as above (needed for client) | Same |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Public anon key | Supabase Dashboard → Settings → API |
| `SUPABASE_SERVICE_ROLE_KEY` | Service role key (server-only, never expose) | Supabase Dashboard → Settings → API |

**Used for:** Avatars, file uploads, attachments. Buckets (`avatars`, `uploads`, `attachments`) are created automatically.

**Alternative:** Configure via **Admin > API Keys** — values in DB override `.env`.

---

### Email (Resend)

| Variable | Description | Where to get it |
|----------|-------------|-----------------|
| `RESEND_API_KEY` | Resend API key | [resend.com](https://resend.com) → API Keys |
| `RESEND_FROM_EMAIL` | "From" address for emails | Your verified domain, e.g. `noreply@yourdomain.com` |

**Used for:** Password reset, email verification, org invitations.

**Testing:** Resend provides `onboarding@resend.dev` for testing. For production, add your domain at resend.com/domains.

**Alternative:** Configure via **Admin > API Keys**.

---

### Google OAuth (social login)

| Variable | Description | Where to get it |
|----------|-------------|-----------------|
| `GOOGLE_CLIENT_ID` | OAuth client ID | [Google Cloud Console](https://console.cloud.google.com) → APIs & Services → Credentials |
| `GOOGLE_CLIENT_SECRET` | OAuth client secret | Same |

**Used for:** "Sign in with Google" button. Toggle on/off in **Admin > Features**.

**Setup:** Create OAuth 2.0 credentials, add `http://localhost:3001/api/auth/callback/google` (dev) and your prod callback URL.

**Alternative:** Configure via **Admin > API Keys**.

---

### GitHub OAuth (social login)

| Variable | Description | Where to get it |
|----------|-------------|-----------------|
| `GITHUB_CLIENT_ID` | OAuth App Client ID | [GitHub Developer Settings](https://github.com/settings/developers) → OAuth Apps |
| `GITHUB_CLIENT_SECRET` | OAuth App Client Secret | Same |

**Used for:** "Sign in with GitHub" button. Toggle on/off in **Admin > Features**.

**Note:** GitHub OAuth is configured via **Admin > API Keys** (stored in DB), not `.env`. Add these in the dashboard for production.

---

### Polar (payments, subscriptions)

| Variable | Description | Where to get it |
|----------|-------------|-----------------|
| `POLAR_ACCESS_TOKEN` | Polar API token | [polar.sh](https://polar.sh) → Settings → Access Tokens |
| `POLAR_ORGANIZATION_ID` | Your Polar org ID | Polar Dashboard → Organization |
| `POLAR_WEBHOOK_SECRET` | Webhook signing secret | Polar Dashboard → Webhooks → Create webhook |
| `POLAR_SANDBOX_MODE` | `true` = test mode, `false` = live | Set `false` for production |

**Used for:** Subscriptions, one-time purchases, checkout. Webhook URL: `https://yourapp.com/api/webhooks/polar`.

**Alternative:** Configure via **Admin > API Keys**.

---

## Marketing app (seller-only)

If you run the marketing app (`apps/marketing`) for selling the boilerplate:

| Variable | Description | Where to get it |
|----------|-------------|-----------------|
| `POLAR_MARKETING_PRODUCT_ID` | Polar product ID for the boilerplate | Polar Dashboard → Products |
| `POLAR_MARKETING_ACCESS_TOKEN` | Polar token (or use `POLAR_ACCESS_TOKEN`) | Same as Polar |
| `POLAR_MARKETING_WEBHOOK_SECRET` | Webhook secret for marketing orders | Polar → Webhooks |
| `POLAR_MARKETING_SANDBOX` | `true` for test purchases | Set `false` for live |
| `MARKETING_URL` | Marketing site URL (for download links in email) | e.g. `https://marketing.yourapp.com` |

Create `.env` in `apps/marketing/` or reuse `apps/web/.env` (both are loaded).

---

## Priority order

1. **Admin > API Keys** — Values stored in the database take precedence.
2. **`.env`** — Fallback for keys not set in Admin.

Use Admin for production so you can rotate keys without redeploying.

---

## Quick reference

| Feature | Required vars | Optional vars |
|---------|---------------|---------------|
| **Auth** | `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`, `CORS_ORIGIN` | — |
| **Database** | `DATABASE_URL`, `DIRECT_URL` | — |
| **File uploads** | — | `SUPABASE_*` |
| **Email** | — | `RESEND_API_KEY`, `RESEND_FROM_EMAIL` |
| **Google OAuth** | — | `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` |
| **GitHub OAuth** | — | Via Admin > API Keys |
| **Payments** | — | `POLAR_*` |
