# Batman bo

This file provides context about the project for AI assistants.

## Project Overview

- **Ecosystem**: Typescript

## Tech Stack

- **Runtime**: none
- **Package Manager**: pnpm

### Frontend

- Framework: next
- CSS: tailwind
- UI Library: shadcn-ui

### Backend

- Framework: self
- Validation: zod

### Database

- Database: postgres
- ORM: prisma

### Authentication

- Provider: better-auth

### Additional Features

- Testing: vitest
- AI: vercel-ai

## Project Structure

```
Batman/
├── apps/
│   ├── allotment/   # The garden, standalone (Express + Vite + React 19) — see below
│   ├── marketing/   # Marketing landing & purchase flow (seller-only, excluded from boilerplate)
│   └── web/         # Next.js app, port 3001. The garden lives here now:
│       └── src/
│           ├── garden/          # ported source: lib/, components/, server/
│           ├── lib/
│           │   ├── revenue/     # payment-provider registry, sealing, live probes
│           │   └── actions/     # server actions (incl. revenue.ts)
│           ├── components/
│           │   └── revenue/     # the connect dialog and the connections list
│           └── app/
│               ├── dashboard/   # /dashboard IS the garden
│               └── api/garden/  # garden, history, plans, stream, simulate-event
├── packages/
│   ├── auth/        # Authentication
│   └── db/          # Database schema
```

### Where the garden runs (allotment → web)

**The garden is `http://localhost:3001/dashboard`.** It was ported out of the
standalone Vite app into `apps/web`, so there is one server, one build and one
login rather than a second app on port 3000.

`apps/allotment` is still on disk and still runs (`pnpm --filter react-example
dev`, port 3000), but it is now **a second copy of the same source and will
drift**. `apps/web/src/garden` is the one that ships. Delete the standalone app
when you are confident in the port; nothing in `apps/web` imports it.

What the port had to change, and why:

- **`/dashboard` replaced `DashboardHome`.** The card grid is still exported
  from `dashboard/dashboard-shell.tsx` if it is ever wanted back. Auth, email
  verification, onboarding and maintenance are all settled by
  `dashboard/layout.tsx` before the garden renders.
- **One top bar, on every page, and it is the plot's own.** Three bands —
  wordmark left, the Garden · Startups · Settings pill centred *on the viewport*,
  the account cluster right — rendered by `dashboard-shell.tsx` on every route
  and by the garden's own HUD on `/dashboard`, from the same two components
  (`dashboard/garden-chrome.tsx`: `GardenBrand`, `GardenNav`). The plot still
  gets the bare `h-screen w-screen overflow-hidden` wrapper, because the bar it
  needs is inside it: `garden-view.tsx` hands `App` the same nodes as
  `brandSlot` / `navSlot` alongside `accountSlot` and `startupSlot`. A sidebar
  on the pages and a floating bar on the plot was two navigations for one
  product, and the one you learned first was not the one on the second screen.
  `EmptyPlot` carries the bar too — that is the screen a new account lands on,
  and it was the one route with no way out but the account menu.
- **The three destinations are disjoint.** Startups used to live at
  `/dashboard/settings/revenue`, so pressing *Startups* lit *Settings* as well:
  one was inside the other. It is `/dashboard/startups` (and
  `/dashboard/startups/[id]` for one business) now, `Settings` keeps only
  Profile / Account / Appearance, and each button opens its own thing and
  nothing else. Anything that revalidates after a startup or connection changes
  points at the new path.
  Everything the old header carried — notifications, the account menu, Pricing,
  feedback, admin, sign out — is in `dashboard/garden-account.tsx`.
- **The account menu is built from the garden's HUD primitives, not shadcn.**
  The two style systems answer to different theme owners — shadcn follows
  `next-themes`, the garden follows its own mode-and-season — so a shadcn
  popover opening over a winter-midnight plot is a white card on a black field.
  Borrowing `Surface`/`IconButton`/`Popover` means the menu is lit by whatever
  season the plot is in. `FeedbackDialog` is the deliberate exception: a form,
  opened rarely, and the host app's.
- **There is one light/dark switch, and it is in the top right of every page.**
  See "One theme, one switch" below. The garden's palette button used to own
  light/dark *on this page only*, which is what made the plot's theme feel like
  the plot's; it now keeps the season, which is the setting only it has.
- **`Popover` no longer defaults its width or padding.** Two `w-*` or two `p-*`
  utilities on one element is decided by stylesheet order, not class-string
  order, so a "default" every caller overrides is a coin toss. Call sites pass
  both.
- **`Popover` is opaque; `Surface` is frosted.** `Surface` takes a `solid` prop
  that *swaps* the background class rather than adding a second one (same
  stylesheet-order trap), and every `Popover` sets it. The translucent default
  is right for chrome that floats over the plot — a toolbar, a status card —
  where seeing a little of the scene through it keeps the plot the subject. It
  is wrong for anything you read a list in: canopy showing through the startup
  switcher is a texture behind text, and at 0.88 the blur does not save it. A
  thing you have opened to read is the subject while it is open.
- **Client-only.** `dashboard/garden-view.tsx` loads `garden/App` with
  `ssr: false`. The plot is a `<canvas>` on a `requestAnimationFrame` loop that
  measures its own container and reads `matchMedia`; there is no useful HTML for
  a server to send, and this keeps the sprite and metrics bundle off the server.
- **The API is namespaced and gated.** `/api/stream` and `/api/simulate-event`
  became `/api/garden/stream` and `/api/garden/simulate-event` — those names are
  too generic to own at the root of a real app — and all five handlers now
  require a session (`garden/server/guard.ts`). Standalone this had no auth
  because it had no users; mounted behind a login, an unauthenticated write into
  shared server state is not a thing to leave on.
- **Server state is pinned to `globalThis`** (`garden/server/state.ts`), the way
  the Prisma client is. Next re-evaluates route modules on edit, and a fresh
  module means a fresh book — re-rolling every customer because somebody saved a
  file is exactly what "one book, sampled at many dates" exists to prevent.
- **The accent family is `--garden-*`, not `--accent-*`.** shadcn already owns
  `--accent`, and the garden paints its tokens onto `<html>`; a second owner
  would not look like a clash, it would look like the whole app's chrome turning
  emerald. Everything else (`surface`, `ink`, `warn`, `danger`, `track`, …) was
  free. The tokens live at the bottom of `apps/web/src/index.css`, because
  Tailwind generates utilities from `@theme` and there is one entry point.
- **One dark mode, one store.** `next-themes` owns light/dark for the whole app,
  and the garden defers to it — see "One theme, one switch" below. The garden's
  layout effect still cleans up `data-season` and every chrome token on unmount,
  but **not** `data-mode` or `color-scheme`: those are the host's on every page,
  and clearing them on the way out of the plot is what used to turn the next
  page light.
- **Offline still works.** If `/api/garden` fails or 401s, the client keeps the
  book it generated on mount and the status block reads OFFLINE.

### The landing page (web)

**`app/landing-page.tsx` — a poster, reproduced from the design.** `page.tsx`
keeps the waitlist and countdown gating (the first-run setup wizard that used
to stand in front of it is deleted — `.env` is configured by hand) and
renders this instead of the boilerplate's starter card.

**Above the fold is one painted band** (`.forest-landing` in index.css). The
ground, the clouds and the plot are **one image** — `public/landing-bg.svg`, the
design's own export — set as the section's `background-image`. Hand-authored
cloud paths and a separate `<img>` of the plot did the same job for a while and
were both deleted: the artwork is one drawing, and reproducing it in two layers
meant two things to keep in step with a design that ships as one file. The
section carries `aspect-[1918/1325]` so the whole image is on screen at any
width, with a `min-h` floor for phones, and `bg-fl-ground` behind it — the mint
in the file is `#E8F8EE` exactly, so letterboxing is invisible.

On top of it: the wordmark and a single pill, a two-line headline with a leaf
tile set inside it, one sentence, two buttons. Sizes are the design's own,
measured off it — 88px headline at 1.02 leading, 70px pill and buttons, 22px
sub-line — stepping down below `lg` because the design is a 1728px canvas and
nothing in it was drawn for a phone.

- **A CSS background takes no `alt`.** The plot is the page's only picture of the
  product, so its description is carried as an `sr-only` paragraph rather than
  being lost to a decorative background.

- **The phone has its own design, reproduced below `sm`.** `public/landing-bg-mobile.svg`
  is the design's 430×932 export — mint, clouds and the plot in the lower 60% — set at
  100% width with the section held to that aspect, full-bleed and unframed. Sizes are
  measured off it against Manrope: a `10.45vw` headline (45px at 430, one line on a
  360px phone), an 11px sub-line, 112×39 buttons 14px apart, a 97×33 pill in the header.
  Between `sm` and `lg` there is no design, so the band gives up its fixed height and
  parks the desktop artwork along its bottom edge. The root `zoom: 0.8` is `lg:` only.

- **The landing page alone is set in Manrope**, loaded with `next/font` at module scope
  in `landing-page.tsx` and applied on its root; every other route stays on Geist.

- **The palette is five tokens, not five hexes in the JSX.** `--fl-ground`,
  `--fl-cloud`, `--fl-green`, `--fl-ink`, `--fl-muted`. It deliberately **does
  not follow light/dark**: this is a painted surface, the same argument that
  keeps a printed poster one colour in every room. Everything below the band is
  ordinary themed surface.
- **The green's contrast is under the line, and that is the design's.** Measured:
  `#39BD58` is **2.44:1 against white** (button labels) and **2.22:1 against the
  ground** (the accent words) — below the 4.5 a label needs and the 3.0 large
  accent text needs. The ink is fine at 19.1:1 and the sub-line is 4.32:1.
  `#1F8637` is the same hue at the step where white-on-green reaches 4.64 and
  green-on-ground 4.22; swapping `--fl-green` is the whole change.
- **The leaf tile is sized in `em`.** The headline is 40/62/88px across three
  breakpoints; a tile in pixels needs a class per breakpoint that somebody will
  forget. `vertical-align` rather than a translate, so it sits on the text's own
  baseline metrics instead of being nudged by eye at one size and wrong at the
  other two.
- **The theme toggle is the one addition.** It is not in the design.
  `FloatingThemeToggle` stands down on `/` because a fixed corner button lands on
  the pill, so the switch sits beside the pill instead — it changes nothing on
  the painted band, but everything below the fold follows the theme and a page
  with no way to reach the switch is the gap that rule exists to close.

