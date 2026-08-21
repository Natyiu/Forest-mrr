"use client";

import Link from "next/link";
import { ArrowRight, Check } from "lucide-react";

import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme-toggle";
import { manrope } from "@/lib/fonts";
import {
  DodoPaymentsLogo,
  LemonSqueezyLogo,
  PolarLogo,
  RevenueCatLogo,
  StripeLogo,
  SuperwallLogo,
} from "@/components/revenue/provider-logos";

/**
 * **The landing page.**
 *
 * One column, one idea per screen, and the product's own picture doing the
 * arguing. The shape is the one every good software poster has settled on — a
 * pill, a headline, a sentence, two buttons, then the thing itself — and the
 * reason it keeps winning is that a reader decides whether to keep scrolling
 * from the picture, not from the copy above it. So the plot is the hero, at the
 * top, at full width, rather than a screenshot three sections down.
 *
 * Two rules held throughout, because they are the product's own:
 *
 * - **Nothing here claims a number.** No "10,000 founders", no fake logo wall,
 *   no invented testimonial. The trust strip names the six providers the app can
 *   actually read, which is a fact and happens to be the most useful thing on
 *   the page. A product whose entire pitch is "nothing on the plot is invented"
 *   cannot open with an invented figure. The figures on the stakes in the hero
 *   are the exception that proves it: they are a drawing of the interface, the
 *   way every product shot is, and they are nobody's revenue and claimed as
 *   nobody's.
 * - **The green is the garden's, not the app's.** `--primary` is violet, which
 *   is right for a button in the console and wrong for the one colour a person
 *   meets this product through. `--garden` is on `:root` and mode-aware, so
 *   these sections are lit correctly in both without a `dark:` in sight.
 *
 * **It is set in DM Sans throughout, tight.** The rest of the app is the same
 * family (`lib/fonts.ts`); this page and the auth screens apply it on their
 * own roots as well. A poster wants one voice — what makes the type read as
 * *designed* rather than as default is not a second family but negative tracking
 * (-0.045em on the headline, -0.035em on the section heads) and leading near
 * 1, so each heading locks into a single block instead of drifting apart line
 * by line.
 *
 * Feature cards are plain white panels with a hairline — one surface, no wash.
 */

const PROVIDERS = [
  { name: "Stripe", Logo: StripeLogo },
  { name: "Polar", Logo: PolarLogo },
  { name: "LemonSqueezy", Logo: LemonSqueezyLogo },
  { name: "DodoPayments", Logo: DodoPaymentsLogo },
  { name: "RevenueCat", Logo: RevenueCatLogo },
  { name: "Superwall", Logo: SuperwallLogo },
];

const CARDS = [
  {
    eyebrow: "The plot",
    title: "One tree, one subscription",
    body: "Every active subscription stands on the ground at the size it actually pays, bedded by the plan it is on.",
  },
  {
    eyebrow: "The border",
    title: "Eight metrics, growing",
    body: "Retention, churn, quick ratio, ARPA. Pick a specimen and the whole plot re-beds itself as that metric.",
  },
  {
    eyebrow: "The timeline",
    title: "Scrub a year in a second",
    body: "One book of business, sampled at every month. Drag the scrubber and watch the forest arrive.",
  },
  {
    eyebrow: "Startups",
    title: "More than one thing",
    body: "Each business keeps its own keys, its own forest, its own graphs — or put them all on one plot.",
  },
];

const PROMISES = [
  {
    title: "Nothing on the plot is invented.",
    body: "There is no demo data generator in the shipping app. Every plant is a row your payment provider returned for your account.",
  },
  {
    title: "Read-only keys, sealed at rest.",
    body: "A key that can move money is refused. What you do paste is encrypted with AES-256-GCM, and the screen only ever shows you its last four characters.",
  },
  {
    title: "A refusal is a result.",
    body: "If your key cannot read disputes, the page says so and names the status. One endpoint failing never takes the rest down.",
  },
  {
    title: "It tells you which book it is.",
    body: "A real forest and a sample one are drawn identically — that is the point of the sample — so the plot carries a chip that says which one you are looking at.",
  },
];

