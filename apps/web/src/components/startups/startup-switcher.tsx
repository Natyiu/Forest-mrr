"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, ChevronsUpDown, Layers, Loader2, Plus } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { createStartup, switchStartup } from "@/lib/actions/startups";
import { StartupMark } from "@/components/startups/startup-mark";
import type { StartupView } from "@/lib/startups";
import { cn } from "@/lib/utils";

/**
 * **Which business am I looking at.**
 *
 * One control, on every page that shows revenue. Switching is a server action
 * rather than a link because the active startup lives in a cookie — the garden
 * already mirrors its whole view into the query string, and a startup is not part
 * of *that* view, it is which book those filters apply to. A `?startup=` would put
 * somebody else's id in every shared link and change business on a back button.
 *
 * **`All startups` is a first-class row, not a checkbox.** Somebody running three
 * things wants both readings — each on its own, and the three of them as one plot —
 * and the second is not a filter applied to the first.
 */
export function StartupSwitcher({
  startups,
  activeId,
  className,
}: {
  startups: StartupView[];
  activeId: string | "all" | null;
  className?: string;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [emoji, setEmoji] = useState("");

  const active = startups.find((startup) => startup.id === activeId) ?? null;
  const isAll = activeId === "all";

  const label = isAll
    ? "All startups"
    : (active?.name ?? (startups.length ? startups[0].name : "No startup yet"));

  function choose(id: string) {
    startTransition(async () => {
      const result = await switchStartup({ id });
      if (!result.ok) {
        toast.error(result.message);
        return;
      }
      // The pages were rendered for the old scope; every one of them re-reads.
      router.refresh();
    });
  }

  function create() {
    const trimmed = name.trim();
    if (!trimmed) return;

    startTransition(async () => {
      const result = await createStartup({ name: trimmed, emoji: emoji.trim() || undefined });
      if (!result.ok) {
        toast.error(result.message);
        return;
      }
      setCreating(false);
      setName("");
      setEmoji("");
      toast.success(`${trimmed} created`, {
        description: "Connect a provider to plant it.",
      });
      router.refresh();
    });
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <button
              className={cn(
                "flex h-8 items-center gap-1.5 rounded-4xl border border-border bg-card px-2.5 text-xs font-medium shadow-elev-1 transition-colors hover:bg-muted",
                className,
              )}
            >
              {isPending ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : isAll ? (
                <Layers className="size-3.5" />
              ) : (
                <StartupMark
                  image={active?.image}
                  emoji={active?.emoji}
                  name={active?.name ?? "Startup"}
                  className="size-5 rounded-md"
                  emojiClassName="bg-transparent text-sm"
                />
              )}
              <span className="max-w-[14ch] truncate">{label}</span>
              <ChevronsUpDown className="size-3 text-muted-foreground" />
            </button>
          }
        />

        <DropdownMenuContent align="start" className="w-60">
          <DropdownMenuLabel className="text-[10px] font-semibold uppercase tracking-wider">
            Your startups
          </DropdownMenuLabel>

          {startups.map((startup) => (
            <DropdownMenuItem
              key={startup.id}
              onClick={() => choose(startup.id)}
              className="text-xs"
            >
              <StartupMark
                image={startup.image}
                emoji={startup.emoji}
                name={startup.name}
                className="size-5 rounded-md"
                emojiClassName="bg-transparent text-sm"
              />
              <span className="flex-1 truncate">{startup.name}</span>
              <span className="text-[10px] text-muted-foreground">
                {startup.connections === 0
                  ? "nothing connected"
                  : `${startup.connections} connected`}
              </span>
              {startup.id === activeId && <Check className="size-3.5" />}
            </DropdownMenuItem>
          ))}

          {startups.length > 1 && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => choose("all")} className="text-xs">
                <Layers className="size-3.5" />
                <span className="flex-1">All startups</span>
                {isAll && <Check className="size-3.5" />}
              </DropdownMenuItem>
            </>
          )}

          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => setCreating(true)} className="text-xs">
            <Plus className="size-3.5" />
            New startup
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={creating} onOpenChange={setCreating}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-sm">New startup</DialogTitle>
            <DialogDescription className="text-[11px]">
              A separate book: its own connected providers, its own forest, its own
              graphs. Nothing is shared with your other startups.
            </DialogDescription>
          </DialogHeader>

          <div className="flex items-end gap-2">
            <div className="w-16">
              <label className="mb-1.5 block text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60">
                Emoji
              </label>
              <Input
                value={emoji}
                onChange={(event) => setEmoji(event.target.value)}
                placeholder="🌱"
                maxLength={4}
                className="h-9 text-center text-sm"
              />
            </div>
            <div className="flex-1">
              <label className="mb-1.5 block text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60">
                Name
              </label>
              <Input
                value={name}
                onChange={(event) => setName(event.target.value)}
                onKeyDown={(event) => event.key === "Enter" && create()}
                placeholder="Acme Technologies"
                maxLength={60}
                className="h-9 text-xs"
                autoFocus
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="ghost"
              size="sm"
              className="h-8 text-xs"
              onClick={() => setCreating(false)}
              disabled={isPending}
            >
              Cancel
            </Button>
            <Button
              size="sm"
              className="h-8 text-xs"
              onClick={create}
              disabled={isPending || !name.trim()}
            >
              {isPending ? <Loader2 className="size-3 animate-spin" /> : <Plus className="size-3" />}
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