**Below the band** the page keeps its own sections: the provider strip (naming
the six the app can actually read — no customer count, no logo wall, no
testimonial, because a product whose pitch is "nothing on the plot is invented"
cannot open with an invented figure), four feature cards in the decorative
`--pop-*` family, the promises list, a closing call to action, and a footer with
a treeline standing on its top edge.

- **The four feature cards** are two boxes each — a white frame with a hairline
  and `shadow-elev-2`, and a washed panel inset inside it — so the colour lives
  *in* the card rather than being it. The wash ends at `transparent` rather than
  at a second colour, which lands it on the card's own surface and keeps it
  correct in both modes.
- **The footer treeline's** eighteen heights are a written-down list, not
  `Math.random()`: this renders on the server and again on the client, and a
  random skyline is a hydration mismatch. It is also the only way to make the row
  look planted rather than combed — identical trees are a fence.

**The hero artwork** (`public/forest-hero.png`) is a rendering of a populated
plot, not a screenshot of a live account. The figures on its stakes are a drawing
of the interface, the way every product shot is, and nothing on the page claims
them as anyone's revenue.

### The wordmark has two cuts (web)

**`public/forest-mrr.svg` (`#147E12`) is the light one; `public/forest-mrr-dark.svg`
(`#78FFA5`) is drawn on dark.** Neither can do both jobs — the dark green measures
4.56:1 on the pale page and 3.79:1 on the dark one, the mint 15.69:1 on dark and
1.10:1 on light — so each is only ever shown against the page it was drawn for.
The green was *legible* at night rather than wrong, but only just, and "just
legible" is not what a brand mark is for.

Both are served as images so they keep their own hex. Tinting the mark with
`--garden-soft` was tried and fails for a reason contrast cannot fix: that token is
seasonal, so the logo would go rust in October.

**The swap is CSS (`dark:hidden` / `dark:block`), not state.** Both are in the DOM;
reading `resolvedTheme` would render the wrong mark on the server and correct it a
tick later, which is a visible flicker on every load for a decision the stylesheet
makes before first paint. `display: none` also keeps the hidden one out of the
accessibility tree, so the alt text is not announced twice. `GardenBrand` is the
only place either file is referenced, and it is on every page and the plot.

### One theme, one switch (web)

**Light and dark are one preference, changed from the same corner of every
page.** There used to be two: `next-themes` set the `.dark` class for shadcn,
and the garden set `data-mode` for its own tokens, each with its own storage key
and its own control. They agreed only by coincidence — both defaulted to
`system` — so turning the plot dark and opening Settings gave you a white page,
and *leaving* the plot deleted `data-mode` entirely, which lit every page after
it by whatever the pre-paint script had guessed on the last full load.

- **`next-themes` is the owner.** It already had the storage key, the OS
  listener and a pre-paint script. `components/theme-sync.tsx` mirrors its
  `resolvedTheme` onto `data-mode` and `color-scheme` for the whole document, on
  every page, so the garden's tokens and shadcn's class cannot disagree.
- **The garden's `ThemeProvider` takes `mode` and `onModeChange`.** Given them
  it defers entirely — no storage write, no `data-mode`, no cleanup of it.
  Without them it behaves exactly as it always did, which is what keeps
  `apps/allotment` working: standalone, the garden *is* the app and has nobody
  to defer to. Season stays the garden's own in both cases; a season is not a
  mode and nothing outside the plot has an opinion about it.
- **The pre-paint script reads next-themes' `theme` key**, not `allotment:mode`.
  One stored preference, and the inline script and next-themes' own inline
  script read the same value so the first frame cannot be half in each mode.
- **`ThemeToggle` is one component in three places**: the dashboard's account
  cluster (every `/dashboard` route *and* the plot, since the same cluster is
  the plot's `accountSlot`), the admin console's top-right corner, and
  `FloatingThemeToggle` for pages with no chrome of their own — marketing, auth,
  onboarding, blog, pricing, legal. The floating one returns `null` inside
  `/dashboard` and `/admin`, because two of these on one screen is the thing
  this change exists to stop. It is drawn with the garden's `IconButton`, whose
  tokens live on `:root`, so it is correctly lit everywhere rather than only
  inside the plot.
- **It cycles light → dark → system** rather than opening a menu, and the icon
  says which state it is *in* (sun / moon / monitor), not which it would go to.
  Until `next-themes` has read storage it renders the monitor, because that is
  also the default and anything else is a hydration mismatch.

The plot's appearance popover lost its Theme section and the admin sidebar lost
its footer toggle; both were second copies of this switch.

### Startups — many books, one account (web)

**A person can run more than one thing.** A `Startup` owns connections; a user owns
startups. Connections used to hang off the user, which made "your revenue" a single
book and made a second Stripe *impossible* — the unique key was `(userId, provider)`,
so connecting another one replaced the first. It is now `(startupId, provider)`: two
startups may each connect their own Stripe, and within one startup a provider still
appears once.

- **Everything reads inside a scope.** `lib/startups.ts` resolves one per request:
  a single startup, or `all` — every startup's subscriptions on one plot. `all` is
  not a fourth kind of book, it is the same derivation over a wider set of
  connections, which is why nothing downstream knows about it.
- **The scope lives in a cookie, not the URL.** The garden already mirrors its whole
  view into the query string; a startup is not part of *that* view, it is which book
  those filters apply to. A `?startup=` would put somebody else's id into every
  shared link and change business on a back button. Switching is therefore a server
  action (`switchStartup`), because a cookie set on the client cannot be read by the
  render that follows.
- **The cookie is a preference, never a permission.** It is checked against the
  user's own startups on every request, so a stale or copied id falls back to their
  first rather than reading somebody else's revenue.
- **Both caches are keyed by `(user, scope)`** — `harvestRevenue` and the derived
  forest — and `forgetHarvest`/`forgetForest` clear *every* scope for a user, because
  a connection that changes alters at least two books: its own and `all`.
- **Connecting creates a startup if there is none.** `ensureStartup` runs on the
  first save: the container is a means, and a form demanding one before anything
  useful can happen is a tax on the first thirty seconds.
- **Deleting a startup deletes its keys**, by `onDelete: Cascade` in the schema — a
  connection has no meaning without the business it belongs to. The keys stay valid
  at the provider until revoked there, and the confirm says so.

Three switchers, one action: the garden's toolbar (`dashboard/garden-startup.tsx`,
built from the HUD primitives so it is lit by the season), and the host-app pages
(`components/startups/startup-switcher.tsx`, shadcn).

**Managing a startup has its own page** — `/dashboard/startups/[id]`: identity
(name, emoji, a decorative tone), its connected providers (re-check, replace key,
disconnect, connect another), and delete, **last and in its own band**, because a
destructive button beside a save button is a mis-click waiting to happen.

**`/dashboard/startups` is the index, and it is a list that opens.** One row per
business — emoji, name, the providers named, and a wash-green *On the plot* chip on
the book you are looking at — expanding to its connections. Everything else was
tried on one screen at once and it read as a wall: the rule now is that **a closed
row states and an open row acts**, and that an open one carries four verbs and no
more. A connection offers *Re-check* and *Disconnect*; a startup offers *Open
forest* and *Manage*. Replacing a key and connecting a second provider are both
*changing the business*, so they live on its own page — and *Connect another* a few
pixels from *New startup*, both introduced by a plus, was two different plus buttons
on one screen. The one exception is a startup with **nothing** connected, which gets
*Connect provider* inline, because that is the one moment where the answer to "what
now?" is "connect something". The same key can legitimately appear twice on this
index — once per business — and a flat list would make two accounts look like one
duplicate.

**A startup's mark is imported from its payment provider.** `RevenueConnection.
accountImage` holds the logo the provider already has for that account, written by
the same probe that proves the key works and re-read on every *Re-check*, so a
re-brand at the provider arrives rather than sticking. `StartupView.image` is
**derived** — the oldest connection that has one — rather than a column on the
startup, because the provider owns that image and a copy here would be the wrong
logo the first time somebody changed it. Two of the six are documented to publish
one (`avatar_url` on a Polar organization, `avatar_url` on a LemonSqueezy store,
with the store preferred over the user); the other four are *scanned* for the names
this field goes by (`pickLogo` in `providers.server.ts`), so if one adds it tomorrow
it arrives free. **Stripe deliberately returns nothing**: `settings.branding.icon`
is a file ID, turning it into a URL is a write, and this key is read-only by design.
Anything not `https://` is refused, and a URL that fails to load falls back to the
emoji — Polar answers with a `logo.dev` address carrying `fallback=404` for
organizations that never uploaded one, so a 404 is a normal answer rather than a
broken-image glyph. `StartupMark` is the one component that draws this, because a
business that is a logo in the switcher and a seedling in the list reads as two
businesses.

**Making a startup and connecting it are one flow.** *New startup* opens a dialog
that asks for **the name and nothing else**, and hands the new id straight to the
connect dialog, so the second question is *which payment provider*. A row of eight
emoji stood in that dialog on the argument that a mark tells two businesses apart
in the switcher — true, and still not worth a decision at that moment: most
accounts have one startup, where the mark distinguishes it from nothing, and any
business that connects a provider gets the provider's own logo, which outranks the
emoji everywhere `StartupMark` draws one. Unset, the mark is `🌱`; it is one field
on the startup's own settings page for anyone who wants a different one, chosen
when there is a second business to tell apart. It replaced an
inline name field in the page header: the second half of the errand was always a
modal, and one errand rendered two different ways is two errands as far as a reader
is concerned.

**The plot's switcher opens the same dialog.** It used to grow a text field inside
the menu — a row changing shape under the cursor, asking for the name only, so it
could not offer the mark that tells two businesses apart in the very list it was
standing in. `NewStartupDialog` is the host app's, opened from the plot, which is
the exception `FeedbackDialog` already is: a form, opened rarely, and already
written. `createStartup` switches to the new business, so the reload lands on it —
and an empty plot's whole job is to offer the connect dialog, which is the second
half of the errand. A startup with no provider draws an empty plot, which makes "connect
it later" a promise the product then has to chase somebody about.

**The garden has no *Connect revenue* pill any more.** Connecting is a
once-per-business act — it happens when a startup is created, in onboarding, or on
that startup's settings page — so a permanent button for it was chrome competing
with the numbers it sat above. The `E` binding and the ⌘K row went with it, per the
rule that a switched-off feature is off in every surface at once. The **empty
plot's** call to action remains, because that is the one moment the answer to
"what now?" *is* "connect something".

**Migration note:** existing connections were moved into a startup called *My
startup* per user, the old `(userId, provider)` unique was dropped and the new one
added, in one transaction. `userId` is kept on the connection alongside `startupId`
so "everything this person can see" stays one indexed read.

