import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ExternalLink } from "lucide-react";

import prisma from "@Batman/db";

import { ForestSpectator } from "@/components/forests/forest-spectator";
import { StartupMark } from "@/components/startups/startup-mark";
import { requireSession } from "@/lib/session";
import { categoryLabel } from "@/lib/startup-categories";

/**
 * One public forest, in full — the plot's own view of somebody's business.
 *
 * The gate is the founder's toggle: a startup stood in the open is visible to
 * anyone signed in, everything above the plot and the plot itself; a private
 * one is a 404, not a "you may not" — as far as this viewer is concerned it
 * does not exist. The owner may always see their own, which is how they
 * preview what the board shows before flipping the switch.
 *
 * The plot below is the real renderer in the wall display's clean mode, served
 * the owner's book by `/api/garden?startup=` — the same caches, the same
 * derivation, drawn by the same canvas their own dashboard uses. Nothing here
 * is a picture of the garden; it is the garden.
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

export default async function PublicForestPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const [{ id }, session] = await Promise.all([params, requireSession()]);

  const startup = await prisma.startup.findUnique({
    where: { id },
    select: {
      id: true,
      userId: true,
      name: true,
      emoji: true,
      category: true,
      isPublic: true,
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
  });

  const yours = startup?.userId === session.user.id;
  if (!startup || (!startup.isPublic && !yours)) notFound();

  const shelf = categoryLabel(startup.category);
  const currency = startup.publicCurrency ?? "USD";
  const gain =
    startup.publicMrrMinor !== null && startup.publicMrrMinor30d !== null
      ? startup.publicMrrMinor - startup.publicMrrMinor30d
      : null;

  return (
    <div className="mx-auto max-w-6xl">
      <div className="mb-5 flex flex-wrap items-end justify-between gap-x-8 gap-y-4">
        <div>
          <Link
            href="/dashboard/forests"
            className="mb-2 inline-flex items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="size-3.5" />
            Leaderboard
          </Link>
          <div className="flex items-center gap-3.5">
            <StartupMark
              image={startup.connections[0]?.accountImage ?? null}
              emoji={startup.emoji}
              name={startup.name}
              className="size-12 rounded-2xl"
              emojiClassName="text-xl"
            />
            <div>
              <h1 className="flex flex-wrap items-center gap-2 text-[26px] font-bold leading-none tracking-tight">
                {startup.name}
                {shelf && (
                  <span className="rounded-full border border-border px-2.5 py-1 text-[11px] font-medium text-muted-foreground">
                    {shelf}
                  </span>
                )}
                {yours && (
                  <span className="rounded-full bg-success-soft px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-success">
                    Yours
                  </span>
                )}
              </h1>
              <p className="mt-1.5 text-[13px] text-muted-foreground">
                {startup.description ? `${startup.description} · ` : ""}
                {startup.publicSnapshotAt
                  ? `As its owner last saw it, ${age(startup.publicSnapshotAt)}`
                  : "No reading yet"}
                {!startup.isPublic && " · private — only you can see this"}
              </p>
              {startup.website && (
                <a
                  href={startup.website}
                  target="_blank"
                  rel="noopener noreferrer nofollow"
                  className="mt-1.5 inline-flex items-center gap-1.5 text-[12.5px] font-medium text-primary hover:underline"
                >
                  {startup.website.replace(/^https?:\/\//, "").replace(/\/$/, "")}
                  <ExternalLink className="size-3.5" />
                </a>
              )}
            </div>
          </div>
        </div>

        {/* The reading, said plainly: three figures a passer-by can take in. */}
        <dl className="flex items-end gap-8">
          {startup.publicMrrMinor !== null && (
            <div>
              <dt className="text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground">
                MRR
              </dt>
              <dd className="mt-1 text-[28px] font-bold leading-none tabular-nums tracking-tight">
                {money(startup.publicMrrMinor, currency)}
              </dd>
            </div>
          )}
          {gain !== null && (
            <div>
              <dt className="text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground">
                This month
              </dt>
              <dd
                className={`mt-1 text-[20px] font-bold leading-none tabular-nums tracking-tight ${
                  gain > 0 ? "text-success" : gain < 0 ? "text-destructive" : "text-muted-foreground"
                }`}
              >
                {gain === 0 ? "±0" : `${gain > 0 ? "+" : "−"}${money(Math.abs(gain), currency)}`}
              </dd>
            </div>
          )}
          {startup.publicTrees !== null && (
            <div>
              <dt className="text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground">
                Trees
              </dt>
              <dd className="mt-1 text-[20px] font-bold leading-none tabular-nums tracking-tight">
                {startup.publicTrees}
              </dd>
            </div>
          )}
        </dl>
      </div>

      {/*
        The forest itself — the real plot, with its metric border still a menu:
        hover a specimen for its reading, click one to re-bed the plot as that
        metric. The frame is held near the scene's own proportions so
        `computePlot` scales the plot up to fill it, its background is the
        page's own (the canvas paints no atmosphere in spectate mode), and the
        top padding gives the tallest stakes air under the hairline.
      */}
      <div className="aspect-[4/3] w-full overflow-hidden rounded-2xl border border-border/50 bg-card pt-10 sm:aspect-[2.2/1]">
        <ForestSpectator startupId={startup.id} />
      </div>
    </div>
  );
}