/** Two lobes over a trunk — the plot's own silhouette, not an outline pine. */
function TreeGlyph({
  className,
  style,
}: {
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      style={style}
      fill="currentColor"
      aria-hidden
      focusable="false"
    >
      <path d="M12 2.2c-3.4 0-6 2.3-6 5.2 0 .8.2 1.5.6 2.1C5.1 10.3 4 11.7 4 13.4 4 15.7 6 17.6 8.5 17.6h7c2.5 0 4.5-1.9 4.5-4.2 0-1.7-1.1-3.1-2.6-3.9.4-.6.6-1.3.6-2.1 0-2.9-2.6-5.2-6-5.2Z" />
      <path d="M10.9 16.4h2.2v5.1a1.1 1.1 0 0 1-2.2 0v-5.1Z" />
    </svg>
  );
}

/**
 * The tile set inside the headline, exactly where the design puts it: between
 * "as" and the green words, standing the full height of the line.
 *
 * It is `public/flower-box.svg` — the design's own tilted green tile with a
 * white flower on it — served as an image so it keeps its own hex, the same
 * rule the wordmark follows. Decorative, so `alt=""` and `aria-hidden`.
 *
 * **Everything about it is sized in `em`.** The headline is 40px, 62px and 88px
 * across three breakpoints; a tile in pixels would be a postage stamp at one and
 * a slab at another, and would need a class per breakpoint that somebody will
 * forget. In `em` it is one number and it tracks the type for free.
 *
 * `vertical-align` rather than a translate, so it sits on the text's own
 * baseline metrics instead of being nudged by eye at one size and wrong at the
 * other two.
 */
function LeafTile() {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src="/flower-box.svg"
      alt=""
      aria-hidden
      width={100}
      height={100}
      className="inline-block h-[1.22em] w-[1.22em] shrink-0 select-none align-[-0.27em] lg:h-[1.05em] lg:w-[1.05em] lg:align-[-0.2em]"
    />
  );
}

/**
 * The treeline the footer stands behind.
 *
 * **The heights are a written-down list, not `Math.random()`.** This renders on
 * the server and again on the client; a random skyline would differ between the
 * two and React would throw the subtree away and redraw it. The list is also the
 * only way to make it look planted rather than combed — a row of identical trees
 * is a fence.
 *
 * Bottom-aligned and clipped by the footer's top edge, so the trunks run into
 * the rule and the row reads as ground rather than as a strip of icons. The
 * opacities fall away from the middle, which is what keeps it a texture behind
 * the two lines of legal text and not a thing competing with them.
 */
const TREELINE = [
  [26, 0.28], [40, 0.34], [22, 0.24], [52, 0.40], [34, 0.30], [30, 0.26],
  [46, 0.36], [24, 0.22], [38, 0.32], [58, 0.42], [28, 0.26], [44, 0.34],
  [20, 0.20], [50, 0.38], [32, 0.28], [42, 0.32], [26, 0.24], [36, 0.30],
] as const;

function FooterTreeline() {
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-x-0 bottom-full flex items-end justify-center gap-[1.5vw] overflow-hidden px-4 text-garden"
    >
      {TREELINE.map(([size, opacity], index) => (
        <TreeGlyph
          key={index}
          className="shrink-0 translate-y-[22%]"
          // Inline because every tree is a different size: eighteen arbitrary
          // width classes would be eighteen rules in the stylesheet for one
          // decorative row.
          style={{ width: size, height: size, opacity }}
        />
      ))}
    </div>
  );
}