### Importing real revenue (web)

**The plot draws a generated book; this is how a real one gets in.** A user
imports a **read-only** key from the provider they actually sell through, and
six are supported: Stripe, Polar, LemonSqueezy, DodoPayment, RevenueCat and
Superwall.

**It stands where the Stripe simulator stood.** The toolbar's primary button,
the `E` binding and the ⌘K *Panels* row all used to open
`StripeSimulatorModal` — a fake `rk_live_` field over four buttons that posted
webhooks at the plot. That modal is **deleted**; those three places now open the
connect dialog, and `Settings → Revenue` manages what has been connected. The
button was always about where the money comes from; it now means the real money
rather than a made-up webhook.

The dialog is the *host app's*, so `garden/App` never imports it: it takes an
`onConnectRevenue` callback, exactly as it takes `accountSlot` as a node, and
`dashboard/garden-view.tsx` owns the dialog and the connection list. Without the
callback the button, the key and the palette row **do not exist** — the same rule
`ENABLED_SHAPES` applies to `C`. That is what keeps `apps/allotment` compiling:
the standalone copy has no auth and no database, so it keeps its own simulator.

**The rest of the simulator is untouched.** `handleSimulateWebhook`,
`/api/garden/simulate-event`, `garden/server/simulate.ts`, the ⌘K *Simulate*
group and the per-plant triggers in `PlantDetailDrawer` all still work — what was
removed is the panel named "Stripe events", not the ability to poke the plot.

- **The providers are data, not six forms.** `lib/revenue/providers.ts` declares
  each one's ordered `steps` — the label, the placeholder, the pattern that
  validates it, and the numbered instructions for getting it — and the dialog is
  a renderer over that list. The instructions are the part a user actually
  follows, so they live next to the pattern that checks the answer; apart, the
  two drift. Adding a seventh provider is an entry there plus a probe, not a
  migration (the column is a string), not a new form.
- **The shapes differ, so the form does.** Stripe wants one key. Polar wants a
  token *and* the organization identifier, because one token can see several
  organizations and the plot must not draw somebody else's. RevenueCat
  wants a key, a project ID *and* the public verified-metrics URL. Superwall
  cannot name its applications until it has the key, so its second step is a
  `remote-select` whose options are fetched — debounced, newest-answer-wins —
  once the key matches its pattern, and its middle step is a numbered `note`
  that asks for nothing.
- **Read-only is enforced, not requested.** The Stripe field takes `rk_…` and
  refuses `sk_…`: a dashboard that reads charges should not hold a key that can
  move money. Each provider's help text says the same in its own words.
- **Nothing is stored that has not been proven.** `saveRevenueConnection`
  shape-checks locally, then makes **one live read with the same permission a
  refresh needs** (`lib/revenue/providers.server.ts`), and only then writes the
  row. A failure leaves no row and returns the provider's own words. "Connected"
  therefore means the key has answered at least once, and **Re-check** re-runs
  exactly that read — a revoked key looks identical to a working one until
  something asks it a question.
- **Two providers have a second environment behind the same key format** —
  Polar's sandbox, Dodo's test mode — and nothing in the key says which. The
  probe tries live, falls back on a 401, and records which answered rather than
  asking the user for something their dashboard already knows.
- **Keys are sealed at rest** (`lib/revenue/secrets.ts`, AES-256-GCM, key
  derived from `REVENUE_ENCRYPTION_KEY` or else `BETTER_AUTH_SECRET`). The rest
  of the app keeps operator secrets in plain columns; these belong to *users*,
  and a read-only Stripe key still reads every customer and charge a business
  has. Authenticated ciphertext means an edited row fails to open rather than
  opening to something else. The UI is only ever shown the last four characters.
- **Requires `pnpm db:push`** — `RevenueConnection` (`packages/db/prisma/schema/
  revenue.prisma`) is unique on `(userId, provider)`, so re-connecting replaces
  a key instead of leaving two rows and a coin toss over which one refreshes.

Not yet wired: **nothing maps a connected provider's data into the book of
business.** `generateBook()` still invents every subscription, and the garden
still draws that. The connection layer is the half that had to exist first — the
probes are already the reads a sync would use.

### The revenue data page (web)

**`/dashboard/revenue` — everything the connected keys can actually read.**
`lib/revenue/harvest.ts` opens each sealed credential and asks that provider for
every read-only collection its API exposes (Stripe: account, balance,
subscriptions, customers, charges, invoices, payment intents, refunds, disputes,
products, prices, coupons, payouts — and the same breadth for the other five),
all in parallel, then normalises the result.

