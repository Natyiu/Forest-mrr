"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  BarChart3,
  ChevronDown,
  Loader2,
  Plus,
  RefreshCw,
  Settings2,
  Sprout,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { ConnectRevenueDialog } from "@/components/revenue/connect-revenue-dialog";
import { NewStartupDialog } from "@/components/startups/new-startup-dialog";
import { StartupMark } from "@/components/startups/startup-mark";
import { ProviderMark } from "@/components/revenue/provider-mark";
import {
  type RevenueConnectionView,
  removeRevenueConnection,
  verifyRevenueConnection,
} from "@/lib/actions/revenue";
import { switchStartup } from "@/lib/actions/startups";
import { REVENUE_PROVIDERS, type RevenueProviderId } from "@/lib/revenue/providers";
import { pageEnabled } from "@/lib/nav-features";
import { cn } from "@/lib/utils";
import type { StartupView } from "@/lib/startups";

/**
 * **The list of businesses this account runs — one row each, opened to see inside.**
 *
 * A startup is the thing being listed; how it is connected is a detail *of* one, so
 * the page is a list of startups that expands rather than a stack of cards each
 * showing everything at once. With every provider row, every status pill and every
 * action open on all of them simultaneously, three businesses put nine controls on
 * screen before you had chosen which one you cared about.
 *
 * The rules that keep it calm:
 *
 * - **A closed row states, an open row acts.** Closed, it carries only the name, the
 *   providers behind it and whether it is the book on the plot. Every button is inside
 *   the panel you opened, which is the one you meant.
 * - **Four verbs, not seven.** A connection offers *Re-check* and *Disconnect*; a
 *   startup offers *Open forest* and *Manage*. Replacing a key and connecting a second
 *   provider are both *changing the business*, so they are on its own page with rename,
 *   colour and delete — and *Connect another* sitting a few pixels from *New startup*,
 *   both introduced by a plus, was two different plus buttons on one screen.
 * - **The pills are the garden's own green**, not shadcn's status family. The bridge
 *   in `index.css` deliberately re-points only the neutral and primary tokens, so
 *   `--success` on a garden-skinned page is still the *host app's* — which, with the
 *   app in dark mode and the plot's palette in light, painted a near-black pill on a
 *   pale mint card. `--garden-*` follows the same `data-mode` everything else here
 *   does, so it cannot disagree with the card under it.
 * - **Connected is solid, on the plot is a wash.** They are different kinds of fact —
 *   one is a credential's health, the other is which book you are looking at — so
 *   they are never the same pill at the same weight.
 * - **Disconnect is a labelled button, not an icon in an overflow menu.** It is the
 *   whole reason this page exists for somebody who came here to remove a key.
 */

/**
 * `2026-08-17` → `17 Aug`. A fixed locale and an explicit UTC zone on purpose:
 * this renders on the client after a server pass, and a date formatted by the
 * visitor's own zone is a hydration mismatch with a passport.
 */
const DAY = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  timeZone: "UTC",
});

function checkedLabel(iso: string | null): string | null {
  if (!iso) return null;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  return DAY.format(date);
}

/** A 36-character UUID is the widest thing in a row and the least read. */
function shortRef(reference: string): string {
  return reference.length > 12 ? `${reference.slice(0, 8)}…` : reference;
}

