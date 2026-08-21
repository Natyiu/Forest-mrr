"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { BarChart3, ChevronRight, Plus, Sprout } from "lucide-react";

import { Button } from "@/components/ui/button";
import { ConnectRevenueDialog } from "@/components/revenue/connect-revenue-dialog";
import { NewStartupDialog } from "@/components/startups/new-startup-dialog";
import { StartupMark } from "@/components/startups/startup-mark";
import { type RevenueConnectionView } from "@/lib/actions/revenue";
import { pageEnabled } from "@/lib/nav-features";
import { cn } from "@/lib/utils";
import type { StartupView } from "@/lib/startups";

/**
 * **The list of businesses this account runs — one row each, and the row is the
 * door.**
 *
 * Clicking a startup opens its page. There used to be an expanding panel here —
 * connection rows, Re-check, Disconnect, an *Open forest* and a *Manage* button —
 * which meant the same business had two homes and you had to know that the real
 * one was behind the smaller of two buttons. Everything a startup offers now
 * lives on its own page, and this list only answers "which businesses are there,
 * which one is on the plot, and what does each read from".
 *
 * The pills are the garden's own green, not shadcn's status family — see the
 * token bridge note in `index.css`: `--success` on a garden-skinned page is
 * still the host app's and can disagree with the card under it; `--garden-*`
 * cannot.
 */

/** One pill shape — see the note on the component. */
const PILL =
  "inline-flex h-6 shrink-0 items-center gap-1.5 rounded-4xl px-2.5 text-[11px] font-semibold";

export function RevenueConnections({
  groups,
  activeId,
}: {
  groups: Array<{ startup: StartupView; connections: RevenueConnectionView[] }>;
  activeId: string | "all" | null;
}) {
  const router = useRouter();

  const [dialog, setDialog] = useState<{ startupId: string } | null>(null);
  const [creating, setCreating] = useState(false);

  const totalConnections = groups.reduce((sum, group) => sum + group.connections.length, 0);

  return (
    <div>
      {/*
        Title and the one action that makes a new row, on one line. The button used
        to sit in a band of its own below the heading, beside a paragraph — which put
        two competing introductions between the page's name and its content.
      */}
      <header className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
        <p className="text-[13px] font-medium text-ink-faint">
          Startups
        </p>
        <h1 className="mt-1 text-[28px] font-bold leading-none tracking-[-0.03em] text-ink">
          Your startups
        </h1>
        <p className="mt-2 text-[14px] text-ink-soft">
            One book per startup: its own read-only keys, its own forest.
          </p>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          {totalConnections > 0 && pageEnabled("revenue") && (
            <Button asChild size="sm" variant="outline" className="h-10 rounded-full px-4 text-[13px]">
              <Link href="/dashboard/revenue">
                <BarChart3 className="size-4" />
                View data
              </Link>
            </Button>
          )}
          <Button
            size="sm"
            className="h-10 rounded-full px-4 text-[13px]"
            onClick={() => setCreating(true)}
          >
            <Plus className="size-4" />
            New startup
          </Button>
        </div>
      </header>

      {groups.length === 0 ? (
        <div className="rounded-[20px] border border-dashed border-border bg-card/60 px-6 py-12 text-center">
          <span className="mx-auto grid size-12 place-items-center rounded-2xl bg-muted text-muted-foreground">
            <Sprout className="size-6" />
          </span>
          <p className="mt-4 text-base font-semibold">No startups yet</p>
          <p className="mx-auto mt-1.5 max-w-sm text-[13px] text-muted-foreground">
            A startup is a book of business — its own providers, its own forest. Make one
            and connect the place its money arrives.
          </p>
          <Button
            size="sm"
            className="mt-5 h-10 rounded-full px-4 text-[13px]"
            onClick={() => setCreating(true)}
          >
            <Plus className="size-4" />
            New startup
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          {groups.map(({ startup, connections }) => {
            const isActive = startup.id === activeId;

            return (
              <Link
                key={startup.id}
                href={`/dashboard/startups/${startup.id}` as never}
                className="flex items-center gap-3.5 rounded-2xl border border-border bg-card px-5 py-4 shadow-elev-1 transition-colors hover:bg-muted/40"
              >
                <StartupMark
                  image={startup.image}
                  emoji={startup.emoji}
                  name={startup.name}
                  className="size-11 rounded-2xl"
                  emojiClassName="text-xl"
                />

                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-2">
                    <span className="truncate text-[15px] font-semibold">{startup.name}</span>
                    {isActive && (
                      <span className={cn(PILL, "bg-garden-wash text-garden-soft")}>
                        <span className="size-1.5 rounded-full bg-current" />
                        On the plot
                      </span>
                    )}
                  </span>
                  {/* The providers, named. The row of monograms beside this said the
                      same thing a second time, in a second alphabet. */}
                  <span className="mt-0.5 block truncate text-[12.5px] text-muted-foreground">
                    {connections.length === 0
                      ? "No provider connected"
                      : `${connections.length} provider${connections.length === 1 ? "" : "s"} · ${connections
                          .map((connection) => connection.providerName)
                          .join(", ")}`}
                  </span>
                </span>

                <ChevronRight className="size-5 shrink-0 text-muted-foreground" />
              </Link>
            );
          })}
        </div>
      )}

      {/* The reassurance, once, under the keys it is about. */}
      {groups.length > 0 && (
        <p className="mt-5 text-[12.5px] leading-relaxed text-muted-foreground">
          Keys are read-only, stored encrypted, and checked the moment you paste one — so a
          connection that says connected has answered at least once.
        </p>
      )}

      {/*
        Naming a business and connecting it are one errand, so they are one flow:
        the name dialog hands its new id straight to the connect dialog. A startup
        with no provider draws an empty plot, which makes "connect it later" a
        promise the product has to chase the user about.
      */}
      <NewStartupDialog
        open={creating}
        onOpenChange={setCreating}
        onCreated={(startupId) => {
          router.refresh();
          setDialog({ startupId });
        }}
      />

      {dialog && (
        <ConnectRevenueDialog
          open
          onOpenChange={(next) => !next && setDialog(null)}
          startupId={dialog.startupId}
          connections={
            groups.find((group) => group.startup.id === dialog.startupId)?.connections ?? []
          }
          onConnected={() => {
            setDialog(null);
            router.refresh();
          }}
          onDisconnected={() => router.refresh()}
        />
      )}
    </div>
  );
}