- **A refusal is a result.** Each endpoint is reported as *answered* (records,
  the provider's own total, and **every field name seen on those records**) or
  *refused* (with the status and reason). "Your key cannot read disputes" is the
  honest half of "what can I get?", so one endpoint erroring never takes the page
  down and the field lists are what came back today rather than a hand-written
  guess.
- **The catalogue is generated, not authored.** `summariseFields()` walks the
  records for key names, types and one short example each, and never shows an
  example for a field whose *name* looks like a credential.
- **Money is integer minor units and never crosses currencies.** `currencyMix`
  keeps them apart; the headline quotes the largest and a banner names the rest,
  because dollars plus euros is not an amount. **MRR is active subscriptions
  only**, monthly-normalised through one `PER_MONTH` table, with trials and
  past-due reported beside it rather than folded in.
- **Caps are stated.** Three pages of 100 per collection; anything hitting that
  is labelled a floor rather than a total, in words, on the row.
- **RevenueCat is quoted, not recomputed.** It publishes MRR and will not hand
  over a per-subscription price list, so its own `metrics/overview` numbers are
  shown as its numbers, and its MRR enters the totals as one synthetic line.
- **The harvest is cached for a minute on `globalThis`**, per user, the way the
  garden's server state is — otherwise every navigation fires sixty requests at
  somebody's payment provider. Refresh forces a re-read.

Charts follow the `dataviz` skill: one measure per chart means **one hue**, so
there is no categorical palette to get wrong — `--chart-mark` is the single data
pigment, a token of its own because a mark answers to the card surface (≥3:1, and
inside the mode's lightness band) while `--primary` answers to a button. Both
modes were run through the validator rather than eyeballed, and the dark step is
chosen (0.62) rather than flipped, because the app's dark violet at 0.70 sits
above the band. Every chart has a hover layer and a table view; text wears ink
tokens and never the series colour.

Reachable from the garden's account menu (*Revenue data*) and from
`Settings → Revenue`.

### The graph screen (web)

**`/dashboard/graph` — the imported book, drawn.** Reached from *Open graphs* on
`/dashboard/revenue`, which is the ledger this is the trend view of. Three views
of one book now: the garden plants it, `/dashboard/revenue` lists every field the
keys can reach, this draws the shapes.

`lib/revenue/series.ts` builds every series from **`harvestToForest` — the same
derivation the plot uses** — so a figure here and the garden's headline cannot
disagree. Monthly MRR, active count and at-risk come off the forest's own
snapshots; signups and cancellations are counted from real dates; volume comes
from the fetched payments. Everything is integer minor units, matching the rest
of the revenue surface.

Form follows the question, per the `dataviz` skill:

| Chart | Why that form |
| --- | --- |
| MRR over time, active subs, ARPA | lines — a level, moving; **three charts, never one with three axes** |
| Gained vs lost logos | diverging columns, above and below a zero line |
| Payment volume by month | columns — discrete periods, one measure |
| MRR by plan / country / top 10 customers | rows — magnitude by identity, directly labelled |
| Subscription states | one labelled bar in the reserved status colours |
| Logo retention by cohort | single-hue heatmap, numbers *in* the cells |

**No dual-axis chart exists on this page** — MRR and subscription count are
different scales, so they are two charts side by side.

**The diverging pair is deliberately not green/red.** Green and red at equal
lightness sit ~5 ΔE apart for a deuteranope and the validator fails them outright,
so `--chart-gain` / `--chart-loss` are a cool/warm pair (hue 225 / 40) that
measures 18–20 ΔE under simulated CVD, and the sign is carried by position and a
legend as well as by hue. Both modes were re-stepped and re-validated
independently. The cool pole is at hue 225 rather than a truer teal because that
is what clears the 0.1 chroma floor in sRGB.

Two honesty rules the charts keep: **a cohort cell that has not happened yet is
blank, never 0%**, and **retention counts logos, not revenue** — revenue retention
needs the plan history providers do not hand over, and a triangle labelled
"retention" that quietly means the other one is worse than none.

**"No graphs" has three answers, not one.** `revenueGraphs()` returns `none`,
`empty` or `series`, because *nothing connected* and *connected, working, and the
account has no subscriptions yet* are completely different situations and the
second one is the common one. Collapsing them into a single empty state told a
user with a working Polar key to go and connect a payment provider. The `empty`
case now names each connected provider, how many subscriptions it returned, how
many endpoints answered, and which ones its key was not allowed to read. The
garden's `SAMPLE` chip carries the same distinction through `note` on
`/api/garden`, and `resolveForest()` is what supplies it.

### The real book on the plot (web)

**If the user has connected a provider, the forest is their business.**
`lib/revenue/to-garden.ts` turns the harvest into the same `Plant[]` book the
plot has always drawn — one plant per subscription — and `/api/garden`,
`/api/garden/history` and `/api/garden/plans` serve it instead of the sample.
Nothing in the canvas, the beds, the metrics, the scrubber or the globe changed:
a tree is still a subscription drawn at the size it actually pays. Users with
nothing connected still get the sample garden, because an empty plot reads as a
broken page rather than as a new account.

Three things are *derived*, because the garden needs them and no provider gives
them:

- **The plan ladder is read out of the book.** Group the subscriptions by the
  plan name the provider gave them, price each rung at the **median** of what
  those subscriptions actually pay (a mean lets one enterprise deal on "Pro"
  overtake the plan above it), sort ascending. Over five plans, the tail folds
  into `Other plans` — forty rungs is not a ladder anyone can read. Ties are
  broken by a cent rather than merged, because `validatePlanCatalogue` requires
  strict ascent and two real plans are still two plans. The catalogue rides with
  the book, so the browser installs the user's own plans and the canopy ramp,
  the sprite table and the filter chips are all theirs.
- **The timeline is rebuilt from signup and cancellation dates**, from the
  earliest signup (capped at 24 months) to now, sampled through the same
  stump-window rules the sample book uses — so the right-hand end of the
  scrubber and "today" stay the same scene.
- **The weather is real payments.** Rain is payment volume in the trailing hour,
  the sunbeam is a large payment that actually landed, drought is six hours
  without one.

Three are deliberately **absent**, because inventing them would put fiction on a
plot the user is about to trust: **no meadow** (the synthetic long tail is zero —
it exists to make the sample look like a business, and adding it to a real one
adds revenue nobody earned), **no plan history** (`changes[]` is empty, so the
waterfall reports no expansion or contraction rather than a guessed upgrade), and
**no dunning depth** (past-due is `failed_attempts: 1`, never a guessed 2 or 3).

Two more rules worth knowing:

- **`/api/garden/simulate-event` returns 409 on a live book.** The shared book is
  the *sample* one; a user whose plot is their own Stripe would otherwise be
  handed the demo's customers in the response. A non-OK response is exactly what
  the client's offline fallback is for, so the event plays out locally as a
  what-if and nothing on the server moves.
- **The plot says which book it is.** `StatusBlock` carries a `YOUR DATA` /
  `SAMPLE` chip on the eyebrow, because a real book and a sample one are drawn
  identically — that is the point of the sample one — so the difference has to be
  said rather than guessed.

The derived book is cached per user against the harvest it came from
(`lib/revenue/forest.ts`), so the garden and the history cannot be built from two
different ladders a few milliseconds apart.

**Known limit:** a book spanning several currencies is summed into one MRR
figure. `/dashboard/revenue` keeps currencies apart and names them; the plot has
one number and no room for a caveat.

### Data model — no mock data anywhere (web)

**The generator is deleted.** `garden/lib/mockData.ts` — `generateBook()`,
`generateGarden()`, `toGardenState()`, the synthetic long tail — is gone, along
with `garden/server/simulate.ts` and `POST /api/garden/simulate-event`. Nothing in
the shipping app can invent a subscription any more. Every plant on the plot is a
row a payment provider returned for the signed-in user.

**One book, sampled at many dates** is still the rule; only its source changed.
`lib/revenue/to-garden.ts` builds the `Plant[]` book from the harvest and
`/api/garden` + `/api/garden/history` serve it together — taking one without the
other splits the app across two different customer bases.

**Empty is a first-class state.** With nothing connected, `/api/garden` answers
`gardenState: null` with the reason (`connected`, `providers`, `note`), the client
holds `EMPTY_GARDEN`, and `App.tsx` renders `EmptyPlot` instead of the scene —
because a canvas drawn against zeroes shows a $0 headline and a row of em dashes,
which reads as a broken dashboard rather than an account that has not connected
anything. `EmptyPlot` distinguishes *nothing connected* from *connected, working,
no subscriptions*, and offers the connect dialog for the first and the
imported-data page for the second.

Two consequences worth knowing:

- **`computeMetrics()` had to become empty-safe.** It read
  `snapshots[snapshots.length - 1]` and threw on an empty book; it now returns
  `NO_METRICS` — zeros, and **every ratio `null`**, which the panels already draw
  as an em dash, because 0% retention on a business with no customers is a claim
  about nothing.
- **`meadowCount` is permanently zero.** The synthetic tail went with the
  generator. The field stays on the snapshot contract, and `MEADOW_ARPA` stays in
  `gardenUtils` for the waterfall term that is now always nought.

Subscriptions have **no `changes[]` plan history** — providers do not hand one over
in a list read — so the movement waterfall reports no expansion or contraction
rather than an invented upgrade. `planStateAt()` still exists for a book that has
one.


### The plan catalogue (allotment)

**How many plans this product sells, and what they are called, is data.**
`src/lib/plans.ts` declares the ladder once — `{ name, baseMrr, accounts }` per
plan, **cheapest first** — and nothing anywhere else names a plan or counts
them. It used to be a union of four string literals (`Starter | Pro | Scale |
Enterprise`) spelled out in fifteen places: the generator's tier config, three
sprite tables, the foliage ramp, the swatch lightnesses, the species families,
the globe marker sizes, the `?tier=` allow-list, the simulator's upgrade rungs.
A product with two plans, or five, or the same four under other names, had to
be hand-edited into every one of them — and a sprite table keyed by a name it
has never heard of returns `undefined`, so the tree simply does not draw.

**Order is the only thing the ladder promises, and `planPosition()` is that
order as a number from 0 to 1.** Every derived quantity is *sampled* at that
position through `sampleRamp()` rather than looked up by name: canopy height
and radius, tower height and footprint, fish length and swim depth, foliage
lightness/saturation/hue, chip lightness, globe dot size, shadow radius,
percentiles. The control points are the values that were hand-tuned for the
four-plan book, so **four plans still land on exactly the numbers they always
did**, two plans get the two ends of the same curve, and five get five rungs of
it.

Only genuinely discrete things are picked rather than sampled — `rampIndex()`
takes the nearest of a fixed vocabulary: the crown layout, the species family,
the setback and spire, the flank stripes. Half a conifer and half a clover is
neither. Past four plans two neighbours share a silhouette; they are still told
apart by size and by colour, both of which stay exact at any length.

`SIZE_LADDER` (18/28/46/64) lives here now rather than being written out once
per sprite file, which is what makes "switching shape never reframes the camera
and never changes which subscription looks like the big one" a fact rather than
three tables agreeing by hand.

**The book owns it, in `apps/web`.** There is no `ALLOTMENT_PLANS` and no boot-time
install any more, because there is no generated book to configure: the ladder is
derived from the user's real subscriptions (see "The real book on the plot") and
ships in `GardenState.planCatalogue`, which the client adopts in the same breath as
the book — subscriptions on plans the client has no rung for would draw at the
smallest size in the palest green, filtered by chips naming plans nobody is on.
`validatePlanCatalogue` still guards it, rejecting an empty ladder, duplicate
names, non-ascending prices and bad account ranges, because every one of those
fails silently downstream; the derived ladder is built to pass it. The standalone
`apps/allotment` demo still reads `ALLOTMENT_PLANS` for its generator:

    ALLOTMENT_PLANS='[{"name":"Hobby","baseMrr":12,"accounts":[120,160]},
                      {"name":"Business","baseMrr":400,"accounts":[30,45]}]' pnpm --filter react-example dev

`PlanTier` is `string`. That means TypeScript no longer catches a stray plan
name for you — the guard is that there is exactly one list, and the helpers
(`planRank`, `tierOfPlan`, `nextPlanUp`, `smallestPlan`/`middlePlan`/
`largestPlan`, `planNamesDescending`) are calls, not tables. `TIER_OF_PLAN` was
renamed to `tierOfPlan()` deliberately: a record and a function that read the
same at the call site is how `TIER_OF_PLAN[plan]` survives a refactor as
`undefined` instead of as a type error.

### Metrics (allotment)

`src/lib/metrics.ts` is pure functions over the snapshot series: the MRR
movement waterfall, NRR/GRR, churn rates, quick ratio, ARPA, LTV, concentration,
and the cohort retention triangle. The governing invariant is that **the
waterfall reconciles**:

    starting + new + expansion + reactivation − contraction − churn + meadow = ending

`reconciles()` asserts it. Ratios return `null` — rendered as an em dash — when
their denominator is empty, rather than a `0%` the data cannot support.

### Metric plants (allotment)

The plot only ever visualises MRR, so every *other* metric gets its own
specimen, **and those specimens grow on the plot**. `components/metricPlantSprite.ts`
is one parametric canvas plant — `vigour` (canopy and trunk), `health` (accent /
warn / danger, banded, never blended), plus `shoots`, `fallen`, `stumps`,
`companions` and `gaps` — and `lib/metricPlants.ts` maps the eight revenue
metrics onto it.

They stand in the **metric border**: a separate raised bed alongside the
subscription beds, laid out by `computeBorder()` in `IsometricGardenCanvas`. It
is deliberately its own bed with a gap of turf around it, because one of those
plants is a ratio and the others are customers, and a reader must never have to
work out which is which. Each specimen carries a permanent stake with its name
and current value, and hovering shows how to read it and what good looks like.

### Plantings (allotment)

**The border is a menu.** Picking a specimen re-beds the whole plot as that
metric — `src/lib/gardenViews.ts`, one `GardenPlanting` per metric:

| Metric | The plot becomes |
| --- | --- |
| MRR | every active subscription, bedded by plan — one bed per plan the catalogue sells, dearest first |
| ARR | the same book bedded by tenure — how much of the run rate is actually anchored |
| Net retention | last month's customers in Expanded / Held / Contracted / Churned. New logos are absent, because NRR does not count them |
| Gross retention | the same, with expansion collapsed into Kept: this metric's ceiling is 100% |
| Logo churn | Stayed / Left, every account the same plant and the same size |
| Quick ratio | New / Expanded / Came back against Contracted / Churned |
| ARPA | above, around and below the average |
| Top 10 share | the ten largest lifted into their own bed, everyone else behind them |

The invariant: **a tree is always a subscription drawn at the size it actually
pays.** Changing the metric changes which subscriptions are on the plot and
which bed each stands in — never what a tree means — so any two plantings are
comparable. Logo churn is the one exception, and it earns it: that metric counts
accounts, so it draws one identical plant per account and the stake says so.

Churned subscriptions are carried over from *last* month's snapshot (the only
place they still have a price) and drawn as stumps. Bed stakes are two lines —
what the bed is, and what it is worth — because a bed called "Churned" with no
dollars on it is a category, not a reading. The planting is mirrored into the
query string as `?metric=`, selectable from ⌘K, and named in the headline: the
big number is always the thing the plot is showing.

The revenue panel's rail is figures only — the plants are in the garden, at the
size a plant is worth drawing.

### The long tail (allotment)

**The tail is a number, not a bed.** It is still in the book — `meadowCount`
carries it, `MEADOW_ARPA` prices it, and the waterfall's `meadow` term keeps the
reconciliation honest — so MRR, ARPA and the active count all include it. What
was removed is the *bed*: `computeMeadow()`, `drawMeadowBed()` and the fringe of
blooms in front of the plot, together with the `Meadow` filter chip and the
click that isolated them. Nothing about the numbers changed.

A link carrying the old `?tier=Meadow` lands on the whole book: `PLAN_TIERS` in
`App.tsx` is the allow-list, because a filter naming a plan nobody is on would
show an empty plot rather than a view.

### Layout: beds (allotment)

`src/lib/plotLayout.ts` owns **where a subscription stands**, which is a
different question from what it is drawn as. `computeBedPlacement()` returns
three things — a placement per plant, a stake per bed, and the geometry of the
ground — and the depth sort, the hit test, the camera flight and the activity
toasts all read those and nothing else.