export function LandingPage({ supportEmail }: { supportEmail?: string }) {
  return (
    <div
      // `zoom` is desktop density only. On a phone it made 16px body copy
      // render at 12.8px, and layout below `lg` is designed at real size.
      className={`${manrope.className} min-h-screen bg-background text-foreground`}
    >
      {/*
        ══════════════════════════════════════════════════════════════════════
        THE POSTER — reproduced from the design, to the pixel where it matters
        ══════════════════════════════════════════════════════════════════════

        One painted band: a mint ground, a field of near-white clouds behind
        everything, the wordmark and a single pill at the top, a two-line
        headline with the leaf tile set inside it, one sentence, two buttons, and
        the plot running off the bottom edge.

        Sizes are the design's own, measured off it: 88px headline at 1.02
        leading, 70px pill and buttons, 22px sub-line, and the tile a full 1em so
        it stands the height of the line it sits in. They step down at the two
        breakpoints below `lg` because the design is a 1728px canvas and nothing
        in it was drawn for a phone. **The phone has its own design**, and below
        `sm` this band reproduces it the same way — measured, not eyeballed:
        45px headline at 430 wide, 11px sub-line and button labels, 112×39
        buttons 14px apart, a 97×33 pill in the header, and the drawing's own
        export (`landing-bg-mobile.svg`) as the whole ground. Between `sm` and
        `lg` there is no design, so the band gives up its fixed height and its
        `zoom` and parks the desktop artwork along its bottom edge.

        Palette is `.forest-landing` in index.css, including the note on where
        the green's contrast lands.
      */}
      <section
        // Three tiers. **Phone (below `sm`) is the mobile design, reproduced**:
        // full-bleed, no frame, and the whole band is its own export —
        // `landing-bg-mobile.svg`, a 430×932 drawing with the plot in the lower
        // 60% — set at 100% width from the top, with the section held to the
        // drawing's aspect so copy lands where the design put it and the plot
        // fills the rest. **Tablet (`sm`–`lg`)** has no design of its own: it
        // takes the desktop artwork anchored to the bottom edge at 130% width
        // with `pb-[46vw]` reserved for it. **Desktop (`lg`)** is untouched.
        className="forest-landing relative isolate flex aspect-[430/932] flex-col overflow-hidden bg-fl-ground bg-[url(/landing-bg-mobile.svg)] bg-[length:100%_auto] bg-top bg-no-repeat text-fl-ink sm:m-5 sm:aspect-auto sm:min-h-[calc(100svh-2.5rem)] sm:rounded-4xl sm:bg-[url(/landing-bg.svg)] sm:bg-[length:130%_auto] sm:bg-bottom sm:pb-[46vw] lg:h-[calc(125vh-2.5rem)] lg:min-h-[calc(125vh-2.5rem)] lg:bg-[length:auto_111%] lg:bg-[position:center_40px] lg:pb-0"
      >
        {/*
          The whole poster ground — mint, clouds and the plot — is one image, so
          there is nothing here for a screen reader to reach. A CSS background is
          decorative by definition and takes no `alt`, and the plot is the page's
          only picture of the product, so its description is carried as text
          instead of being lost.
        */}
        <p className="sr-only">
          The Forest MRR plot: an isometric garden of one tree per subscription,
          bedded by plan — Starter through Enterprise — beside a raised border
          where each revenue metric grows as its own specimen with its value on a
          stake.
        </p>

        {/*
          Everything on the band except the paint is set 20% smaller than the
          design measures. `zoom` rather than `transform: scale`, because zoom
          reflows — the header still spans the band and the padding, the type
          and the buttons all step down together — where a transform would
          leave a scaled picture sitting in an unscaled box.
        */}
        <div className="relative z-10">
          <header className="z-10 mx-auto flex w-full max-w-6xl flex-row items-center justify-between gap-3 px-5 pt-5 sm:px-6 sm:pt-6">
            <Link href="/" aria-label="Forest MRR" className="flex items-center">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/forest-mrr.svg"
                alt="Forest MRR"
                width={159}
                height={75}
                className="h-9 w-auto sm:h-11"
              />
            </Link>

            <div className="flex items-center gap-1 sm:gap-2">
              <a
                href="#how"
                className="hidden rounded-full px-3 py-2 text-[13px] font-medium text-fl-muted transition-colors hover:text-fl-ink sm:inline"
              >
                How it works
              </a>
              <Link
                href="/login"
                className="rounded-full px-3 py-2 text-[13px] font-medium text-fl-muted transition-colors hover:text-fl-ink"
              >
                Sign in
              </Link>
              <span className="[&_button:hover]:bg-fl-green/10 [&_button]:text-fl-muted [&_button:hover]:text-fl-ink">
                <ThemeToggle />
              </span>
              <Link href="/signup">
                <Button className="h-9 rounded-full border-0 bg-fl-green px-4 text-[13px] font-medium text-white shadow-none hover:bg-fl-green/90">
                  Get started
                </Button>
              </Link>
            </div>
          </header>

          <div className="relative z-10 mx-auto max-w-3xl px-5 pt-16 text-center sm:px-6 sm:pt-20 lg:pt-24">
            <h1 className="text-[36px] font-bold leading-[1.05] tracking-[-0.04em] text-fl-ink sm:text-[52px] lg:text-[64px]">
              Your Stripe revenue
              <br />
              as <LeafTile />{" "}
              <span className="text-fl-green">a living forest</span>
            </h1>

            <p className="mx-auto mt-4 max-w-xl text-[15px] leading-relaxed text-fl-muted sm:mt-5 sm:text-[17px]">
              Watch subscribers grow into trees, spot churn the moment leaves turn
              orange, and see every payment fall as rain.
            </p>

            <div className="mt-7 flex flex-row flex-wrap items-center justify-center gap-2.5 sm:mt-8">
              <Link href="/signup">
                <Button className="h-11 rounded-full border-0 bg-fl-green px-6 text-[14px] font-medium text-white shadow-none hover:bg-fl-green/90">
                  Forest your MRR
                </Button>
              </Link>
              <a href="#how">
                <Button
                  variant="outline"
                  className="h-11 rounded-full border-border bg-white px-6 text-[14px] font-medium text-fl-ink shadow-none hover:bg-white"
                >
                  See how it works
                </Button>
              </a>
            </div>
          </div>
        </div>

      </section>




      {/* ── Providers ────────────────────────────────────────────────────── */}
      <section className="border-y border-border bg-card/40 py-12 sm:py-16">
        <div className="mx-auto max-w-6xl px-5 text-center">
          <p className="text-[17px] font-normal text-muted-foreground sm:text-[20px]">
            Reads the account you already sell through
          </p>
          {/*
            The marks are inlined SVGs tinted with `currentColor` rather than
            `<img>`s, so the row is one muted colour instead of six brand hues —
            named providers, not a logo wall.
          */}
          {/*
            Below `sm` the six names are a marquee rather than a wrapped stack —
            three ragged centred rows on a phone read as a lump, and a single
            sliding row keeps the strip one line tall. The track is two copies
            of the row (the second hidden from the accessibility tree, so the
            list is announced once) sliding by half its own width; the CSS is
            `.fl-marquee` in index.css, and it stands still for
            `prefers-reduced-motion`.
          */}
          {/* -mx-5 undoes the container's padding so the row runs edge to edge under the fade. */}
          <div className="fl-marquee -mx-5 mt-6 sm:hidden">
            <div className="fl-marquee-track flex w-max items-center">
              {[0, 1].map((copy) => (
                <div key={copy} aria-hidden={copy === 1} className="flex items-center gap-8 pr-8">
                  {PROVIDERS.map(({ name, Logo }) => (
                    <span
                      key={name}
                      className="flex items-center gap-2.5 whitespace-nowrap text-[19px] font-medium tracking-tight text-foreground/55"
                    >
                      <Logo className="h-6 w-6 shrink-0" />
                      {name}
                    </span>
                  ))}
                </div>
              ))}
            </div>
          </div>
          <div className="mt-8 hidden flex-wrap items-center justify-center gap-x-11 gap-y-5 sm:flex">
            {PROVIDERS.map(({ name, Logo }) => (
              <span
                key={name}
                className="flex items-center gap-2.5 text-[22px] font-medium tracking-tight text-foreground/55"
              >
                <Logo className="h-7 w-7 shrink-0" />
                {name}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* ── What it is ───────────────────────────────────────────────────── */}
      {/*
        The same mint as the poster's ground (`--fl-ground`, #E8F8EE), so the
        band reads as a continuation of it. The token is scoped to
        `.forest-landing`, hence the class here rather than a raw hex.
      */}
      <section id="how" className="scroll-mt-20 bg-background py-16 text-center sm:py-24">
        <div className="mx-auto max-w-6xl px-5">
        <p className="text-[13px] font-medium text-garden">
          The plot
        </p>
        <h2 className="mx-auto mt-3 max-w-2xl text-[28px] font-bold leading-[1.12] tracking-[-0.03em] sm:text-[36px]">
          A dashboard you read at a glance
        </h2>
        <p className="mx-auto mt-4 max-w-xl text-[15px] leading-relaxed text-muted-foreground">
          A table of subscriptions tells you what happened after you have read it.
          A forest tells you before. Size is money, colour is health, and an empty
          patch is a month that did not go well.
        </p>
        </div>

        {/* The card row gets a wider container than the copy above it, so each
            card has more room without the heading measure stretching with it. */}
        <div className="mx-auto max-w-[84rem] px-5">
        <div className="mt-10 grid gap-5 text-left sm:mt-14 sm:grid-cols-2 lg:grid-cols-4">
          {/*
            Two boxes per card, not one: a white frame with a hairline and a
            shadow, and a washed panel inset inside it. The frame is what stops
            four tinted rectangles reading as four coloured blocks laid on the
            page — each card is an object with a mount, and the colour is inside
            the mount rather than being the card.

            The wash runs to `transparent` rather than to a second colour, so it
            lands on the card's own surface and stays correct in both modes. Two
            hues would also imply a relationship between them, and the `--pop-*`
            family is documented as meaning nothing.
          */}
          {CARDS.map((card) => (
            <article
              key={card.eyebrow}
              className="rounded-2xl border border-border bg-card p-6"
            >
              <p className="text-[12px] font-medium text-muted-foreground">
                {card.eyebrow}
              </p>
              <h3 className="mt-2 text-[18px] font-semibold leading-[1.25] tracking-[-0.02em]">
                {card.title}
              </h3>
              <p className="mt-2.5 text-[14px] leading-relaxed text-muted-foreground">
                {card.body}
              </p>
            </article>
          ))}
        </div>
        </div>
      </section>

      {/* ── Promises ─────────────────────────────────────────────────────── */}
      <section className="border-t border-border bg-card/40 py-16 sm:py-24">
        <div className="mx-auto grid max-w-6xl gap-10 px-5 sm:gap-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] lg:gap-20">
          <div>
            <p className="text-[13px] font-medium text-garden">
              Why trust it
            </p>
            <h2 className="mt-3 text-[28px] font-bold leading-[1.12] tracking-[-0.03em] sm:text-[36px]">
              It only ever draws what your provider said
            </h2>
            <p className="mt-4 max-w-lg text-[15px] leading-relaxed text-muted-foreground">
              A pretty chart of numbers nobody can source is worse than no chart.
              Everything here is one read away from the place your money actually
              arrives.
            </p>
            <Link href="/signup" className="mt-8 inline-block">
              <Button className="h-11 rounded-full bg-garden px-6 text-[14px] font-medium text-garden-ink hover:bg-garden-hover">
                Connect a key
                <ArrowRight className="ml-1 h-4 w-4" />
              </Button>
            </Link>
          </div>

          <ul className="space-y-1">
            {PROMISES.map((promise) => (
              <li
                key={promise.title}
                className="flex gap-4 border-b border-border py-6 last:border-0"
              >
                <span className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-full bg-garden-wash text-garden">
                  <Check className="h-4 w-4" />
                </span>
                <div>
                  <p className="text-[17px] font-semibold tracking-tight">{promise.title}</p>
                  <p className="mt-2 text-[15px] leading-relaxed text-muted-foreground">
                    {promise.body}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* ── Closing ──────────────────────────────────────────────────────── */}
      {/*
        The same mint as the poster and the "how" band (`--fl-ground`), so the
        page closes on the ground it opened on. Text is set in the poster's ink,
        because the mint is painted and does not follow the theme.
      */}
      <section className="bg-background py-20 text-center sm:py-28">
        <div className="mx-auto max-w-6xl px-5">
          <h2 className="mx-auto max-w-3xl text-[28px] font-bold leading-[1.12] tracking-[-0.03em] sm:text-[40px]">
            Go and look at your business
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-[15px] leading-relaxed text-muted-foreground">
            Paste one read-only key. The forest is planted by the time you look up.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center">
            <Link href="/signup">
              <Button className="h-11 rounded-full bg-fl-green px-6 text-[14px] font-medium text-white hover:bg-fl-green/90">
                Start free
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* ── Footer ───────────────────────────────────────────────────────── */}
      <footer className="relative border-t border-border py-8">
        <FooterTreeline />
        <div className="mx-auto flex max-w-6xl flex-col items-start gap-3 px-5 text-[13.5px] text-muted-foreground sm:flex-row sm:flex-wrap sm:items-center sm:justify-between sm:gap-4">
          <span>Forest MRR</span>
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
            <Link href="/legal/privacy" className="transition-colors hover:text-foreground">
              Privacy
            </Link>
            <Link href="/legal/terms" className="transition-colors hover:text-foreground">
              Terms
            </Link>
            {supportEmail && (
              <a href={`mailto:${supportEmail}`} className="transition-colors hover:text-foreground">
                Contact
              </a>
            )}
          </div>
        </div>
      </footer>
    </div>
  );
}
