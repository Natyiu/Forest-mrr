"use client";

import { useEffect, useState, useTransition } from "react";
import { ArrowRight, Loader2 } from "lucide-react";
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
import { Input } from "@/components/ui/input";
import { createStartup } from "@/lib/actions/startups";

/**
 * **Naming a business, as the first half of connecting one.**
 *
 * It is a dialog rather than the inline field it replaced for one reason: the
 * *second* half is a dialog. Making a startup and connecting the place its money
 * arrives are one errand — a startup with no provider draws an empty plot — so
 * typing a name into a bar at the top of the page and then being handed a modal
 * was one errand rendered two different ways. Now the flow is one shape: name it,
 * then say where the money comes from.
 *
 * **It asks for the name and nothing else.** A row of eight emoji stood here, on
 * the argument that a mark is what tells two businesses apart in the switcher —
 * which is true, and still not worth a decision at this moment. Most accounts have
 * one startup, where the mark distinguishes it from nothing; and the businesses
 * that do connect a provider get the provider's own logo, which *outranks* the
 * emoji everywhere `StartupMark` draws one. So the picker was a question asked of
 * everybody to serve the case where it is both needed and unanswered by the data.
 *
 * Left unset the mark is `🌱`, and it is one field on the startup's own settings
 * page for anyone who wants a different one — chosen when there is a second
 * business to tell apart, which is when the choice means something.
 */

export function NewStartupDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /**
   * Handed the new startup's id, so the caller can open the connect dialog on it.
   * The caller owns that step: this component knows how to make a business, not
   * what the page wants to do next with one.
   */
  onCreated: (startupId: string) => void;
}) {
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  // A dialog that remembers the last attempt greets the next one with it.
  useEffect(() => {
    if (!open) return;
    setName("");
    setError(null);
  }, [open]);

  function submit() {
    const trimmed = name.trim();
    if (!trimmed) {
      setError("A startup needs a name.");
      return;
    }

    startTransition(async () => {
      // No emoji: `StartupMark` draws `🌱` for a null one, and a connected
      // provider's logo outranks it anyway.
      const result = await createStartup({ name: trimmed });
      if (!result.ok) {
        setError(result.message);
        return;
      }
      toast.success(`${trimmed} created`);
      onOpenChange(false);
      // `activeId` is the startup that was just made — `createStartup` switches
      // to it, because a business you have this second made is the one you meant
      // to be looking at.
      if (typeof result.activeId === "string") onCreated(result.activeId);
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {/* Skinned on the content, not inherited — same reason as the connect dialog
          it hands off to: it is portalled, and it opens over the plot. */}
      <DialogContent className="garden-root garden-skin sm:max-w-md rounded-[24px] border-0 bg-card p-6 shadow-modal ring-1 ring-hairline">
        <DialogHeader>
          <DialogTitle className="text-[15px] font-bold tracking-tight text-ink">New startup</DialogTitle>
          <DialogDescription className="text-[12.5px] leading-relaxed text-ink-soft">
            One book of business: its own read-only keys, its own forest. Name it, then
            choose where its money arrives.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <label
              htmlFor="startup-name"
              className="text-[10.5px] font-bold uppercase tracking-[0.12em] text-ink-faint"
            >
              Name
            </label>
            <Input
              id="startup-name"
              value={name}
              onChange={(event) => {
                setName(event.target.value);
                setError(null);
              }}
              onKeyDown={(event) => {
                if (event.key === "Enter") submit();
              }}
              placeholder="Acme"
              maxLength={60}
              autoFocus
              className="h-10 rounded-xl bg-inset/60 text-[13px] focus-visible:bg-card"
            />
          </div>

          {error && <p className="text-[12.5px] text-destructive">{error}</p>}
        </div>

        <DialogFooter>
          <Button
            variant="ghost"
            size="sm"
            className="h-9 rounded-full px-4 text-[13px] font-semibold text-ink-soft hover:text-ink"
            onClick={() => onOpenChange(false)}
            disabled={isPending}
          >
            Cancel
          </Button>
          <Button
            size="sm"
            className="h-9 rounded-full px-4 text-[13px] font-bold"
            onClick={submit}
            disabled={isPending || !name.trim()}
          >
            {isPending ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                Creating…
              </>
            ) : (
              <>
                Choose provider
                <ArrowRight className="size-4" />
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
