# Batman — X/Twitter Post Generator Context

Use this file as context when generating X/Twitter posts (single posts or threads) for Batman.

---

## Product Overview

**Name:** Batman  
**Tagline:** Founder stack / boilerplate  
**What it is:** A production-ready Next.js boilerplate for indie founders and solo builders who want to ship SaaS products fast. Built with Better Fullstack.

**One-liner:** Auth, admin panel, organizations, notifications, and file uploads — wired up so founders can focus on product, not plumbing.

---

## Target Audience

- Indie founders who code
- Solo builders / bootstrappers
- Developers shipping their own SaaS
- People who want to launch in days, not weeks
- Founders who don't have a team and need everything to "just work"

---

## Positioning

- **Founder stack** — built for founders who ship
- **Ship in days, not weeks** — cut setup time from weeks to hours
- **Production-ready** — not a toy starter, actual functionality
- **Modern stack** — 2025-ready, no legacy cruft
- **Less plumbing, more product** — stop reinventing auth/admin/orgs

---

## Tech Stack

| Layer | Tech |
|-------|------|
| Frontend | Next.js 16, React 19, React Compiler, Tailwind 4, shadcn/ui |
| Backend | Self (Next.js API routes), Zod validation |
| Database | PostgreSQL, Prisma 7 (TypeScript-first ORM) |
| Auth | Better Auth (email/password, Google, GitHub OAuth) |
| Storage | Supabase Storage (avatars, documents, attachments) |
| Email | Resend (verification, password reset, invitations) |
| Monorepo | Turborepo, pnpm |

---

## Key Features (for post angles)

### Auth & Account
- Email/password sign-up and login
- OAuth: Google, GitHub (toggleable from admin)
- Email verification (toggleable)
- Password reset flow
- Profile: name, bio, avatar
- Account: change password, sessions, delete account
- Appearance: dark/light/system theme

### Admin Panel
- Dedicated admin area with its own sidebar
- **Users:** list, search, paginate, change roles, ban/unban, impersonation
- **Notifications:** compose and send to all users or specific users, tags, file attachments, delivery/read stats
- **General:** app name and core settings
- **Features:** toggle onboarding, email verification, OAuth, organizations, invites — no code changes
- **API Keys:** Supabase, Resend, Google OAuth, GitHub OAuth — stored in DB, configure from dashboard, no redeploy needed

### Organizations / Teams
- Create organizations
- Invite members by email
- Roles: owner, admin, member
- Pending invitations with accept/decline
- Toggle on/off from admin

### Notifications
- Admin-composed notifications
- User inbox with filtering, read/unread
- Auto-notifications: new sign-up, profile update, onboarding complete, file upload/delete, password change, account deleted
- Tags and file attachments

### File Uploads
- Supabase Storage
- Drag-and-drop file manager
- Image previews
- Avatars, documents, attachments
- Buckets created automatically

### Roles & Permissions
- `admin` vs `user` with fine-grained access
- Resource-level permissions
- Impersonation for support
- Admin plugin with custom access control

### Other
- Onboarding wizard (multi-step, toggleable)
- Custom 404, 500, global error boundary
- Type-safe env (T3 Env)

---

## Differentiators (USP)

1. **API keys in the database** — Configure Supabase, Resend, Google, GitHub from Admin > API Keys. Stored in DB. Change anytime without redeploying. No env var juggling.

2. **Feature toggles** — Turn onboarding, email verification, OAuth, orgs, invites on/off from the admin panel. No code changes.

3. **Admin panel that's actually usable** — Full user management, notification composer, feature toggles, API key config. Not a stub.

4. **Organizations built in** — Teams, invites, roles. Toggle on/off. No third-party service.

5. **Notification system** — Admin sends, users receive, auto-notifications on key events. Tags, attachments. Built-in.

6. **Quick setup** — Clone, 5 env vars, `pnpm db:push`, ship.

---

## Pain Points It Solves

- "I waste weeks building auth from scratch"
- "Admin panels are boring and I keep postponing them"
- "I need orgs/teams but don't want to integrate a third-party"
- "Configuring OAuth and API keys is a nightmare"
- "I want to ship, not spend a month on plumbing"
- "Boilerplates are either too minimal or too bloated"

---

## Tone & Voice

- **Confident** — not apologetic, not hedging
- **Direct** — short sentences, punchy
- **Founder-to-founder** — speaks to someone who codes and ships
- **Conversion-minded** — highlights value, urgency, differentiation
- **Avoid:** generic, corporate, feature-dump without benefit

---

## Suggested Angles for Posts

- Founder stack / built for founders who ship
- Ship in days, not weeks
- API keys in the DB (no redeploy)
- Feature toggles (no code changes)
- Admin panel that actually works
- Stop building plumbing
- Solo founder? Ship faster
- Clone → 5 env vars → ship
- Built for 2025
- Less plumbing, more product

---

## CTA Options

- Link in bio
- Link below
- Built with Better Fullstack
- Founder stack. Ship faster.

---

## Setup Summary (for "how easy" angles)

1. Clone repo  
2. Create `.env` with 5 variables: `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`, `CORS_ORIGIN`, `DATABASE_URL`, `DIRECT_URL`  
3. `pnpm db:push`  
4. Sign up, promote to admin (via Prisma Studio or config)  
5. Configure API keys from Admin > API Keys  
6. Ship

---

## Repo / Links

- Built with [Better Fullstack](https://github.com/Marve10s/Better-Fullstack)
- (Add your purchase/landing link when generating posts)