Rows down the plot, ten to a row, one bed per group, ordered by the planting. An
empty bed still gets its row and its stake, because "nobody churned" is a
reading and a bed silently missing from the plot is not. Stakes stand at the
near edge of their bed with nothing in front of them, so they are painted with
the ground rather than over the canopy.

**The ring layout is gone.** It walked the same beds round a middle, smallest at
the centre and largest at the rim, and it took `computeRingPlacement`,
`ringSemiAxes`, `arcTable`, `drawRoundGround`, the control bar's layout switch,
the `L` binding, its ⌘K entries and the `?plot=` query string with it. Nothing
about which subscriptions are on the plot, which bed each stands in, or how big
any of them is changed — only the ground under them. A link carrying
`?plot=rings` lands on the beds, which are now the only layout there is.

### Shape: garden, city or aquarium (allotment)

> **City and aquarium are currently switched off.** `ENABLED_SHAPES` in
> `IsometricGardenCanvas.tsx` is the only thing holding them back — uncomment a
> line to bring one back. Nothing else was removed: both sprite files are
> intact and the canvas still renders them. Everything downstream reads that
> list, so with one shape enabled the control bar hides its switch, the `C`
> binding stops existing (rather than appearing in the guide as a dead key),
> and a link carrying a disabled `?shape=` lands on the garden.

The plot draws a subscription one of three ways, switched in the control bar,
cycled by `C`, listed individually in ⌘K, and mirrored into the query string as
`?shape=city` / `?shape=aquarium`. `?shape=cube` is the city's old name and
still resolves, because a view here is a link and old links have to land:

- **Trees** — `components/plantSprites.ts`. What shape the business is. One
  renderer, four tiers as rows in a `TIERS` table: a canopy is a *single* path
  of blobs, stroked and then filled so the fill covers the interior strokes and
  leaves one clean hairline silhouette, with highlight and shade clipped inside
  it from the upper left. Each tier has its own shape — Starter bush, Pro
  clover, Scale spire, Enterprise spreading crown — because tier is data and so
  is size, and if both are carried by area then neither can be read. **And its
  own green**: healthy foliage comes from `palette.foliage[tier]`, the plan
  ramp described under Theming, so plan reads anywhere on the plot rather than
  only where two plants of different tiers happen to stand side by side.
  City and aquarium keep their hashed materials — `FACADE` and `STOCK` are
  decorative *because* they are hashed — so the plan ramp is the garden's.
- **City** — `components/citySprite.ts`. The same book as a skyline: height on
  a shared baseline is the only way to rank two neighbours by eye, and a tower
  is that measurement with something to hold on to — floors you can count, a
  roofline, a spire. Tier is the building type (Starter low-rise, Pro mid-rise,
  Scale stepped tower, Enterprise skyscraper) and footprint stays fixed so
  height alone carries the value. Glazing is one **band per floor**, not a grid
  of panes: two hundred buildings times two faces times a dozen floors times
  three panes across is fifteen thousand fills a frame, and this loop runs at
  60fps. The bands are narrow on purpose — filling each floor turns the plot
  into stripes and hides the facade, which is what carries health at plot zoom.
  `toCityGround()` re-lays the beds as asphalt for the same reason `toSeabed()`
  re-lays them as water: a skyline growing out of turf is a business park.
- **Aquarium** — `components/fishSprite.ts`. Whether the business is *alive* —
  a room full of fish is a thing you read the mood of before you read a number
  on it. Guppy, angel, striped torpedo, koi up the ladder; churned stock is
  bones on the substrate. **The beds are re-laid, not tinted**
  — `toSeabed()` derives a palette that is *water*: blue where the turf was, a
  deeper blue at the cut edges so a slab reads as a body of it rather than a
  painted lid, silt for litter and coral in the meadow. The beds are most of
  the pixels, and a lawn under a blue filter is still a lawn. It is derived
  rather than an eight-variant theme addition because none of it is seasonal,
  and everything that still means something — foliage colour, the dunning
  ladder, stake and tag chrome — passes straight through. The bed's checkerboard is deliberately much lower
  contrast than the garden's: it is only there to keep the isometric plane
  legible, and at turf contrast it reads as a swimming pool.

  **The ocean is the background, not a filter.** `drawOcean()` runs *before*
  the plot, opaque, in place of the page: a bright surface overhead with
  moving ripples, drifting shafts of sunlight, and a column that deepens
  downwards. `drawWater()` then runs after the plot with haze, caustics and
  bubbles, so the plot is sandwiched inside the water rather than sitting
  behind a sheet of it. The first version was only the second half — a
  translucent blue veil over the finished scene — and it read as dusk, because
  the garden's own pale page still showed through and the veil's only effect
  was to take light out. Note the vignette that is deliberately *not* there:
  darkening the corners says night, deepening downwards says depth. **The rain is
  replaced by the school: one fry per unit of payment volume**, so the number
  that makes it rain on the garden is the number that fills the tank. Money
  arriving means visibly more fish. Like the rain, that count is data and holds
  when motion is reduced — only the swimming stops. Fish are lit along the back
  and shaded under the belly rather than from the upper left, because that is
  both what light does underwater and the only scheme that survives a fish
  turning round. `WATER` is keyed to light/dark, not to the season: a tank is a
  tank in January, and everything inside it still takes seasonal tokens.

None of these is a skin, and the things they must not change are the point:
tower height, canopy radius and fish length all run off the same
`getCanopyMultiplier` against the same `SIZE_LADDER` in `lib/plans` — one
table, sampled by all three — so switching modes never reframes the camera and
never changes which subscription looks like the big one.

**Each medium says "in trouble" in its own words, and all three say the same
thing.** A dying plant turns amber. A failing building **goes dark** — floors
empty from the top down through `OCCUPANCY`, and the facade takes the same
`health` ladder, so the far read is the identical amber and the near read is
the lights going out. A dying fish **loses its colour**, going pale, then grey,
then ghostly through `AILING`. Healthy stock in the two non-garden modes takes
materials of its own — `FACADE` for the city, `STOCK` for the tank — hashed off
the subscription so a customer keeps their building or their fish, and
decorative *because* it is hashed rather than derived from any field: anything
varying with a field invites a reader to decode it, and there is nothing there
to decode. Both healthy sets are deliberately constrained so the dunning ladder
stays the loudest thing on the plot — `FACADE` is all muted and cool, and blue
is absent from `STOCK` because the bed is blue and a blue fish on blue water is
a fish nobody can count.

Tier is carried by a channel size is not already using: the building type, the tree's silhouette, the fish's
species. Buildings do not sway and do not droop with health, because the shared
baseline is the whole reason to be looking at them; fish do their own
moving, and stop for `prefers-reduced-motion` like everything else idle.

**The border switches with the plot** — `drawMetricTowerSprite` and
`drawMetricFishSprite`. Each keeps every word of the specimen vocabulary:
vigour is the tower's height or the fish's size, health is still the banded
accent/warn/danger, shoots are blocks going up on the roof or fry rising off
the back, gaps are bitten out of the *edges* so they break the silhouette, and stumps,
companions and fallen debris keep their meanings. What separates a specimen
from a subscription was never the sprite: it is the separate raised bed across
a gap of ground, the stake, the podium or stand, and a colour that is a
judgement (chrome tokens, fixed across seasons) rather than foliage, city
materials or stock.

Anything mode-dependent about a specimen's size goes through `specimenTop` /
`specimenReach` in the canvas, which the hit test, the stake and the hover tag
all share — three call sites that must never disagree about how tall a plant
is. `plantAt` has the same obligation for subscriptions: a fish is up in the
water column, so the hit test lifts by `fishSwimHeight` rather than the fixed
offset that finds a tree or a tower.

Tile geometry (`TILE_W`, `TILE_H`, `gridToUnscaled`) lives in `lib/iso.ts` so
sprites can size themselves to a tile without importing the canvas component;
`IsometricGardenCanvas` re-exports it for the call sites that always had it.

Two rules keep them honest: the decorations are only ever drawn from real
movement (no expansion this month means no shoots), and the benchmarks that
decide a plant's colour live in one `BANDS` table and are quoted on every card,
because an amber plant is an opinion and an opinion has to show its working.
Trunk and soil come from the *canvas* palette so a specimen is lit by the
current season; the canopy uses chrome status tokens, because a judgement must
not change hue in October.

### Charts (allotment)

`src/components/charts/` holds the SVG primitives (`Sparkline`, `TrendChart`,
`MovementChart`, `RetentionGrid`) behind the revenue panel. They follow the
`dataviz` skill: marks carry colour and text never does, every chart has a hover
layer and a table view, one series means no legend, and the cohort heatmap is a
single-hue ramp built with `color-mix` against `--surface-solid` so it anchors
on white in light mode and near-black in dark. Truncation is always stated in
words, never silent.

### Simulated events — removed

There is no simulator. `handleSimulateWebhook`, the five per-plant triggers
(Paid / Recover / Fail / Upgrade / Churn in `PlantDetailDrawer`), the advisor's
three "trigger" buttons, the ⌘K *Simulate* group, the revenue panel's *Recover*
button, `garden/server/simulate.ts` and `POST /api/garden/simulate-event` are all
gone.

The reason is the same one that removed the mock data: on a plot that is somebody's
real revenue, a button that invents a payment is a button that lies about their
business. Movement arrives from the provider, in the next harvest. The advisor
still reads the plot and says what it sees — it just no longer offers to change it.

`/api/garden/stream` and its subscriber registry survive (`garden/server/state.ts`
is now *only* that registry), so the status dot still reports a connection and
there is somewhere for real provider events to arrive later.

### Notifications — looking at them is reading them (web)

**There is no "mark as read" button anywhere, and no per-row action.** Opening
`/dashboard/notifications` marks the whole inbox read and the bell's badge goes
to nought. The badge counts what you have *not been shown*; this is the screen
that shows it, so a badge that survives it is a badge asking to be dismissed
twice.

- **`markNotificationsSeen()` returns the ids it marked**, which is why it is two
  queries rather than one `updateMany` — that returns a count, and a count cannot
  say *which*. `markNotificationRead(id)` and `markAllNotificationsRead()` are
  gone; nothing else called them.
- **The rows keep their green dot for the length of the visit.** `read` on the
  record is useless to this page the moment it loads, so the dots and the
  headline are drawn from `newOnArrival` — the set the action handed back —
  rather than from the record. Clearing the badge *and* the marks on arrival
  would delete the answer at the moment it is being asked for. The set survives
  the tag filters, so switching tag does not quietly settle the row being read.
