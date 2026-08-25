"use client";

import { useState, useTransition } from "react";
import { ArrowLeft, Loader2, Megaphone, MousePointerClick, Users } from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createAdCheckout } from "@/lib/actions/ads";
import {
  BUNDLE_PRICE,
  FORESTS_SPOT_PRICE,
  GARDEN_SPOT_PRICE,
} from "@/lib/ads";

/**
 * The pitch behind every empty ad box, in two steps.
 *
 * **Step one sells the spot**: what being pinned here buys, this page's price,
 * and — always, at the bottom — the recommendation to take both pages for the
 * bundle price. **Step two takes the order**: company name, one line on what
 * it does, and the website the box will link to. Pay hands those three fields
 * to Polar as checkout metadata and redirects to the payment page, so the
 * order that lands carries everything needed to fill the spot.
 */

const PLACEMENTS = {
  garden: {
    price: GARDEN_SPOT_PRICE,
    where: "the My forest page",
    reach: "the dashboard founders open every day to look at their revenue",
  },
  forests: {
    price: FORESTS_SPOT_PRICE,
    where: "the Leaderboard",
    reach: "the public leaderboard where founders browse and compare startups",
  },
} as const;

export type AdPlacement = keyof typeof PLACEMENTS;

type Kind = AdPlacement | "bundle";

const KIND_LABELS: Record<Kind, { price: number; label: string }> = {
  garden: { price: GARDEN_SPOT_PRICE, label: "one spot on the My forest page" },
  forests: { price: FORESTS_SPOT_PRICE, label: "one spot on the Leaderboard" },
  bundle: { price: BUNDLE_PRICE, label: "spots on both pages" },
};

export function AdPitchDialog({
  open,
  onOpenChange,
  placement,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  placement: AdPlacement;
}) {
  const spot = PLACEMENTS[placement];

  const [kind, setKind] = useState<Kind | null>(null);
  const [company, setCompany] = useState("");
  const [tagline, setTagline] = useState("");
  const [website, setWebsite] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  // Sticky: once we have the checkout URL and start navigating away, the button
  // must stay in its loading state until the page unloads. `isPending` flips
  // back to false the instant the action returns — a beat before the browser
  // actually leaves — which flashed the button back to "Pay $X" for a second.
  const [redirecting, setRedirecting] = useState(false);

  const close = (next: boolean) => {
    onOpenChange(next);
    if (!next) {
      setKind(null);
      setError(null);
      setRedirecting(false);
    }
  };

  const pay = () => {
    if (!kind) return;
    if (!company.trim() || !tagline.trim() || !website.trim()) {
      setError("Please fill in every field.");
      return;
    }
    setError(null);
    startTransition(async () => {
      // Any rejection here — a dropped connection, a thrown action — must show
      // in the dialog, never bubble up to Next's error page.
      try {
        const result = await createAdCheckout({
          placement: kind,
          company: company.trim(),
          tagline: tagline.trim(),
          website: website.trim(),
        });
        if (result.ok) {
          setRedirecting(true);
          window.location.href = result.url;
        } else {
          setError(result.message);
        }
      } catch {
        setError("Something went wrong opening checkout. Please try again.");
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent className="max-w-md">
        {kind === null ? (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-base">
                <Megaphone className="size-4 text-primary" />
                Pin your product here
              </DialogTitle>
              <DialogDescription className="text-[13px] leading-relaxed">
                This box is yours: your logo, your name, one line on what you do —
                pinned on {spot.where}, linking straight to your site.
              </DialogDescription>
            </DialogHeader>

            <ul className="space-y-2.5 text-[13px] text-muted-foreground">
              <li className="flex items-start gap-2.5">
                <Users className="mt-0.5 size-4 shrink-0 text-primary" />
                <span>Seen by exactly the right crowd — {spot.reach}.</span>
              </li>
              <li className="flex items-start gap-2.5">
                <MousePointerClick className="mt-0.5 size-4 shrink-0 text-primary" />
                <span>
                  Every click is a founder landing on your site already curious —
                  leads, not impressions.
                </span>
              </li>
            </ul>

            <Button
              className="h-11 w-full rounded-full text-sm font-semibold"
              onClick={() => setKind(placement)}
            >
              Pay ${spot.price} — take this spot
            </Button>

            {/* The recommendation, always, at the bottom: both pages beat either. */}
            <button
              type="button"
              onClick={() => setKind("bundle")}
              className="block w-full rounded-2xl border border-primary/30 bg-primary/5 px-4 py-3 text-center transition-colors hover:border-primary/50 cursor-pointer"
            >
              <span className="block text-[12.5px] font-semibold">
                Recommended: take both pages for ${BUNDLE_PRICE}
              </span>
              <span className="mt-0.5 block text-[11.5px] text-muted-foreground">
                The My forest and Leaderboard pages together — $
                {GARDEN_SPOT_PRICE + FORESTS_SPOT_PRICE} worth of placement, $
                {GARDEN_SPOT_PRICE + FORESTS_SPOT_PRICE - BUNDLE_PRICE} off.
              </span>
            </button>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle className="text-base">Your ad, in three lines</DialogTitle>
              <DialogDescription className="text-[13px]">
                ${KIND_LABELS[kind].price} · {KIND_LABELS[kind].label}. This is
                exactly what the box will show.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-3">
              <div>
                <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Company name
                </label>
                <Input
                  value={company}
                  onChange={(event) => setCompany(event.target.value)}
                  placeholder="Acme"
                  maxLength={60}
                  className="h-10"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  What it does
                </label>
                <Input
                  value={tagline}
                  onChange={(event) => setTagline(event.target.value)}
                  placeholder="One line on what you do."
                  maxLength={120}
                  className="h-10"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Website
                </label>
                <Input
                  value={website}
                  onChange={(event) => setWebsite(event.target.value)}
                  placeholder="acme.com"
                  maxLength={200}
                  className="h-10"
                />
              </div>
            </div>

            {error && <p className="text-[12.5px] text-destructive">{error}</p>}

            <Button
              className="h-11 w-full rounded-full text-sm font-semibold"
              onClick={pay}
              disabled={isPending || redirecting}
            >
              {isPending || redirecting ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  Opening checkout…
                </>
              ) : (
                <>Pay ${KIND_LABELS[kind].price}</>
              )}
            </Button>

            <button
              type="button"
              onClick={() => setKind(null)}
              className="mx-auto flex items-center gap-1 text-[12px] text-muted-foreground transition-colors hover:text-foreground cursor-pointer"
            >
              <ArrowLeft className="size-3" />
              Back
            </button>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
