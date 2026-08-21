"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  BarChart3,
  Loader2,
  Plus,
  RefreshCw,
  Save,
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
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ConnectRevenueDialog } from "@/components/revenue/connect-revenue-dialog";
import { ProviderMark } from "@/components/revenue/provider-mark";
import {
  type RevenueConnectionView,
  removeRevenueConnection,
  verifyRevenueConnection,
} from "@/lib/actions/revenue";
import { deleteStartup, setStartupPublic, switchStartup, updateStartup } from "@/lib/actions/startups";
import { Switch } from "@/components/ui/switch";
import { REVENUE_PROVIDERS, type RevenueProviderId } from "@/lib/revenue/providers";
import { pageEnabled } from "@/lib/nav-features";
import { StartupMark } from "@/components/startups/startup-mark";
import { STARTUP_CATEGORIES } from "@/lib/startup-categories";
import type { StartupView } from "@/lib/startups";
import { cn } from "@/lib/utils";

/**
 * **One startup, everything about it.**
 *
 * The garden's permanent *Connect revenue* pill is gone — connecting is a
 * once-per-business act, not a control to keep above a plot you are reading — so
 * this page is where a business is set up and maintained: what it is called, which
 * providers it reads, and how to take one away or delete the whole thing.
 *
 * Three bands, in the order somebody needs them: **identity** (the label they will
 * recognise it by in the switcher), **providers** (the keys, with the same
 * re-check / replace / disconnect actions as before), and **the destructive one,
 * last and on its own** — a delete button next to a save button is a mis-click
 * waiting to happen.
 */