- **The badge is cleared by `router.refresh()`.** It is computed in
  `dashboard/layout.tsx` (and again in `dashboard/page.tsx` for the plot's HUD),
  both server renders that a client page cannot reach into. The call is guarded
  by a ref and by the action returning `[]` on a second run, so a StrictMode
  double-effect cannot loop.
- **The *Unread only* chip went with it.** After a visit nothing is ever unread,
  so it was a filter over a state that no longer exists — the same rule that
  takes a keybinding out when its feature is switched off.

### The dashboard shell — one top bar, in the garden's language (web)

**Every page inside `/dashboard` is one screen: the plot's own top bar, and the
page.** Two mechanisms, and the CSS one does most of the work.

**The palette is a token bridge.** `.garden-skin` in `index.css` re-points the host
app's shadcn variables at the garden's — `--card` → `--surface-solid`,
`--background` → `--page-via`, `--muted-foreground` → `--ink-faint`, `--primary` →
`--garden`, `--radius` → 16px — so every `bg-card`, `Button`, `Input` and `Table`
inside the shell adopts the plot's palette **without being touched**. Hand-restyling
each page is the version of this that dies at the thirteenth page. Three things keep
it safe: the garden's tokens already switch on `data-mode` (set before first paint,
so light and dark come free and there is one palette rather than two that agree); it
is a class placed **after** `.dark`, so source order decides — verified in the built
stylesheet, not assumed; and the decorative `--pop-*` set is left alone.

**Status crosses the bridge too** (`success` / `warn` / `info`, each with its
`-soft` fill), and it has to. Status means the same thing in both style systems, so
the family was originally left to the host app — but *which mode it is in* does not:
these surfaces follow `data-mode` and shadcn's status tokens follow `.dark`, so an
app in dark mode with the plot in light painted a near-black `success-soft` pill on
a pale mint card. A page cannot be half in each mode. The hues are unchanged, except
that affirmative is now the garden's own green, which is the emerald every other
affirmative thing in this product already wears.

**The layout is the top bar** — see "One top bar, on every page" above. The sidebar
it replaced (`dashboard/sidebar-nav.tsx`, deleted) split its rows into *Views* and
*Startups*, which was the right distinction and the wrong amount of furniture beside
a canvas: which business you are in is the startup switcher's job, on the bar, and
the four views are three destinations plus the plot.

Settings tabs are pills for the same reason every other "pick one of these" in this
product is a pill.

**`/dashboard` is the only route that draws its own copy of the bar**, from the same
components, because the plot is a canvas read by eye and the bar has to float over it
rather than sit above it in a padded column.

### The admin console (web)

**`/admin` is one restyle, not twelve.** `.admin-skin` in `index.css` — the same
token-bridge mechanism as `.garden-skin` — is applied once on `admin/layout.tsx`,
and every `bg-card`, `border-border`, `Button`, `Input`, `Table` and `Badge`
underneath it adopts the console's palette without being touched. Hand-restyling
a dozen pages one card at a time is the version of this that is finished up to
the page somebody got bored on.

- **The accent is the plot's emerald**, one token (`--primary`), so buttons,
  active nav, focus rings, links and chart marks move together. The neutrals lean
  green with it (hue 160, chroma 0.004–0.008) — a violet-cool grey beside an
  emerald accent reads as two systems.
- **The values are re-struck, never `var(--garden)`.** The garden's tokens switch
  on `data-mode`, which is the *plot's* light/dark and is set independently of
  `next-themes`; pointing at them would put a light emerald on a dark console the
  moment the two disagree. Same colour, keyed off `.dark` like the rest.
- **Both modes are measured.** Light is one step deeper than the plot's `#059669`,
  which is a 3.7:1 fail as a button label; `oklch(0.52 0.127 163)` is the lightest
  step clearing 4.5:1 three ways. Dark is the plot's `#34D399` unchanged. All
  twenty surface pairs were run rather than eyeballed.
- **Up is the accent, down is red.** Two greens a few degrees apart — one meaning
  "brand", one meaning "rose" — is a distinction no reader can make, so a positive
  delta simply *is* the accent and direction is carried by the arrow as well.
  `--destructive` keeps its red: delete is not a shade of the brand.
- **Separation is a hairline, not a shadow** — the one place that inverts the
  house rule, because the house rule is written for pages with room to breathe.

The type scale went up with it: the console was written in `text-[9px]`/`[10px]`/
`[11px]` with uppercase micro-caps labels, and is now the ordinary `text-xs` /
`text-sm` scale in sentence case, with controls at `h-9`. The overview's four key
figures are **one card divided by hairlines** rather than four floating cards,
because those four numbers are read together.

### The loading garden (web)

While the book is being read, `hud/PlantingAnimation.tsx` draws **a bed with trees
coming up on it** rather than a spinner: the waiting is the same length either way,
but one of the two says *what* is being waited for.

- **The pigments are the plot's** — turf, soil, bark and foliage come from
  `theme.canvas`, so the loader is lit by the same season and mode the garden is
  about to be. A hand-picked green would drift the first time a season is retuned and
  the reader would meet two products a second apart.
- **The geometry is the plot's** — the same 2:1 isometric projection the beds use, so
  the shape you watch grow is the shape that arrives.
- **It grows from the base of the trunk** (`transform-box: fill-box` with a bottom
  origin), so a tree rises out of the soil instead of scaling around its middle and
  sinking through it. The 6% overshoot at 70% of the cycle is what reads as *growth*
  rather than as a fade.
- **It stops for `prefers-reduced-motion`** — the trees are simply there, fully
  grown. The scene still says planting; it just does not move.
- **It is the only thing on the screen.** `EmptyPlot` carries the top bar in its
  settled states — *nothing connected* and *connected, no subscriptions* are screens
  a person stays on, and without navigation the only way off one was the account
  menu — but not while loading. That is a second of waiting for a page already on
  its way, and a wordmark, a nav pill and a startup switcher that appear, sit still
  and are then replaced are three things flickering for no answer. There is nothing
  to navigate to yet and nothing to switch.

### The plot is fixed in its frame (web)

`STATIC_VIEW` in `IsometricGardenCanvas.tsx` turns off **pan, wheel zoom, the zoom
dock and the camera flight**. One constant; set it to `false` and all four come back,
including the dock, which is kept behind the flag rather than deleted so that promise
is true.

The reason it is safe: the scene is laid out to *fit*. `computePlot` solves for the
scale that puts every bed, the metric border and its labels inside the viewport, so at
rest the whole book is already on screen — and every camera move from there was a way
to end up looking at part of it and wondering where the rest went. A dashboard read at
a glance should not have a lost state.

Two consequences worth knowing:

- **"Go to this subscription" now marks rather than travels.** A ⌘K result or a row in
  the revenue panel rings the plant for six seconds instead of flying to it; with the
  plot fully in frame there is nowhere to fly.
- **The cursor is `default`, not `grab`.** A grab cursor over a scene that cannot be
  grabbed is a promise the plot does not keep.

Hover, click, selection and the hit tests are untouched — those are pointer events, not
camera moves.

### The wall display (web)

**`/dashboard/tv` — the plot on an office screen, and nothing on top of it.**
Same `garden/App`, in `clean` mode; `dashboard/tv-view.tsx` adds only what a
screen on a wall needs that a screen on a desk does not.

**Clean means the canvas and nothing else.** The beds and the metric border are
already the whole reading — a tree is a subscription at the size it pays, a
specimen is a metric with its name and value on a stake — so the screen showing
them needs no HUD at all. The header, the toolbar, the startup switcher, the
status block with the MRR headline, the scrubber, the popovers, the drawers and
the activity toasts are **not rendered**, not hidden. Plant selection is a no-op,
so the canvas does not draw a hover state nobody can act on, and a passer-by
cannot leave the board filtered or scrubbed to March.

`computePlot` already solves for the scale that fits every bed, the border and
its labels inside the viewport, so full-bleed means the whole book is on screen
at the largest size it will go. That is the entire trick — the plot was already
built to be read at a glance with no lost state.

Two behaviours it does have, both invisible:

- **The book re-reads every five minutes.** Not five seconds: the harvest behind
  `/api/garden` is itself cached for a minute per user, and a board that hammers
  somebody's payment provider all day to redraw the same forest is a bad
  neighbour. Nothing else in the app touches `reloadKey`, so on a desk the fetch
  still runs exactly once.
- **The screen is kept awake** via the Wake Lock API, re-taken on
  `visibilitychange` — browsers drop it when the tab is backgrounded and never
  return it. Every step is optional and fails silently; a board that works and
  dims beats one that throws.

**The plot does not re-bed itself on a timer.** It was tried — a rotation through
the eight metrics — and with no HUD to say which one is planted, a forest that
rearranges every twenty seconds is a screen doing something unexplained. The
border is standing right there for anyone who wants the other seven readings.

The only thing drawn over the canvas is a fullscreen button and a way out, in a
corner, and they fade with the cursor 2.6s after the last pointer movement: a
permanent button is furniture on a screen whose point is that it has none, and no
button at all is a mode you cannot leave. It is `isBare` in
`dashboard-shell.tsx` for the opposite reason `/dashboard` is — it draws no
chrome at all — and auth is the dashboard layout's, so an office screen signs in
once.

**Three ways in, one name.** The plot's toolbar carries an *Expand* button in the
`view` group beside the appearance control, because it is the one tool that takes
chrome *away* rather than opening something over the plot; the account menu has
the same icon and the same label, which is what makes it reachable from the pages
that have no toolbar; and `v` does it from the keyboard. All three come from
`onCleanView`, a callback the host app supplies exactly as it supplies
`onConnectRevenue` — `garden/App` is a self-contained port and knows nothing
about routes. Without the callback the button, the ⌘K row and the binding **do
not exist**, the same rule `ENABLED_SHAPES` applies to `c`.

### The plot's HUD (web)

Laid out from the product's own reference design. **The canvas is untouched** — trees,
beds, sprites, the isometric camera — and everything around it is chrome:

- **Top row, three columns:** the `FOREST MRR` wordmark, a segmented pill of three
  ways out (Garden · Startups · Settings — the plot has no sidebar), and the toolbar
  carrying the startup switcher, tools and account. It is deliberately the quietest
  band on the screen; the reading sits below it.
- **Status block:** the headline with its delta as a **pill**, the sparkline beside
  it, and `vs. <month>` underneath — a percentage with nothing to compare it to is a
  number a reader has to take on trust. The season moved out of the meta row into a
  card of its own (`Summer · Growing`, with a derived one-line reading), because a
  word like "Quiet" competing with two counts is the wrong weight for the setting.
