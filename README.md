# Batman

This project was created with [Better Fullstack](https://github.com/Marve10s/Better-Fullstack), a modern TypeScript stack that combines Next.js, Prisma, Better Auth, and more.

## Features

- **TypeScript** — Strict mode with type-safe environment variables
- **Next.js 16** — App Router, React 19, React Compiler, typed routes
- **TailwindCSS 4** — Utility-first CSS framework
- **shadcn/ui** — Radix Nova + Base UI components
- **Prisma 7** — TypeScript-first ORM with PostgreSQL
- **Better Auth** — Email/password, OAuth (Google/GitHub), email verification, password reset
- **Turborepo** — Optimized monorepo build system
- **Supabase Storage** — File uploads (avatars, documents, attachments)
- **Resend** — Transactional email (verification, password reset, invitations)

### Built-in Functionality

- **Roles & Permissions** — Admin plugin with custom access control (`admin`, `user` roles) and fine-grained permissions per resource
- **Admin Panel** — Dedicated admin dashboard with its own sidebar: Users, Notifications, General, Features, API Keys
- **Social Login (OAuth)** — Google and GitHub sign-in, toggleable from admin panel
- **Email Verification** — Verify user emails on sign-up, toggleable from admin panel
- **Password Reset** — Forgot password flow with email reset link
- **Organizations / Teams** — Create organizations, manage members with roles (owner/admin/member), toggleable from admin panel
- **Invitations** — Email invitations to join organizations, toggleable from admin panel
- **File Uploads** — Drag-and-drop file manager backed by Supabase Storage with image previews
- **Settings Pages** — Profile (name, bio, avatar), account (change password, delete account, sessions), appearance (theme)
- **Notifications System** — Admin-composed notifications with tags and attachments, user inbox with filtering and read/unread tracking, automatic notifications on key events
- **Onboarding Flow** — Multi-step wizard for new users, toggleable from admin panel
- **Error Pages** — Custom 404, 500, and global error boundary
- **Dark/Light/System Theme** — `next-themes` with toggle

### Admin Feature Toggles

All major features can be toggled on/off from the admin panel (**Admin > Features**):

| Toggle | What it controls |
|---|---|
| Onboarding Flow | New user setup wizard |
| Email Verification | Require email verification on sign-up |
| Social Login (OAuth) | Show Google/GitHub buttons on login/signup |
| Organizations / Teams | Users can create and manage organizations |
| Email Invitations | Org owners can invite members via email |

## Installation

### 1. Clone or extract the project

```bash
# If you downloaded the zip (from purchase):
unzip Batman.zip && cd Batman

# Or if cloning:
git clone <your-repo-url>
cd Batman
```

> **Selling on Vibecoded or similar?** Run `pnpm run build:download` to generate `Batman.zip` with the correct structure (`package.json` at zip root, `pnpm-workspace.yaml`, `apps/web`, `packages/*` — no marketing app). Upload that zip to your distribution platform.

### 2. Install dependencies

```bash
pnpm install
```

### 3. Set up environment variables

Create a `.env` file inside the `apps/web/` directory:

```bash
touch apps/web/.env
```

Add the following variables (this is all you need):

```env
BETTER_AUTH_SECRET=
BETTER_AUTH_URL=http://localhost:3001
CORS_ORIGIN=http://localhost:3001
DATABASE_URL=
DIRECT_URL=
```

| Variable | Description |
|---|---|
| `BETTER_AUTH_SECRET` | Random secret, min 32 chars. Generate with `openssl rand -base64 32` |
| `BETTER_AUTH_URL` | App URL, e.g. `http://localhost:3001` |
| `CORS_ORIGIN` | Same as `BETTER_AUTH_URL` |
| `DATABASE_URL` | Supabase **Transaction** connection string (port `6543`, `?pgbouncer=true`) |
| `DIRECT_URL` | Supabase **Session** connection string (port `5432`) |

> **That's it for `.env`.** All other API keys (Supabase, Resend, Google OAuth, GitHub OAuth) are configured from **Admin > API Keys** — no code or env file changes needed. Keys set in the dashboard are stored in the database and take priority over any `.env` fallbacks.
>
> **Full setup guide:** See [docs/ENV_SETUP.md](docs/ENV_SETUP.md) for every variable (db, auth, email, OAuth, payments), where to get each value, and what it controls.

### 4. Set up the database

Generate the Prisma client and push the schema:

```bash
pnpm db:generate
pnpm db:push
```

### 5. Create the first admin user

Sign up through the app normally, then promote yourself to admin. Either:

- Run in Prisma Studio (`pnpm db:studio`) and set the user's `role` field to `"admin"`
- Or add your user ID to the `adminUserIds` array in `packages/auth/src/index.ts`

### 6. Run the development server

```bash
pnpm dev
```

Open [http://localhost:3001](http://localhost:3001).

### 7. Configure API keys from the dashboard

After signing up and promoting yourself to admin, go to **Admin > API Keys** to configure:

- **Supabase** — Project URL, Anon Key, and Service Role Key (for file uploads, avatars, attachments). Buckets (`avatars`, `uploads`, `attachments`) are created automatically.
- **Resend** — API Key and From Email (for password reset, email verification, invitations)
- **Google OAuth** — Client ID and Secret (for social login)
- **GitHub OAuth** — Client ID and Secret (for social login)

All keys are stored in the database and can be changed anytime without redeploying.

## Project Structure

```
Batman/
├── apps/
│   └── web/                          # Next.js application
│       └── src/
│           ├── app/
│           │   ├── page.tsx                # Landing page
│           │   ├── not-found.tsx           # 404 page
│           │   ├── error.tsx               # Error boundary
│           │   ├── global-error.tsx        # Root error fallback
│           │   ├── (auth)/                 # Login, signup, forgot/reset password
│           │   ├── onboarding/             # New user onboarding wizard
│           │   └── dashboard/
│           │       ├── page.tsx            # Dashboard home
│           │       ├── organizations/      # Org management (create, members, roles)
│           │       ├── invitations/        # Pending org invitations
│           │       ├── notifications/      # Notification inbox (filter, read/unread)
│           │       ├── settings/           # Profile, account, appearance
│           │       └── admin/              # Admin panel (own sidebar layout)
│           │           ├── page.tsx       # Users management
│           │           ├── notifications/ # Compose & send notifications
│           │           ├── general/       # App name & core settings
│           │           ├── features/      # Feature toggles
│           │           └── api-keys/      # Third-party API credentials
│           ├── components/
│           │   ├── ui/                     # shadcn/ui components
│           │   └── ...                     # App components
│           └── lib/
│               ├── auth-client.ts          # Better Auth client + admin + organization plugins
│               ├── supabase.ts             # Supabase Storage client
│               ├── notify.ts               # Auto-notification helpers (notifyAdmins, notifyUser)
│               ├── notification-tags.ts    # Shared tag constants
│               ├── session.ts              # Server-side session helpers
│               ├── utils.ts                # cn() utility
│               └── actions/
│                   ├── user.ts             # Profile, onboarding, auth config actions
│                   ├── admin.ts            # Admin-only server actions (settings, stats)
│                   └── notifications.ts    # Notification send, read, filter actions
├── packages/
│   ├── auth/                         # Better Auth config + permissions
│   │   └── src/
│   │       ├── index.ts              # Auth instance (admin, organization plugins, email, OAuth, hooks)
│   │       └── permissions.ts        # Access control definitions
│   ├── db/                           # Prisma schema & client
│   │   └── prisma/schema/
│   │       ├── schema.prisma         # Generator & datasource
│   │       ├── auth.prisma           # User, Session, Account, Verification
│   │       ├── app.prisma            # AppSettings (feature toggles)
│   │       ├── organization.prisma   # Organization, Member, Invitation
│   │       └── notification.prisma   # Notification, NotificationRecipient
│   ├── env/                          # Type-safe env validation (T3 Env)
│   └── config/                       # Shared TypeScript config
```

## Roles & Permissions

Roles are managed through Better Auth's admin plugin with custom access control.

| Role | Permissions |
|---|---|
| `user` | Create/read projects, upload/read files, read settings |
| `admin` | Full CRUD on all resources + user management (ban, role assignment, impersonation) |

### Organization Roles

When organizations are enabled, members have one of three roles:

| Role | Permissions |
|---|---|
| `owner` | Full control, delete org, manage all members |
| `admin` | Manage members, invite, change roles |
| `member` | Basic access to the organization |

## Admin Panel

Clicking "Admin" in the main dashboard sidebar opens a **dedicated admin area** with its own sidebar navigation — each section gets its own page instead of being crammed into tabs.

| Page | Path | What it does |
|---|---|---|
| **Users** | `/dashboard/admin` | List, search, paginate users. Change roles, ban/unban, remove. |
| **Notifications** | `/dashboard/admin/notifications` | Compose and send notifications (all users or specific), tags, file attachments, send history with delivery/read stats. |
| **General** | `/dashboard/admin/general` | App name and core settings. |
| **Features** | `/dashboard/admin/features` | Toggle onboarding, email verification, social login, organizations, invites. |
| **API Keys** | `/dashboard/admin/api-keys` | Configure Supabase, Resend, Google OAuth, GitHub OAuth credentials — stored in DB, no code changes needed. |

A "Back to app" link at the top of the admin sidebar returns to the main dashboard. On mobile, the sidebar collapses into a horizontal tab strip.

## Automatic Notifications

Admins automatically receive notifications when users perform key actions. These are fire-and-forget — they never block or break the user's flow.

| Event | Tag | Hook Location |
|---|---|---|
| New user sign-up | `general` | Better Auth `databaseHooks` |
| Profile updated (name, bio, avatar) | `update` | Server action (`actions/user.ts`) |
| Onboarding completed | `general` | Server action (`actions/user.ts`) |
| File uploaded | `update` | API route (`api/upload`) |
| File deleted | `update` | API route (`api/upload`) |
| Password changed | `security` | Better Auth `hooks.after` middleware |
| Account deleted | `security` | Better Auth `hooks.after` middleware |

To add your own automatic notifications, use the `notifyAdmins` or `notifyUser` helpers from `src/lib/notify.ts`.

## Available Scripts

| Command | Description |
|---|---|
| `pnpm dev` | Start all apps in development mode |
| `pnpm dev:web` | Start web app only |
| `pnpm build` | Build all applications |
| `pnpm check-types` | Type-check across all packages |
| `pnpm db:generate` | Generate the Prisma client |
| `pnpm db:push` | Push schema changes to database |
| `pnpm db:migrate` | Run database migrations |
| `pnpm db:studio` | Open Prisma Studio |
