"use client";

import { useRef, useState } from "react";
import { ChevronDown, Globe, TrendingUp } from "lucide-react";

import { ForestSpectator } from "@/components/forests/forest-spectator";
import { StartupMark } from "@/components/startups/startup-mark";

/**
 * The board's list, and the row is the plot: clicking a company **extends** it
 * in place — the forest unfolds under the row, with its metric border still a
 * working menu, and every other startup stays where it was, visible below.
 * There is no detail page to get lost on and no way back to find; closing the
 * row is the way back.
 *
 * One row open at a time: each open row mounts a live canvas on a
 * requestAnimationFrame loop, and a board with five of them running is a fan
 * heater. Opening one closes the last, which also keeps the page's shape calm.
 *
 * Every label is precomputed on the server — money, growth, freshness — so
 * this component never formats anything: a client component still renders once
 * on the server, and "3h ago" computed twice a tick apart is a hydration
 * mismatch.
 */

export interface BoardForest {
  id: string;
  name: string;
  emoji: string | null;
  image: string | null;
  /** The category's display label, or null. */
  shelf: string | null;
  yours: boolean;
  /** "$4,321" or null when there is no reading. */
  mrrLabel: string | null;
  /** "+$521" / "−$90", tinted by `gainDirection`. */
  gainLabel: string | null;
  gainDirection: "up" | "down" | null;
  /** "25 trees · just now" — the whole meta line. */
  metaLabel: string;
  /** The directory entry: the founder's own words, and where the business lives. */
  description: string | null;
  website: string | null;
  /** "yourstartup.com" — the website with its scheme stripped, for the label. */
  websiteLabel: string | null;
}

export interface BoardGrower {
  id: string;
  /** "+$2,000" */
  gainLabel: string;
  /** "+400%" or "new". */
  rateLabel: string;
}