- **Timeline:** one row — a step either side of the current month, the rail, and
  *Auto play* spelled out, since it is the one control there that does something
  rather than moving you somewhere. It was briefly three rows (a heading, a row of
  neighbouring months, the slider), which stated the month twice and gave the bar the
  height of a toolbar; the neighbours went because the rail already shows how much
  history there is, and reading a date off a scrubber is what the label is for.

**Removed from the reference on purpose:** the *Revenue outlook* card and the *Hover
over any tree* hint. The outlook was the only thing on the plot making a claim about a
month that has not happened, and with a two-month book its verdict (from last month)
and its projection (from the trailing median) could disagree on screen — *Holding
steady*, `+50% projected` — which is worse than no forecast. The hint was furniture.

Also not built: the `D / W / M / Q / Y` range switcher. The book is monthly closes; day,
week, quarter and year buttons would be four controls where three do nothing, and
inventing granularity the data does not have is the one thing this dashboard must not
do.

### Switched-off pages (web)

**Off: Revenue data, Graphs, App appearance, Pricing, Send feedback.**
`ENABLED_PAGES` in `lib/nav-features.ts` is the only thing holding them back —
uncomment a line to bring one back. **The routes are untouched**:
`/dashboard/revenue`, `/dashboard/graph`, `/dashboard/settings/appearance` and
`/pricing` all still exist and still work, exactly as the city and aquarium sprite
files survive `ENABLED_SHAPES`.

Two of them span more than one surface, which is the reason for the single switch:
*App appearance* is both an account-menu row **and** a settings tab, and *Send
feedback* is a row **and** a mounted dialog. Gating only what you can see would leave
the tab lit after the row vanished, and a modal that nothing can open still sitting in
the tree.

Off means off in every surface at once — the sidebar row, the account menu, and every
cross-link between pages (*Open graphs*, *Imported data*, *View data*, the startup
page's *Graphs*, and the graph page's own empty-state link). A nav item leading to a
page the product no longer offers is worse than no item, and a "View data" button
whose data view is gone is a dead end with a label.

One exception by necessity: **the garden cannot read this list.** `garden/App.tsx` is
a self-contained port and importing `@/lib` there would break the standalone copy, so
the empty plot's second link points at `/dashboard/settings/revenue` — a page that is
always present — rather than being gated.

### Switched-off HUD features (web)

**The command palette, the revenue panel, the advisor, the guide and the sound
toggle are off.** `ENABLED_FEATURES` in `App.tsx` is the only thing holding them
back — uncomment a line to bring one back. Nothing was deleted: `CommandPalette`,
`RevenueModal`, `GardenAdvisorDrawer`, `GuideModal` and `soundEngine` are all still
wired.

Switching off `search` takes **⌘K** with it, which is the rule working as intended
rather than a side effect: a palette you can open by key but not by button is a
feature that is half on. The border bed is still the menu for re-planting the plot,
and the filter popover still searches within the book.

It follows the `ENABLED_SHAPES` rule exactly, because a half-disabled feature is
worse than either state: a feature that is off is off in **all four** places at
once — the toolbar button, the ⌘K row, the keyboard binding (`A`, `?`, `M`) and the
mount itself. A key the guide advertises and that does nothing is worse than no
key; a palette row that opens nothing is a dead end with a search hit; and an
overlay that is never mounted cannot be opened by a stale URL or a stray state
write.

One caveat if `'sound'` comes back: nothing calls `soundEngine.play*` any more —
the chimes were fired by the simulator's invented payments — so the button would
control silence until a real provider event is wired through it.

### Interaction (allotment)

- **⌘K** opens the command palette — customers and commands in one list;
  selecting a customer flies the camera to their plant and marks it, and the
  `Plant` group re-beds the plot as any metric.
- Keyboard bindings live in one array in `App.tsx` and are rendered by both the
  guide modal and the palette, so a shortcut cannot exist undocumented.
- The view (month, filters, selection, shape) is mirrored into the query
  string with `replaceState`, so a view is a link.
- The canvas keeps its camera in a **ref**, not state: panning used to rebuild
  the render loop between frames. Hovering highlights, clicking selects.
- `prefers-reduced-motion` stops sway, drifting seasonal air and weather
  advance, and swaps the animation loop for a draw-on-change; a hidden tab stops
  rendering entirely. Nothing that encodes data ever stops.
- **The timeline is a recording, not a treadmill.** The scrubber's resting place
  is the right-hand end — today, on the live MRR — and only a person ever moves
  it off there. Adopting the server's book re-parks it at the end rather than
  clamping the index it had, which is what used to leave it standing mid-history
  on a stale month; a `?m=` link is the one thing that outranks today. Play
  sweeps the book once and comes back to rest.
- **`isHeld` is what "and then it stops" means**, and it is stillness only. A
  finished sweep is standing on today with today's numbers — no month chip, no
  "back to today", nothing to escape — so all it does is pass `still` to the
  canvas, which is the same stillness `prefers-reduced-motion` asks for: sway,
  rain advance and seasonal air stop and the loop becomes draw-on-change.
  Touching the scrubber, playing again or simulating an event starts it
  breathing. Nothing that encodes data changes either way.

### The globe (allotment)

There is one globe left, and it is a panel rather than a view:
`GlobalSubscriberGlobeModal`, ⌘K → "Subscribers around the world". It draws its
sphere with **COBE**, via `components/Globe.tsx`: the magicui globe
(magicui.design/docs/components/globe) ported to this app's conventions
(relative imports, no `cn`, no `@/components/ui`). Three things differ from the
published source: the spin angle and width live in refs, so changing the markers
re-creates the globe *without* snapping the earth back to zero; `autoRotate` is
a prop, so the orbit button and `prefers-reduced-motion` can both stop the
drift; and it observes its own size, because the published component listens for
window resizes only and a first `offsetWidth` of 0 would otherwise leave it
blank forever.

**The markers are the book of business** — `lib/globeMarkers.ts`, one per
subscription at its own lat/lng, sized by plan tier and coloured amber past-due
/ emerald Enterprise / blue everyone else. They read `filteredPlants`, so
picking a country or region empties the rest of the earth rather than merely
filtering the list beside it. cobe v2 draws markers instanced, so the whole book
fits.

The flat "2D Map Projection" toggle uses the component's own canvas, drawn once
per change rather than at 60fps — the frame loop only ever existed to spin the
sphere.

**The two full-screen globe views are gone.** `TerminatorGlobeView` (day/night
earth, sun ring, payment ripples, 24h replay) and `EarthView` (the plain globe)
were removed along with `lib/terminatorMath.ts`, `lib/globeProjection.ts`, the
`suncalc` dependency, the `G` binding and the control bar's view switch. The
garden is the only view, so `?view=` is neither read nor written and an old link
carrying `?view=globe` lands on the garden.

### Visual language (whole app)

**The page is `#E2F4E8`.** One flat pale mint, in all three `bg-page` stops, for the
plot and every other page. It is set twice because two things paint it: the
pre-paint fallback in `index.css` (used by every page without the garden's
`ThemeProvider`) and `CHROME_SEASON[*].light` in `garden/lib/theme.ts` (used by the
plot). Both had to move or the two would disagree.

**Dark is flat neutral grey, and it has no gradient.** All three dark palettes —
the host app's `.dark`, the plot's `CHROME_NEUTRAL.dark` (mirrored by the
pre-paint `:root[data-mode='dark']` block, which has to be kept in step with it)
and `.dark .admin-skin` — are `oklch(L 0 0)` all the way up: **page 0.145, card
0.205, border 0.285, ink 0.934, captions 0.650**, and the three `--page-*` stops
are the same value so `bg-page` renders flat.

This ramp was wrong twice in the same way before it was neutral. It started
violet-cool (hue 285) — the right neutral under a violet primary *on white*, and
at night a colour cast. Warming it (hue 68) was the same mistake with the
temperature reversed. A dark UI does not need a temperature; it needs greys that
get out of the way of the one or two colours that mean something. **Any future
"the dark mode feels a bit —" should be answered by moving an `L`, not by adding
chroma back.**

The steps are close together on purpose: **separation is carried by the border**,
a visible 1.25 against the card it edges, rather than by a lightness jump. Text
pairs were measured, not eyeballed — ink 16.3:1 on the page and 14.8:1 on a card,
captions 5.5:1 on a card and 5.1:1 on the muted fill, and every chromatic token
(accent, status, chart marks) re-checked against the new card. **The canvas is
untouched** — turf, soil, bark, foliage and the dunning ladder keep their tuned
seasonal values, because those encode plan and health and their readings depend
on value contrast inside the bed. `apps/allotment` keeps the old cool dark, as it
keeps everything else.

**The light page no longer shifts with the season.** It used to — spring's page was a
shade greener than summer's — which is a lovely idea and the wrong one for an app
whose pages are mostly *not* the plot: a settings page whose background drifts with
the month the scrubber is parked on is a background nobody can rely on. The plot still
says what season it is where seasons belong: turf, foliage, air, litter. **Dark mode is
untouched** — a pale mint behind white ink would be a light theme with the lights off.

The gradient machinery is intact (three stops, the 420ms cross-fade), so putting depth
back is a matter of changing these numbers rather than restoring a mechanism.

**Soft, rounded, elevated.** Separation comes from *fill and elevation*, not
from a hairline round everything: white cards on a grey-lavender page, big
radii, wide soft shadows, pill controls, generous padding. It is driven from
`apps/web/src/index.css` rather than from any component:

- **`--radius`** was `0px`, which is why every card, input, menu and table in
  the app had square corners. It is `14px`, and the whole `--radius-sm…4xl`
  scale derives from it — so nothing downstream should ever hard-code a radius.
- **`--elev-1/2/3`**, exposed as `shadow-elev-1/2/3`. Soft and wide rather than
  tight and dark: a diffuse shadow reads as a card lifted off the page, a tight
  one reads as a drop-shadow applied to a rectangle. Cards, menus and dialogs
  use these instead of the `ring-1` they carried before.
- **Cards are lighter than the page in *both* modes** — white on grey in light,
  and a lifted grey on near-black in dark — so elevation reads the same way
  round either way.
- **Colour is a system, not a set of one-offs.** `--primary` is violet (it was
  near-black, which is why every call to action in the app was a black
  rectangle). Status has four tokens, each with a `-soft` fill because a status
  in this style is a pill rather than a word in a colour: `success`, `warn`,
  `info`, `destructive`. Decoration has nine — `pop-violet` through `pop-pink`
  — which are **categorical and mean nothing**: they exist so a list of
  unrelated things gets unrelated colours instead of eight identical grey
  squares, and a reader is never invited to decode one. Anything that *does*
  mean something takes a status token.
