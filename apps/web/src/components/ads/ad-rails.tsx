"use client";

import { useState } from "react";
import { Plus } from "lucide-react";

import { type AdPlacement, AdPitchDialog } from "@/components/ads/ad-pitch-dialog";
import {
  AD_SLOTS_PER_SIDE,
  FORESTS_SPOT_PRICE,
  GARDEN_SPOT_PRICE,
  type AdSpot,
} from "@/lib/ads";

/**
 * Two columns of sponsor cards hugging the viewport edges, with the app
 * between them — the Top Click arrangement. They are `fixed`, so the content
 * column stays centred exactly where it was; below 1440px they vanish rather
 * than squeeze the app, because a rail that pushes the product off-centre is
 * advertising against the thing it is advertising on.
 *
 * A filled spot is a plain card: logo, name, one line. **An empty one is a
 * door**: clicking it opens the pitch — what being pinned here buys, this
 * page's price, and the both-pages bundle — rather than dumping the visitor
 * into a mail draft with no context.
 */

function FilledSpot({ spot }: { spot: AdSpot }) {
  return (
    <a
      href={spot.href}
      target="_blank"
      rel="noopener noreferrer nofollow sponsored"
      className="flex flex-1 flex-col items-center justify-center gap-2 rounded-2xl border border-border bg-card px-4 py-5 text-center shadow-elev-1 transition-colors hover:border-primary/40"
    >
      {spot.image ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={spot.image} alt="" className="size-10 rounded-xl object-cover" />
      ) : (
        <span className="grid size-10 place-items-center rounded-xl bg-muted text-sm font-bold text-muted-foreground">
          {spot.name.charAt(0).toUpperCase()}
        </span>
      )}
      <span className="text-[13px] font-semibold leading-tight">{spot.name}</span>
      <span className="text-[11px] leading-snug text-muted-foreground">{spot.tagline}</span>
    </a>
  );
}

function OpenSpot({
  pitch,
  price,
  sold,
  onOpen,
}: {
  pitch: boolean;
  price: number;
  sold: number;
  onOpen: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className="flex flex-1 flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-border px-4 py-5 text-center transition-colors hover:border-primary/40 cursor-pointer"
    >
      <span className="grid size-7 place-items-center rounded-full border border-border text-muted-foreground">
        <Plus className="size-3.5" />
      </span>
      {pitch ? (
        <>
          <span className="text-[13px] font-semibold">Advertise</span>
          <span className="text-[11px] text-muted-foreground">
            ${price} · {AD_SLOTS_PER_SIDE * 2 - sold}/{AD_SLOTS_PER_SIDE * 2} left
          </span>
        </>
      ) : (
        <span className="text-[11px] font-medium text-muted-foreground">Available</span>
      )}
    </button>
  );
}

function Rail({
  side,
  price,
  inventory,
  onOpen,
}: {
  side: "left" | "right";
  price: number;
  inventory: AdSpot[];
  onOpen: () => void;
}) {
  const start = side === "left" ? 0 : AD_SLOTS_PER_SIDE;
  const spots = Array.from(
    { length: AD_SLOTS_PER_SIDE },
    (_, i) => inventory[start + i] ?? null,
  );

  return (
    <aside
      aria-label="Sponsors"
      className={`fixed bottom-6 top-24 z-20 hidden w-44 flex-col gap-3 min-[1440px]:flex ${
        side === "left" ? "left-5" : "right-5"
      }`}
    >
      {spots.map((spot, index) =>
        spot ? (
          <FilledSpot key={index} spot={spot} />
        ) : (
          <OpenSpot
            key={index}
            price={price}
            sold={inventory.length}
            onOpen={onOpen}
            pitch={side === "right" && index === AD_SLOTS_PER_SIDE - 1}
          />
        ),
      )}
    </aside>
  );
}

/** The Forests board's rails: $300 a spot, pitched by the dialog. */
export function AdRails({ spots }: { spots: AdSpot[] }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Rail side="left" price={FORESTS_SPOT_PRICE} inventory={spots} onOpen={() => setOpen(true)} />
      <Rail side="right" price={FORESTS_SPOT_PRICE} inventory={spots} onOpen={() => setOpen(true)} />
      <AdPitchDialog open={open} onOpenChange={setOpen} placement="forests" />
    </>
  );
}

/**
 * The same inventory as a single row — for pages whose edges are spoken for
 * but whose bottom is free, like the plot. Five spots and the pitch, compact,
 * centred; gone below 1100px where a row this wide would crowd the scene.
 * These are the premium places, and their pitch says so: $500 a spot.
 */
export function AdStrip({ spots: inventory }: { spots: AdSpot[] }) {
  const [open, setOpen] = useState(false);
  const placement: AdPlacement = "garden";
  const spots = Array.from({ length: 5 }, (_, i) => inventory[i] ?? null);
  const remaining = AD_SLOTS_PER_SIDE * 2 - inventory.length;

  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-4 z-20 hidden justify-center px-4 min-[1100px]:flex">
      <div className="pointer-events-auto flex items-stretch gap-3">
        {spots.map((spot, index) =>
          spot ? (
            <a
              key={index}
              href={spot.href}
              target="_blank"
              rel="noopener noreferrer nofollow sponsored"
              className="flex size-[150px] flex-col items-center justify-center gap-2 rounded-2xl border border-border bg-card px-3 text-center shadow-elev-1 transition-colors hover:border-primary/40"
            >
              {spot.image ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={spot.image} alt="" className="size-9 rounded-xl object-cover" />
              ) : (
                <span className="grid size-9 place-items-center rounded-xl bg-muted text-sm font-bold text-muted-foreground">
                  {spot.name.charAt(0).toUpperCase()}
                </span>
              )}
              <span className="text-[12.5px] font-semibold leading-tight">{spot.name}</span>
              <span className="text-[10.5px] leading-snug text-muted-foreground">
                {spot.tagline}
              </span>
            </a>
          ) : (
            <button
              key={index}
              type="button"
              onClick={() => setOpen(true)}
              className="flex size-[150px] flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-border bg-card/60 px-3 text-center transition-colors hover:border-primary/40 cursor-pointer"
            >
              <span className="grid size-7 place-items-center rounded-full border border-border text-muted-foreground">
                <Plus className="size-3.5" />
              </span>
              <span className="text-[12px] font-medium text-muted-foreground">Available</span>
            </button>
          ),
        )}
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="flex size-[150px] flex-col items-center justify-center gap-1.5 rounded-2xl border border-dashed border-border bg-card/60 px-3 text-center transition-colors hover:border-primary/40 cursor-pointer"
        >
          <span className="grid size-7 place-items-center rounded-full border border-border text-muted-foreground">
            <Plus className="size-3.5" />
          </span>
          <span className="text-[12.5px] font-semibold">Advertise</span>
          <span className="text-[11px] text-muted-foreground">
            ${GARDEN_SPOT_PRICE} · {remaining}/{AD_SLOTS_PER_SIDE * 2} left
          </span>
        </button>
      </div>

      <AdPitchDialog open={open} onOpenChange={setOpen} placement={placement} />
    </div>
  );
}