export function ForestBoard({
  forests,
  growers,
}: {
  forests: BoardForest[];
  growers: BoardGrower[];
}) {
  const [openId, setOpenId] = useState<string | null>(null);
  const rowRefs = useRef(new Map<string, HTMLLIElement>());

  const toggle = (id: string) => setOpenId((current) => (current === id ? null : id));

  /** The podium opens the row it names, and brings it on screen. */
  const jumpTo = (id: string) => {
    setOpenId(id);
    requestAnimationFrame(() => {
      rowRefs.current.get(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  };

  const byId = new Map(forests.map((forest) => [forest.id, forest]));

  return (
    <>
      {growers.length > 0 && (
        <section className="mb-6">
          <div className="mb-2.5 flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-success" />
            <h2 className="text-sm font-semibold">Fastest growing this month</h2>
            <span className="text-[11px] text-muted-foreground">
              MRR gained in 30 days, from each book&apos;s own subscription dates
            </span>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            {growers.map((grower, index) => {
              const forest = byId.get(grower.id);
              if (!forest) return null;
              return (
                <button
                  key={grower.id}
                  type="button"
                  onClick={() => jumpTo(grower.id)}
                  className="flex items-center gap-3 rounded-[18px] border border-border bg-card px-4 py-3 text-left shadow-elev-1 transition-colors hover:bg-muted/40"
                >
                  <span className="grid size-7 shrink-0 place-items-center rounded-full bg-success-soft text-xs font-bold text-success">
                    {index + 1}
                  </span>
                  <StartupMark
                    image={forest.image}
                    emoji={forest.emoji}
                    name={forest.name}
                    className="size-8 shrink-0 rounded-lg"
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13px] font-semibold">{forest.name}</span>
                    <span className="block text-[12px] font-semibold tabular-nums text-success">
                      {grower.gainLabel}
                      <span className="ml-1 font-normal text-muted-foreground">
                        {grower.rateLabel}
                      </span>
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
        </section>
      )}

      <ol className="space-y-3">
        {forests.map((forest, index) => {
          const open = openId === forest.id;
          return (
            <li
              key={forest.id}
              ref={(node) => {
                if (node) rowRefs.current.set(forest.id, node);
                else rowRefs.current.delete(forest.id);
              }}
              className="scroll-mt-20"
            >
              <div className="overflow-hidden rounded-2xl border border-border bg-card">
                <button
                  type="button"
                  onClick={() => toggle(forest.id)}
                  aria-expanded={open}
                  className="flex w-full items-center gap-4 px-5 py-4 text-left transition-colors hover:bg-muted/40"
                >
                  <span className="w-6 shrink-0 text-right text-sm font-semibold tabular-nums text-muted-foreground">
                    {index + 1}
                  </span>
                  <StartupMark
                    image={forest.image}
                    emoji={forest.emoji}
                    name={forest.name}
                    className="size-10 shrink-0 rounded-xl"
                  />
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2">
                      <span className="truncate text-[15px] font-semibold">{forest.name}</span>
                      {forest.shelf && (
                        <span className="shrink-0 rounded-full border border-border px-2 py-0.5 text-[10px] text-muted-foreground">
                          {forest.shelf}
                        </span>
                      )}
                      {forest.yours && (
                        <span className="shrink-0 rounded-full bg-success-soft px-2 py-0.5 text-[10px] font-semibold text-success">
                          Yours
                        </span>
                      )}
                    </span>
                    <span className="mt-0.5 block text-[12px] text-muted-foreground">
                      {forest.metaLabel}
                    </span>
                  </span>
                  <span className="shrink-0 text-right">
                    {forest.mrrLabel === null ? (
                      <span className="text-sm text-muted-foreground">—</span>
                    ) : (
                      <span className="block text-[15px] font-bold tabular-nums">
                        {forest.mrrLabel}
                        <span className="ml-1 text-[10px] font-semibold uppercase text-muted-foreground">
                          MRR
                        </span>
                      </span>
                    )}
                    {forest.gainLabel && (
                      <span
                        className={`mt-0.5 block text-[11.5px] font-semibold tabular-nums ${
                          forest.gainDirection === "up" ? "text-success" : "text-destructive"
                        }`}
                      >
                        {forest.gainLabel}
                        <span className="font-normal text-muted-foreground"> this month</span>
                      </span>
                    )}
                  </span>
                  <ChevronDown
                    className={`size-5 shrink-0 text-muted-foreground transition-transform ${
                      open ? "rotate-180" : ""
                    }`}
                  />
                </button>

                {/*
                  The forest, unfolded under its own row. Mounted only while
                  open — a closed row holds no canvas — and held near the
                  scene's proportions so the plot fills it. The top padding
                  gives the tallest stakes air; the metric border inside is
                  the same working menu the detail view had.
                */}
                {open && (
                  <>
                    {/*
                      The directory entry, said once, here. It hangs directly
                      under the row's name column — a profile subtitle, not a
                      banner — so the open row reads as one card: name, what it
                      is, where it lives, then the forest. The website is a
                      quiet chip on the right, outside the toggle button,
                      because a link inside a button is clickable as neither.
                    */}
                    {(forest.description || forest.website) && (
                      <div className="-mt-1.5 flex flex-wrap items-start justify-between gap-x-6 gap-y-2 px-5 pb-3.5 sm:pl-[116px]">
                        {forest.description ? (
                          <p className="min-w-0 max-w-prose text-[13px] leading-relaxed text-muted-foreground [display:-webkit-box] [-webkit-box-orient:vertical] [-webkit-line-clamp:2] overflow-hidden">
                            {forest.description}
                          </p>
                        ) : (
                          <span />
                        )}
                        {forest.website && (
                          <a
                            href={forest.website}
                            target="_blank"
                            rel="noopener noreferrer nofollow"
                            className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-muted/70 px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-muted hover:text-primary"
                          >
                            <Globe className="size-3.5 text-muted-foreground" />
                            {forest.websiteLabel}
                          </a>
                        )}
                      </div>
                    )}
                    <div className="aspect-[4/3] w-full border-t border-border/50 pt-12 sm:aspect-[2.1/1]">
                      <ForestSpectator startupId={forest.id} />
                    </div>
                  </>
                )}
              </div>
            </li>
          );
        })}
      </ol>
    </>
  );
}