- **`bg-grad-primary` / `text-grad-primary`**, and a `gradient` Button variant,
  are the one loud thing — a screen's single hero action. A gradient cannot
  carry a state, so two on a page is two things claiming to be the answer.
- **`IconTile`** (`components/ui/icon-tile.tsx`) is the coloured rounded-square
  that carries most of the colour in this style: saturated fill, white glyph,
  radius about a third of the side. `toneFor(key)` keeps a thing's colour
  stable between renders.
- **No raw Tailwind shades left.** 46 `text-red-400` / `bg-green-100
  dark:bg-green-900`-style literals were mapped onto the tokens above; the
  four-value light/dark quartets collapse to one soft token that already knows
  about both modes. Adding a `text-amber-500` to a component re-opens that hole.
- **Default theme is `light`** (`components/providers.tsx`). It was `dark`;
  one word changes it back. Both modes carry the full palette.

The shadcn primitives in `components/ui/` had `rounded-none` baked in — that is
gone. Hand-rolled panels across the app were rounded by rule: a class string
carrying a *full* `border` plus `border-border` is a panel and got
`rounded-xl` (and `bg-card shadow-elev-1` where it was a half-opaque
`bg-card/50`); a `border-b`/`border-t` is a divider and was left square.

The three split-screen layouts (sign-in, pricing, onboarding) are now cards on
a page: the form sits on a white card, and the visual half is an inset rounded
panel rather than a full-bleed half with a hard edge down the screen.

**The garden's HUD follows the same language through its own tokens** —
`Surface` is a 20px radius with a shadow and no border, and every control is a
pill (`CONTROL` in `hud/ui.tsx`). **Never reach for a `dark:` utility in here:**
that variant is the host app's (`&:is(.dark *)`), while the garden switches
light and dark on `data-mode`, so a `dark:` rule inside `garden/` is one that
never matches. Its own tokens are already mode-aware. Its accent stays emerald rather than taking
the app's violet: the HUD sits directly on green foliage, and an accent that
fights the thing it is labelling is not an accent. **The plot itself is
untouched.** Turf,
foliage and the dunning ladder encode plan and health, and their readings
depend on value contrast that a pastel palette would flatten.

### Theming (allotment)

Appearance has two axes, both set from the palette button in the toolbar:

- **Mode** — light / dark / `system` (follows `prefers-color-scheme`).
- **Season** — spring / summer / autumn / winter, or `auto`, which follows the
  month the timeline scrubber is sitting on.

`src/lib/theme.ts` is the single source of truth. `getTheme(mode, season)`
returns two token sets: `chrome` (CSS custom properties for the HUD) and
`canvas` (plain hex for the `<canvas>` renderer, which cannot read CSS vars on a
60fps loop). `src/lib/ThemeContext.tsx` resolves the preferences, persists them
to `localStorage`, and writes the chrome tokens onto `<html>`; a small inline
script in `index.html` sets `data-mode` before first paint so a dark reload does
not flash white. The dark values in `index.css`'s `:root[data-mode='dark']` are
that pre-paint fallback and have to be kept in step with `CHROME_NEUTRAL.dark`.

**The chrome is neutral in the dark; the ground is not.** The page gradient and
the panels are grey-black in every season, but `DARK_GROUND` is a table keyed by
season — each month's dark turf is its *light* turf taken down in value and a
little in chroma (spring yellow-green, summer green, autumn olive, winter the
same cool snow-grey it is at noon), and the soil stays brown, because earth does
not turn grey when the sun goes down. The beds are most of the pixels, so their
hue is the theme: a grey slab reads as a model of a garden rather than a garden
after dark. Value contrast inside the bed is the constraint, not hue: the turf
has to out-value the cut edges or the slab stops reading as a solid, and bark
(`WOOD.dark`) has to out-value the turf or the trees lose their stems.

**The canopy deepens with the plan.** A season is still authored with one
healthy green; `planFoliage()` derives one green per plan from it into
`canvas.foliage[tier]`, palest at the cheapest plan through deepest at the
dearest, and `plantSprites` paints healthy foliage from that. The ramp is
walked over `planNames()`, so it is exactly as long as the catalogue and the
theme cache is keyed on `planCatalogueVersion()` — installing a new ladder
cannot serve the last one's greens back. It is a *ramp* — even steps of
lightness, with saturation and a few degrees of hue following in the same
direction — because plan is an ordered field and because a colour nobody can
name is still obviously darker than its neighbour at plot zoom. Two rules keep
it out of the way of everything else the canopy says: it never leaves the
leaf's own hue, so the dunning ladder (which jumps off green to amber, or to
crimson in autumn) is still the loudest thing and a small plant can never be
mistaken for a failing one; and it runs *down* from the authored green in the
day and *up* from it at night, because the ground swaps sides between modes and
foliage has to stay legible against it — ramping the same way in both put a
winter Enterprise at 1.1:1 against its own bed. `FOLIAGE_FLOOR` / `_CEIL` bound
it, and when the even ramp does not fit it slides whole rather than clamping
its ends onto one colour. The saturation/hue shifts are the *two ends* of a
line rather than a value per plan — they always were a straight line — so they
stretch to any ladder. The plan filter's chips take the same ramp through
`planSwatch()` — lightness re-struck for a panel rather than turf — so the
chips are a key to the plot rather than a second ladder for the same field.

Components never name a colour. `index.css` maps each chrome token into
Tailwind's colour namespace, so panels use semantic utilities — `bg-surface`,
`text-ink`, `text-ink-soft`, `bg-inset`, `border-hairline`, `bg-accent`,
`text-accent-ink`, plus `warn` / `danger` / `info` / `special` families and
`shadow-panel` / `shadow-modal` / `bg-page`. **Adding a raw `bg-white`,
`text-gray-*` or `bg-emerald-*` to a HUD component will break dark mode** — add
a token instead. The globe panel (`GlobalSubscriberGlobeModal`) is deliberately
exempt: it is a night scene in both modes.

Seasonal air (petals, pollen, leaf-fall, snow, fireflies, stars) lives in
`src/lib/ambient.ts` and is configured per season by the `ambient` and `litter`
fields of the canvas palette. Dunning colours (`health`) deliberately do *not*
follow the season, except in autumn, where they shift to crimson so a failing
subscription stays distinguishable from healthy amber foliage.

## The dev-only hydration warning (and why it is suppressed)

`next dev` reports *"some attributes of the server rendered HTML didn't match"* on
generated ids — `base-ui-_R_…`, `radix-_R_…` — for the header dropdown, the startup
switcher and the revenue page's tabs. **It is a Next dev-server artifact, not app
code, and it cannot occur in production.**

`useId` is computed from an element's position in the tree, and in dev the two trees
are different shapes: `createComponentTree` wraps every segment in `SegmentViewNode`
for the devtools Segment Explorer whenever `renderOpts.dev` is true — `const
isSegmentViewEnabled = !!ctx.renderOpts.dev`, hard-wired, **no config flag** — and
injects a run of `<script>` siblings the client tree does not have.

Measured, not assumed: a throwaway page with one base-ui dropdown and nothing else
rendered `base-ui-_R_3inebmqlb_` under `next dev` and `base-ui-_R_3av5tlb_` under
`next start`. The dev id is longer because the dev tree is deeper.

Since it cannot be fixed and cannot happen in production, it is suppressed at the
three primitives whose ids Next generates — `DropdownMenuTrigger`, `TabsTrigger`,
`TabsContent` — with the reasoning written at the first one. The cost is bounded and
stated there: a genuine attribute mismatch on those elements would also be hidden.
The alternative was a console that cries wolf on every dashboard page, which is how
a real mismatch goes unnoticed.

**Do not add `suppressHydrationWarning` anywhere else to quieten this.** If a new
component warns, check whether it is the same generated-id case before reaching for
it — everything else on that list (`Date.now()`, locale formatting, `typeof window`
branches, invalid nesting) is a real bug.

## Database connections

**`DATABASE_URL` is the app's URL; `DIRECT_URL` is only for migrations.** Supabase's
pooler answers on two ports and they are not interchangeable: **6543 is transaction
mode** (a server connection per statement, thousands of clients — what a web app
wants) and **5432 is session mode** (one per client, `pool_size: 15` — what `psql`
and `prisma migrate` want). `prisma.config.ts` reads `DIRECT_URL` explicitly, which
is right; `packages/db/src/index.ts` resolves **pooled-first**, which it did not
always do. Pointed at 5432, every page view and every better-auth session lookup
queued for one of fifteen slots and the app failed with
`(EMAXCONNSESSION) max clients reached in session mode`.

Two more things keep that from coming back, both in `packages/db/src/index.ts`:

- **The client is pinned to `globalThis`.** `PrismaPg` *is* a `pg.Pool`, and Next
  re-evaluates server modules on edit — unpinned, every hot reload built another
  pool while the last one kept its sockets, so an afternoon of editing was
  indistinguishable from a connection leak, because it was one. (This is the same
  reason the garden's server state is pinned.)
- **The pool is capped** — 3 connections in development, 5 in production,
  `PRISMA_POOL_MAX` to override. `pg.Pool` defaults to 10, so a dev server plus a
  build plus Studio could ask for 30 against a ceiling of 15. Queries here are
  short; waiting 50ms for a free connection is invisible next to failing.

## Common Commands

- `pnpm install` - Install dependencies
- `pnpm dev` - Start development server
- `pnpm build` - Build for production
- `pnpm test` - Run tests
- `pnpm db:push` - Push database schema (needed once for `RevenueConnection` —
  see "Importing real revenue")
- `pnpm db:studio` - Open database UI
- `pnpm dev` → **http://localhost:3001/dashboard** — the garden, signed in
- `ALLOTMENT_PLANS` **no longer does anything in `apps/web`.** It configured the
  book generator, which is deleted; a connected user's ladder is read out of their
  own plans (see "The real book on the plot"). It still works in the standalone
  `apps/allotment` demo.
- `pnpm --filter react-example dev` - The standalone copy on port 3000. It is the
  **only** place mock data still lives: it has no auth and no database, so it keeps
  its own `lib/mockData.ts` and its simulator. `apps/web/src/garden` is the one
  that ships, and it has neither.

## Maintenance

Keep CLAUDE.md updated when:

- Adding/removing dependencies
- Changing project structure
- Adding new features or services
- Modifying build/dev workflows

AI assistants should suggest updates to this file when they notice relevant changes.