/** One pill shape, two weights — see the note on the component. */
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
  const [isPending, startTransition] = useTransition();
  const [busy, setBusy] = useState<string | null>(null);

  /**
   * Which rows are open. The book on the plot starts open, because it is the one
   * a person arriving here is most likely to be asking about; everything else is
   * closed until asked for.
   */
  const [open, setOpen] = useState<Record<string, boolean>>(() =>
    typeof activeId === "string" && activeId !== "all" ? { [activeId]: true } : {},
  );

  const [dialog, setDialog] = useState<{
    startupId: string;
    provider?: RevenueProviderId;
  } | null>(null);
  const [confirmRemove, setConfirmRemove] = useState<RevenueConnectionView | null>(null);
  const [creating, setCreating] = useState(false);

  const totalConnections = groups.reduce((sum, group) => sum + group.connections.length, 0);

  function recheck(connection: RevenueConnectionView) {
    setBusy(connection.id);
    startTransition(async () => {
      const result = await verifyRevenueConnection({
        provider: connection.provider,
        startupId: connection.startupId,
      });
      setBusy(null);
      if (result.ok) {
        toast.success(`${connection.providerName} still reads`, { description: result.detail });
      } else {
        toast.error(`${connection.providerName} could not be read`, {
          description: result.message,
        });
      }
      router.refresh();
    });
  }

  function remove(connection: RevenueConnectionView) {
    setBusy(connection.id);
    startTransition(async () => {
      const result = await removeRevenueConnection({
        provider: connection.provider,
        startupId: connection.startupId,
      });
      setBusy(null);
      setConfirmRemove(null);
      if (!result.ok) {
        toast.error(result.message ?? "Could not disconnect");
        return;
      }
      toast.success(`${connection.providerName} disconnected`);
      router.refresh();
    });
  }

  /** Switch the book, then go and look at it — the two halves of "open". */
  function look(startup: StartupView) {
    startTransition(async () => {
      await switchStartup({ id: startup.id });
      router.push("/dashboard");
    });
  }

  return (
    <div>
      {/*
        Title and the one action that makes a new row, on one line. The button used
        to sit in a band of its own below the heading, beside a paragraph — which put
        two competing introductions between the page's name and its content.
      */}
      <header className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-ink-faint">
            Startups
          </p>
          <h1 className="mt-1.5 text-[34px] font-extrabold leading-none tracking-[-0.03em] text-ink">
            Your startups
          </h1>
          <p className="mt-2.5 text-[13.5px] text-ink-soft">
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
            const isOpen = Boolean(open[startup.id]);
            const panelId = `startup-${startup.id}`;

            return (
              <section
                key={startup.id}
                className="overflow-hidden rounded-[20px] border border-border bg-card shadow-elev-1"
              >
                {/*
                  The whole closed row is the control, so it holds no other one: a
                  button inside a button is neither clickable nor announceable.
                */}
                <button
                  type="button"
                  onClick={() =>
                    setOpen((current) => ({ ...current, [startup.id]: !current[startup.id] }))
                  }
                  aria-expanded={isOpen}
                  aria-controls={panelId}
                  className="flex w-full cursor-pointer items-center gap-3.5 px-5 py-4 text-left transition-colors hover:bg-muted/40"
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

                  <ChevronDown
                    className={cn(
                      "size-5 shrink-0 text-muted-foreground transition-transform",
                      isOpen && "rotate-180",
                    )}
                  />
                </button>

                {isOpen && (
                  <div id={panelId} className="border-t border-border/60">
                    {connections.length === 0 ? (
                      <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
                        <p className="text-[12.5px] text-muted-foreground">
                          Its forest stays unplanted until a provider is connected.
                        </p>
                        {/*
                          The one place connecting is offered from this page, and it
                          earns it: a business with nothing in it is the single moment
                          where the answer to "what now?" *is* "connect something".
                          Every other startup already has its answer, and a permanent
                          button repeating the offer was chrome.
                        */}
                        <Button
                          size="sm"
                          className="h-9 rounded-full px-4 text-[13px]"
                          onClick={() => setDialog({ startupId: startup.id })}
                        >
                          <Plus className="size-4" />
                          Connect provider
                        </Button>
                      </div>
                    ) : (
                      <ul>
                        {connections.map((connection) => {
                          const provider = REVENUE_PROVIDERS[connection.provider];
                          const working = isPending && busy === connection.id;
                          const failing = connection.status === "error";
                          const checked = checkedLabel(connection.lastVerifiedAt);

                          /*
                            One meta line, not three. The account name, the last four
                            characters of the key, the provider's own reference and the
                            date it last answered are all the same fact — *which key
                            this is and whether it still works* — so they read as one
                            sentence rather than as a stack of monospace.
                          */
                          const meta = [
                            connection.accountLabel,
                            `key ····${connection.secretHint}`,
                            connection.reference ? `id ${shortRef(connection.reference)}` : null,
                            checked ? `checked ${checked}` : null,
                          ].filter(Boolean);

                          return (
                            <li
                              key={connection.id}
                              className="flex flex-wrap items-center gap-3.5 border-b border-border/40 px-5 py-4 last:border-b-0"
                            >
                              <ProviderMark
                                provider={provider}
                                className="size-9 rounded-xl text-[12px]"
                              />

                              <div className="min-w-[12rem] flex-1">
                                <div className="flex items-center gap-2">
                                  <p className="text-[14px] font-semibold">{provider.name}</p>
                                  <span
                                    className={cn(
                                      PILL,
                                      failing
                                        ? "bg-destructive/10 text-destructive"
                                        : "bg-garden text-garden-ink",
                                    )}
                                  >
                                    {failing ? "Needs attention" : "Connected"}
                                  </span>
                                </div>

                                <p
                                  className="mt-0.5 truncate text-[12.5px] text-muted-foreground"
                                  title={connection.reference ?? undefined}
                                >
                                  {meta.join(" · ")}
                                </p>

                                {failing && connection.lastError && (
                                  <p className="mt-1 text-[12.5px] text-destructive">
                                    {connection.lastError}
                                  </p>
                                )}
                              </div>

                              {/*
                                Two, not four. *Re-check* is what a person opens this row
                                to do, and *Disconnect* is the other; replacing a key is
                                the same act as connecting one, and it lives with rename,
                                colour and delete on the startup's own page rather than
                                being a third control on every healthy connection.
                              */}
                              <div className="flex shrink-0 flex-wrap items-center gap-1">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-9 rounded-full px-3.5 text-[13px]"
                                  disabled={working}
                                  onClick={() => recheck(connection)}
                                >
                                  {working ? (
                                    <Loader2 className="size-4 animate-spin" />
                                  ) : (
                                    <RefreshCw className="size-4" />
                                  )}
                                  Re-check
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-9 rounded-full px-3.5 text-[13px] text-destructive hover:bg-destructive/10 hover:text-destructive"
                                  disabled={working}
                                  onClick={() => setConfirmRemove(connection)}
                                >
                                  <Trash2 className="size-4" />
                                  Disconnect
                                </Button>
                              </div>
                            </li>
                          );
                        })}
                      </ul>
                    )}

                    {/*
                      Two things you can do with the business itself: look at it, or
                      change it. *Connect another* was a third — and a confusing one
                      next to *New startup*, since both begin with a plus and only one
                      of them makes a business. Connecting a second provider is on the
                      Manage page with rename, colour and delete, where changing a
                      startup belongs.
                    */}
                    <div className="flex flex-wrap items-center gap-2 border-t border-border/60 bg-muted/30 px-5 py-3">
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-9 rounded-full bg-card px-4 text-[13px]"
                        onClick={() => look(startup)}
                        disabled={isPending}
                      >
                        <Sprout className="size-4" />
                        Open forest
                      </Button>
                      <Button
                        asChild
                        size="sm"
                        variant="ghost"
                        className="h-9 rounded-full px-4 text-[13px]"
                      >
                        <Link href={`/dashboard/startups/${startup.id}`}>
                          <Settings2 className="size-4" />
                          Manage
                        </Link>
                      </Button>
                    </div>
                  </div>
                )}
              </section>
            );
          })}
        </div>
      )}

      {/* The reassurance, once, under the keys it is about. */}
      {groups.length > 0 && (
        <p className="mt-5 text-[12.5px] leading-relaxed text-muted-foreground">
          Keys are read-only, stored encrypted, and checked the moment you paste one — so a
          connection that says connected has answered at least once. Re-check asks it again.
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
          initialProvider={dialog.provider}
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

      <AlertDialog
        open={Boolean(confirmRemove)}
        onOpenChange={(next) => !next && setConfirmRemove(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-[15px]">
              Disconnect {confirmRemove?.providerName}?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-[12.5px]">
              The stored key is deleted from {confirmRemove?.startupName || "this startup"}. It
              stays valid at {confirmRemove?.providerName} until you revoke it there — do that
              too if you are disconnecting because it leaked.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="h-9 text-[13px]">Keep it</AlertDialogCancel>
            <AlertDialogAction
              className="h-9 text-[13px]"
              onClick={() => confirmRemove && remove(confirmRemove)}
            >
              Disconnect
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
