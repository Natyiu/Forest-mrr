"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, ChevronDown, Layers, Loader2, Plus, Sprout } from "lucide-react";
import { toast } from "sonner";

import { NewStartupDialog } from "@/components/startups/new-startup-dialog";
import { Popover, cx } from "@/garden/components/hud/ui";
import { getStartups, switchStartup } from "@/lib/actions/startups";
import type { StartupView } from "@/lib/startups";

/**
 * The startup switcher, inside the plot.
 *
 * Built from the garden's own HUD primitives rather than shadcn, for the reason
 * `garden-account.tsx` is: the two style systems answer to different theme owners —
 * shadcn follows `next-themes`, the garden follows its own mode-and-season — so a
 * shadcn popover opening over a winter-midnight plot is a white card on a black
 * field. Borrowing `Popover` means this menu is lit by whatever season the plot is
 * in.
 *
 * It is loaded on **open**, not on mount: the plot does not need to know how many
 * businesses you have in order to draw one, and this is the only thing on the route
 * that would query for them.
 */
export function GardenStartup({
  initialName,
  initialEmoji,
  initialImage,
  isAll,
}: {
  initialName: string | null;
  initialEmoji: string | null;
  /** The logo imported from a connected provider, if it publishes one. */
  initialImage: string | null;
  isAll: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [startups, setStartups] = useState<StartupView[]>([]);
  const [activeId, setActiveId] = useState<string | "all" | null>(isAll ? "all" : null);
  // A logo that fails to load falls back to the emoji rather than to the
  // browser's broken-image glyph: Polar answers with a `logo.dev` URL carrying
  // `fallback=404` for organizations that never uploaded one.
  const [brokenImages, setBrokenImages] = useState<Record<string, boolean>>({});
  const [creating, setCreating] = useState(false);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    if (!open) return;
    void getStartups()
      .then(({ startups: list, activeId: id }) => {
        setStartups(list);
        setActiveId(id);
      })
      .catch(() => setStartups([]));
  }, [open]);

  const label = isAll ? "All startups" : (initialName ?? "No startup yet");

  function choose(id: string) {
    startTransition(async () => {
      const result = await switchStartup({ id });
      if (!result.ok) {
        toast.error(result.message);
        return;
      }
      setOpen(false);
      // The plot re-fetches its book on mount, so switching business is a
      // remount rather than a patch — the ladder, the timeline and the weather
      // all belong to the book being left behind.
      router.refresh();
      window.location.assign("/dashboard");
    });
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-haspopup="menu"
        aria-expanded={open}
        title="Switch startup"
        className={cx(
          "flex h-9 items-center gap-1.5 rounded-full px-3 text-[13px] font-semibold transition-colors cursor-pointer",
          open ? "bg-inset text-ink" : "text-ink-soft hover:bg-inset hover:text-ink",
        )}
      >
        {isPending ? (
          <Loader2 className="h-[15px] w-[15px] animate-spin" />
        ) : isAll ? (
          <Layers className="h-[15px] w-[15px]" />
        ) : initialImage && !brokenImages.active ? (
          /*
            The business's own logo, imported from its payment provider. A plain
            `<img>` rather than `next/image`: the host is whichever CDN Polar or
            LemonSqueezy is using this year, and an allow-list in `next.config`
            that has to be edited when one of them moves is a broken avatar on
            somebody's dashboard in exchange for optimising a 15px square.
          */
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={initialImage}
            alt=""
            aria-hidden
            onError={() => setBrokenImages((current) => ({ ...current, active: true }))}
            className="h-[17px] w-[17px] shrink-0 rounded-[5px] object-cover"
          />
        ) : (
          <span className="text-[15px] leading-none">{initialEmoji ?? "🌱"}</span>
        )}
        <span className="max-w-[16ch] truncate">{label}</span>

        {/*
          The one thing that says this is a menu.
          Without it the pill reads as a label — the name of the business you are
          looking at — and nobody clicks a label. It is also where "you can have more
          than one of these" is announced: the chevron is the only hint on the plot
          that a second startup is possible at all.
        */}
        <ChevronDown
          className={cx(
            "h-[13px] w-[13px] shrink-0 text-ink-faint transition-transform",
            open && "rotate-180"
          )}
        />
      </button>

      <Popover open={open} onClose={() => setOpen(false)} className="left-0 top-12 w-[248px] p-2">
        <p className="px-2 pb-1.5 pt-1 text-[10px] font-bold uppercase tracking-[0.12em] text-ink-faint">
          Your startups
        </p>

        {startups.length === 0 && (
          <p className="px-2 py-1.5 text-[12px] text-ink-faint">Loading…</p>
        )}

        {startups.map((startup) => (
          <button
            key={startup.id}
            type="button"
            onClick={() => choose(startup.id)}
            className="flex w-full items-center gap-2 rounded-xl px-2 py-1.5 text-left text-[13px] font-medium text-ink-soft transition-colors hover:bg-inset hover:text-ink cursor-pointer"
          >
            {startup.image && !brokenImages[startup.id] ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={startup.image}
                alt=""
                aria-hidden
                onError={() =>
                  setBrokenImages((current) => ({ ...current, [startup.id]: true }))
                }
                className="h-[17px] w-[17px] shrink-0 rounded-[5px] object-cover"
              />
            ) : (
              <span className="text-[15px] leading-none">{startup.emoji ?? "🌱"}</span>
            )}
            <span className="flex-1 truncate">{startup.name}</span>
            <span className="text-[10px] text-ink-faint">
              {startup.connections === 0 ? "—" : startup.connections}
            </span>
            {startup.id === activeId && <Check className="h-[14px] w-[14px] text-garden-soft" />}
          </button>
        ))}

        {startups.length > 1 && (
          <>
            <div className="my-1 h-px bg-hairline" />
            <button
              type="button"
              onClick={() => choose("all")}
              className="flex w-full items-center gap-2 rounded-xl px-2 py-1.5 text-left text-[13px] font-medium text-ink-soft transition-colors hover:bg-inset hover:text-ink cursor-pointer"
            >
              <Layers className="h-[15px] w-[15px]" />
              <span className="flex-1">All startups</span>
              {activeId === "all" && <Check className="h-[14px] w-[14px] text-garden-soft" />}
            </button>
          </>
        )}

        <div className="my-1 h-px bg-hairline" />

        {/*
          It opens the dialog rather than growing a text field in the menu.

          A row that turns into an input is a menu changing shape under the
          cursor, and the field it grew asked for the *name* only — so making a
          business here and making one on `/dashboard/startups` were the same
          errand rendered two different ways, one of which could not offer the
          mark that tells two of them apart in this very list. Both are the
          dialog now. Closing the menu first is deliberate: the popover would
          otherwise sit behind the modal with nothing to do.
        */}
        <button
          type="button"
          onClick={() => {
            setOpen(false);
            setCreating(true);
          }}
          className="flex w-full items-center gap-2 rounded-xl px-2 py-1.5 text-left text-[13px] font-medium text-ink-soft transition-colors hover:bg-inset hover:text-ink cursor-pointer"
        >
          <Plus className="h-[15px] w-[15px]" />
          New startup
        </button>

        <div className="my-1 h-px bg-hairline" />

        <p className="flex items-start gap-1.5 px-2 pb-1 pt-0.5 text-[10px] leading-snug text-ink-faint">
          <Sprout className="mt-px h-3 w-3 shrink-0" />
          Each startup keeps its own providers, forest and graphs.
        </p>
      </Popover>

      {/*
        The host app's dialog, opened from the plot — the same exception
        `FeedbackDialog` is, and for the same reasons: a form, opened rarely, and
        already written. `createStartup` switches to the new business, so the
        reload lands on it; its plot is empty, and an empty plot's whole job is
        to offer the connect dialog. That is the second half of the errand.
      */}
      <NewStartupDialog
        open={creating}
        onOpenChange={setCreating}
        onCreated={() => window.location.assign("/dashboard")}
      />
    </div>
  );
}