export function StartupSettings({
  startup,
  connections,
  isActive,
  otherStartupCount,
}: {
  startup: StartupView;
  connections: RevenueConnectionView[];
  isActive: boolean;
  otherStartupCount: number;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [busy, setBusy] = useState<string | null>(null);

  const [name, setName] = useState(startup.name);
  const [category, setCategory] = useState<string>(startup.category ?? "");
  const [website, setWebsite] = useState(startup.website ?? "");
  const [description, setDescription] = useState(startup.description ?? "");
  const [isPublic, setIsPublic] = useState(startup.isPublic);
  const [publicPending, startPublicTransition] = useTransition();

  const [dialog, setDialog] = useState<{ provider?: RevenueProviderId } | null>(null);
  const [confirmRemove, setConfirmRemove] = useState<RevenueConnectionView | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const dirty =
    name.trim() !== startup.name ||
    (category || null) !== startup.category ||
    (website.trim() || null) !== startup.website ||
    (description.trim() || null) !== startup.description;

  function save() {
    const trimmed = name.trim();
    if (!trimmed) {
      toast.error("A startup needs a name.");
      return;
    }
    startTransition(async () => {
      const result = await updateStartup({
        id: startup.id,
        name: trimmed,
        category: category || "",
        website: website.trim(),
        description: description.trim(),
      });
      if (!result.ok) {
        toast.error(result.message);
        return;
      }
      toast.success("Saved");
      router.refresh();
    });
  }

  function recheck(connection: RevenueConnectionView) {
    setBusy(connection.id);
    startTransition(async () => {
      const result = await verifyRevenueConnection({
        provider: connection.provider,
        startupId: startup.id,
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

  function disconnect(connection: RevenueConnectionView) {
    setBusy(connection.id);
    startTransition(async () => {
      const result = await removeRevenueConnection({
        provider: connection.provider,
        startupId: startup.id,
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

  function destroy() {
    startTransition(async () => {
      const result = await deleteStartup({ id: startup.id });
      setConfirmDelete(false);
      if (!result.ok) {
        toast.error(result.message);
        return;
      }
      toast.success(`${startup.name} deleted`);
      router.push("/dashboard/startups");
    });
  }

  function openForest() {
    startTransition(async () => {
      await switchStartup({ id: startup.id });
      router.push("/dashboard");
    });
  }

  return (
    <div className="max-w-3xl space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link
            href="/dashboard/startups"
            className="mb-1 inline-flex items-center gap-1 text-[11px] text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="size-3" />
            All startups
          </Link>
          <h2 className="flex items-center gap-2 text-sm font-semibold">
            <StartupMark
              image={startup.image}
              emoji={startup.emoji}
              name={startup.name}
              className="size-6 rounded-lg"
              emojiClassName="bg-transparent text-base"
            />
            {startup.name}
            {isActive && <Badge variant="success">looking at this</Badge>}
          </h2>
          <p className="mt-0.5 text-[11px] text-muted-foreground">
            {connections.length === 0
              ? "Nothing connected — its forest is unplanted."
              : `${connections.length} provider${connections.length === 1 ? "" : "s"} connected.`}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            className="h-8 text-xs"
            onClick={openForest}
            disabled={isPending}
          >
            <Sprout className="size-3.5" />
            Open its forest
          </Button>
          {connections.length > 0 && pageEnabled("graphs") && (
            <Button asChild size="sm" variant="outline" className="h-8 text-xs">
              <Link href="/dashboard/graph">
                <BarChart3 className="size-3.5" />
                Graphs
              </Link>
            </Button>
          )}
        </div>
      </div>

      {/* --- identity ------------------------------------------------------ */}
      <section className="rounded-xl border border-border bg-card p-4 shadow-elev-1">
        <h3 className="text-xs font-semibold">Name and mark</h3>
        <p className="mt-0.5 text-[11px] text-muted-foreground">
          The mark arrives from your payment provider — connect one that publishes a
          logo and it appears here and everywhere this business is listed.
        </p>

        <div className="mt-3 flex flex-wrap items-end gap-3">
          <StartupMark
            image={startup.image}
            emoji={startup.emoji}
            name={startup.name}
            className="size-11 shrink-0 rounded-2xl"
            emojiClassName="text-xl"
          />

          <div className="min-w-[12rem] flex-1">
            <label className="mb-1.5 block text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60">
              Name
            </label>
            <Input
              value={name}
              onChange={(event) => setName(event.target.value)}
              onKeyDown={(event) => event.key === "Enter" && save()}
              maxLength={60}
              className="h-9 text-xs"
            />
          </div>
        </div>

        <div className="mt-3 flex flex-wrap gap-3">
          <div className="min-w-[14rem] flex-1">
            <label className="mb-1.5 block text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60">
              Website
            </label>
            <Input
              value={website}
              onChange={(event) => setWebsite(event.target.value)}
              placeholder="yourstartup.com"
              maxLength={200}
              className="h-9 text-xs"
            />
          </div>
        </div>

        <div className="mt-3">
          <label className="mb-1.5 block text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60">
            What it is
          </label>
          <Input
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            placeholder="One sentence on what this business does."
            maxLength={160}
            className="h-9 text-xs"
          />
          <p className="mt-1 text-[10px] text-muted-foreground">
            Shown with the website wherever this forest is listed in the open.
          </p>
        </div>

        <div className="mt-3">
          <label className="mb-1.5 block text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60">
            Category
          </label>
          <p className="mb-1.5 text-[11px] text-muted-foreground">
            Which shelf this forest stands on when the public board ranks by category.
          </p>
          <div className="flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              onClick={() => setCategory("")}
              aria-pressed={category === ""}
              className={cn(
                "rounded-4xl border px-2 py-1 text-[10px] font-medium transition-colors",
                category === "" ? "border-primary/50 text-foreground" : "border-border text-muted-foreground",
              )}
            >
              None
            </button>
            {STARTUP_CATEGORIES.map((candidate) => (
              <button
                key={candidate.value}
                type="button"
                onClick={() => setCategory(candidate.value)}
                aria-pressed={category === candidate.value}
                className={cn(
                  "rounded-4xl border px-2 py-1 text-[10px] font-medium transition-colors",
                  category === candidate.value
                    ? "border-primary/50 bg-primary/10 text-foreground"
                    : "border-border text-muted-foreground hover:text-foreground",
                )}
              >
                {candidate.label}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-4 flex items-center gap-2">
          <Button size="sm" className="h-8 text-xs" onClick={save} disabled={isPending || !dirty}>
            {isPending ? <Loader2 className="size-3 animate-spin" /> : <Save className="size-3" />}
            Save changes
          </Button>
          {dirty && <span className="text-[11px] text-muted-foreground">Unsaved</span>}
        </div>
      </section>

      {/* --- providers ----------------------------------------------------- */}
      <section className="rounded-xl border border-border bg-card shadow-elev-1">
        <header className="flex flex-wrap items-center justify-between gap-2 border-b border-border/60 px-4 py-3">
          <div>
            <h3 className="text-xs font-semibold">Connected providers</h3>
            <p className="mt-0.5 text-[11px] text-muted-foreground">
              Read-only keys, stored encrypted. This startup&rsquo;s only.
            </p>
          </div>
          <Button size="sm" className="h-8 text-xs" onClick={() => setDialog({})}>
            <Plus className="size-3.5" />
            Connect provider
          </Button>
        </header>

        {connections.length === 0 ? (
          <p className="px-4 py-5 text-[11px] text-muted-foreground">
            Nothing yet. Connect Stripe, Polar, LemonSqueezy, DodoPayment, RevenueCat or
            Superwall and every subscription becomes a tree.
          </p>
        ) : (
          <ul className="divide-y divide-border/60">
            {connections.map((connection) => {
              const provider = REVENUE_PROVIDERS[connection.provider];
              const working = isPending && busy === connection.id;

              return (
                <li key={connection.id} className="flex flex-wrap items-center gap-3 p-4">
                  <ProviderMark provider={provider} />

                  <div className="min-w-[12rem] flex-1">
                    <div className="flex items-center gap-2">
                      <p className="text-xs font-semibold">{provider.name}</p>
                      <Badge
                        variant={connection.status === "connected" ? "success" : "destructive"}
                      >
                        {connection.status === "connected" ? "Connected" : "Needs attention"}
                      </Badge>
                    </div>
                    <p className="mt-0.5 text-[11px] text-muted-foreground">
                      {connection.accountLabel ?? "Account name unavailable"} · key ending{" "}
                      <span className="font-mono">{connection.secretHint}</span>
                      {connection.lastVerifiedAt
                        ? ` · checked ${connection.lastVerifiedAt.slice(0, 10)}`
                        : ""}
                    </p>
                    {connection.reference && (
                      <p className="font-mono text-[11px] text-muted-foreground/70">
                        {connection.reference}
                      </p>
                    )}
                    {connection.status === "error" && connection.lastError && (
                      <p className="mt-1 text-[11px] text-destructive">{connection.lastError}</p>
                    )}
                  </div>

                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 text-xs"
                      disabled={working}
                      onClick={() => recheck(connection)}
                    >
                      {working ? (
                        <Loader2 className="size-3 animate-spin" />
                      ) : (
                        <RefreshCw className="size-3" />
                      )}
                      Re-check
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 text-xs"
                      onClick={() => setDialog({ provider: connection.provider })}
                    >
                      Replace key
                    </Button>
                    <Button
                      variant="destructive"
                      size="sm"
                      className="h-7 text-xs"
                      disabled={working}
                      onClick={() => setConfirmRemove(connection)}
                    >
                      Disconnect
                    </Button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {/* --- the public board -------------------------------------------- */}
      <section className="rounded-xl border border-border bg-card p-4 shadow-elev-1">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 className="text-xs font-semibold">Public forest</h3>
            <p className="mt-0.5 max-w-prose text-[11px] text-muted-foreground">
              List {startup.name} on the Forests board, where anyone signed in can see
              its name, its mark, its MRR and how many trees stand on its plot — and
              compare their own against it. Nothing else is shown: no customers, no
              plans, no providers. Off, and this forest is yours alone.
            </p>
          </div>
          <Switch
            checked={isPublic}
            disabled={publicPending}
            aria-label="List this forest on the public board"
            onCheckedChange={(next) => {
              setIsPublic(next);
              startPublicTransition(async () => {
                const result = await setStartupPublic({ id: startup.id, isPublic: next });
                if (!result.ok) {
                  setIsPublic(!next);
                  toast.error(result.message);
                } else {
                  toast.success(
                    next
                      ? `${startup.name} is on the public board.`
                      : `${startup.name} is private again.`,
                  );
                  router.refresh();
                }
              });
            }}
          />
        </div>
      </section>

      {/* --- the destructive one, last and alone --------------------------- */}
      <section className="rounded-xl border border-destructive/30 bg-destructive/5 p-4">
        <h3 className="text-xs font-semibold text-destructive">Delete this startup</h3>
        <p className="mt-0.5 max-w-prose text-[11px] text-muted-foreground">
          Its {connections.length === 0 ? "settings" : `${connections.length} stored key${connections.length === 1 ? "" : "s"}`}{" "}
          go with it. Your other {otherStartupCount === 1 ? "startup" : "startups"} are
          untouched, and any key stays valid at the provider until you revoke it there.
        </p>
        <Button
          size="sm"
          variant="destructive"
          className="mt-3 h-8 text-xs"
          onClick={() => setConfirmDelete(true)}
        >
          <Trash2 className="size-3.5" />
          Delete {startup.name}
        </Button>
      </section>

      {dialog && (
        <ConnectRevenueDialog
          open
          onOpenChange={(open) => !open && setDialog(null)}
          startupId={startup.id}
          initialProvider={dialog.provider}
          connections={connections}
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
            <AlertDialogTitle className="text-sm">
              Disconnect {confirmRemove?.providerName} from {startup.name}?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-[11px]">
              The stored key is deleted here. It stays valid at {confirmRemove?.providerName}{" "}
              until you revoke it there — do that too if you are disconnecting because it
              leaked.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="h-8 text-xs">Keep it</AlertDialogCancel>
            <AlertDialogAction
              className="h-8 text-xs"
              onClick={() => confirmRemove && disconnect(confirmRemove)}
            >
              Disconnect
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-sm">Delete {startup.name}?</AlertDialogTitle>
            <AlertDialogDescription className="text-[11px]">
              {connections.length > 0
                ? `Its ${connections.length} connected provider${connections.length === 1 ? "" : "s"} go with it — the stored keys are deleted here and stay valid at the provider until revoked there.`
                : "Nothing is connected to it, so nothing else is lost."}{" "}
              This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="h-8 text-xs">Keep it</AlertDialogCancel>
            <AlertDialogAction className="h-8 text-xs" onClick={destroy}>
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
