import Link from "next/link";
import { Trees } from "lucide-react";

import prisma from "@Batman/db";

import {
  type BoardForest,
  type BoardGrower,
  ForestBoard,
} from "@/components/forests/forest-board";
import { AdRails } from "@/components/ads/ad-rails";
import { fulfilAdCheckout, getAdSpots } from "@/lib/ads.server";
import { requireSession } from "@/lib/session";
import {
  STARTUP_CATEGORIES,
  categoryLabel,
  isStartupCategory,
} from "@/lib/startup-categories";

/**
 * The public board: every forest whose owner has chosen to stand it in the
 * open, tallest first — a company list with a shelf per category and the
 * month's fastest growers called out on top. **A row extends rather than
 * opens**: clicking a company unfolds its full plot in place, metric border
 * and all, and every other startup stays visible below it.
 *
 * **The board reads snapshots, never keys.** A row shows what was written the
 * last time its *owner* derived their own forest (`snapshotStartups` in
 * `lib/revenue/forest.ts`); the unfolded plot is served by
 * `/api/garden?startup=`, which re-checks the public gate on every request.
 * Growth is real too: the baseline is the same book read at thirty days ago
 * from the subscriptions' own start and cancel dates, not a stored guess.
 *
 * Every label is formatted here and handed to the client board as strings, so
 * the accordion never formats money or relative time — see the note on
 * `ForestBoard`.
 */
export const dynamic = "force-dynamic";

const money = (minor: number, currency: string) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: minor % 100 === 0 ? 0 : 2,
  }).format(minor / 100);

function age(date: Date): string {
  const mins = Math.floor((Date.now() - date.getTime()) / 60_000);
  if (mins < 60) return "just now";
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

const PILL_ON =
  "rounded-full bg-primary px-3.5 py-1.5 text-xs font-semibold text-primary-foreground shadow-elev-1";
const PILL_OFF =
  "rounded-full border border-border bg-card px-3.5 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground";

export default async function ForestsPage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string; checkout_id?: string }>;
}) {
  const [session, params] = await Promise.all([requireSession(), searchParams]);

  // Just paid? Create the spot from the checkout before the board renders, so
  // the buyer sees their product on this very page load — no wait on a webhook.
  if (params.checkout_id) {
    await fulfilAdCheckout(params.checkout_id).catch(() => {});
  }

  const selected =
    params.category && isStartupCategory(params.category) ? params.category : null;

  const [rows, mine, adSpots] = await Promise.all([
    prisma.startup.findMany({
      where: { isPublic: true },
      select: {
        id: true,
        userId: true,
        name: true,
        emoji: true,
        category: true,
        publicMrrMinor: true,
        publicMrrMinor30d: true,
        publicCurrency: true,
        publicTrees: true,
        publicSnapshotAt: true,
        website: true,
        description: true,
        connections: {
          where: { accountImage: { not: null } },
          orderBy: { createdAt: "asc" },
          take: 1,
          select: { accountImage: true },
        },
      },
    }),
    prisma.startup.count({ where: { userId: session.user.id, isPublic: true } }),
    getAdSpots("forests"),
  ]);

  // Only shelves somebody is standing on get a pill — a filter that always
  // shows an empty board is a dead end with a label.
  const shelves = STARTUP_CATEGORIES.filter((category) =>
    rows.some((forest) => forest.category === category.value),
  );

  const visible = selected ? rows.filter((forest) => forest.category === selected) : rows;

  // Tallest first; forests with no reading yet stand at the back rather than
  // being sorted as $0, which would rank "not measured" below "measured nothing".
  const sorted = [...visible].sort(
    (a, b) => (b.publicMrrMinor ?? -1) - (a.publicMrrMinor ?? -1),
  );

  const forests: BoardForest[] = sorted.map((row) => {
    const currency = row.publicCurrency ?? "USD";
    const gain =
      row.publicMrrMinor !== null && row.publicMrrMinor30d !== null
        ? row.publicMrrMinor - row.publicMrrMinor30d
        : null;
    const treesLabel =
      row.publicTrees === null
        ? "no reading yet"
        : `${row.publicTrees} tree${row.publicTrees === 1 ? "" : "s"}`;
    return {
      id: row.id,
      name: row.name,
      emoji: row.emoji,
      image: row.connections[0]?.accountImage ?? null,
      shelf: categoryLabel(row.category),
      yours: row.userId === session.user.id,
      mrrLabel: row.publicMrrMinor === null ? null : money(row.publicMrrMinor, currency),
      gainLabel:
        gain === null || gain === 0
          ? null
          : `${gain > 0 ? "+" : "−"}${money(Math.abs(gain), currency)}`,
      gainDirection: gain === null || gain === 0 ? null : gain > 0 ? "up" : "down",
      metaLabel: `${treesLabel}${row.publicSnapshotAt ? ` · ${age(row.publicSnapshotAt)}` : ""}`,
      description: row.description,
      website: row.website,
      websiteLabel: row.website
        ? row.website.replace(/^https?:\/\//, "").replace(/\/$/, "")
        : null,
    };
  });

  // Fastest growing this month: gained MRR, ranked by rate. A forest that grew
  // from nothing outranks every percentage — it is new growth, not a ratio.
  const growers: BoardGrower[] = sorted
    .map((row) => {
      if (row.publicMrrMinor === null || row.publicMrrMinor30d === null) return null;
      const gain = row.publicMrrMinor - row.publicMrrMinor30d;
      if (gain <= 0) return null;
      const pct = row.publicMrrMinor30d > 0 ? gain / row.publicMrrMinor30d : null;
      return { row, gain, pct };
    })
    .filter((entry): entry is NonNullable<typeof entry> => entry !== null)
    .sort((a, b) => {
      const rateA = a.pct ?? Number.POSITIVE_INFINITY;
      const rateB = b.pct ?? Number.POSITIVE_INFINITY;
      return rateB - rateA || b.gain - a.gain;
    })
    .slice(0, 3)
    .map(({ row, gain, pct }) => ({
      id: row.id,
      gainLabel: `+${money(gain, row.publicCurrency ?? "USD")}`,
      rateLabel: pct === null ? "new" : `+${Math.round(pct * 100)}%`,
    }));

  return (
    <div className="mx-auto max-w-4xl">
      {/*
        The sponsor rails live here and only here: this board is the page
        people come back to, so it is the one worth a sponsor's money — and a
        settings page wearing ads is a product that looks rented. Fixed at the
        viewport edges, so the board itself stays centred and untouched.
      */}
      <AdRails spots={adSpots} />
      <div className="mb-5">
        <p className="text-[13px] font-medium text-ink-faint">
          The open valley
        </p>
        <h1 className="mt-1 text-[28px] font-bold leading-none tracking-[-0.03em] text-ink">
          Leaderboard
        </h1>
        <p className="mt-2 text-[14px] text-ink-soft">
          Every forest standing in the open, tallest first. Click one and its plot
          unfolds right here.
        </p>
      </div>

      {shelves.length > 0 && (
        <div className="mb-6 flex flex-wrap items-center gap-1.5">
          <Link
            href="/dashboard/forests"
            aria-current={selected === null ? "page" : undefined}
            className={selected === null ? PILL_ON : PILL_OFF}
          >
            All
          </Link>
          {shelves.map((category) => (
            <Link
              key={category.value}
              href={`/dashboard/forests?category=${category.value}` as never}
              aria-current={selected === category.value ? "page" : undefined}
              className={selected === category.value ? PILL_ON : PILL_OFF}
            >
              {category.label}
            </Link>
          ))}
        </div>
      )}

      {forests.length === 0 ? (
        <div className="rounded-[20px] border border-dashed border-border bg-card/60 px-6 py-14 text-center">
          <Trees className="mx-auto h-8 w-8 text-muted-foreground" />
          <p className="mt-3 text-sm font-semibold">
            {selected ? "No forests on this shelf yet" : "No forests in the open yet"}
          </p>
          <p className="mx-auto mt-1 max-w-sm text-xs text-muted-foreground">
            A forest appears here when its owner lists it from the startup&apos;s
            settings. Yours could be the first.
          </p>
          <Link
            href="/dashboard/startups"
            className="mt-4 inline-flex h-9 items-center rounded-full border border-border bg-card px-4 text-xs font-medium hover:text-primary"
          >
            Open your startups
          </Link>
        </div>
      ) : (
        <>
          <ForestBoard forests={forests} growers={growers} />

          {mine === 0 && (
            <p className="mt-5 text-center text-xs text-muted-foreground">
              Your forests are private. Stand one in the open from{" "}
              <Link href="/dashboard/startups" className="font-medium text-primary hover:underline">
                its settings
              </Link>{" "}
              to compare your trees here.
            </p>
          )}
        </>
      )}
    </div>
  );
}
