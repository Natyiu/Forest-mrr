import * as React from "react";

import { cn } from "@/lib/utils";

/**
 * A glyph on a coloured, rounded-square tile.
 *
 * The shape that carries most of the colour in this style: a saturated fill, a
 * white glyph, and a radius around a third of the side — enough to be soft,
 * short of a circle, which is what keeps a row of them reading as a grid rather
 * than as a row of buttons.
 *
 * The palette is **decorative and categorical**. Nothing about a tone encodes a
 * value, so a reader is never invited to decode one; `tone` exists so that a
 * list of unrelated things gets a set of unrelated colours instead of eight
 * identical grey squares. Anything that *does* mean something — worked, failed,
 * needs attention — belongs on a `Badge` with a status variant instead.
 */

const TONES = {
  violet: "bg-pop-violet",
  blue: "bg-pop-blue",
  teal: "bg-pop-teal",
  green: "bg-pop-green",
  lime: "bg-pop-lime",
  yellow: "bg-pop-yellow",
  orange: "bg-pop-orange",
  coral: "bg-pop-coral",
  pink: "bg-pop-pink",
} as const;

export type IconTileTone = keyof typeof TONES;

/** Ordered so neighbours in a list never land on adjacent hues. */
export const TILE_TONES = Object.keys(TONES) as IconTileTone[];

/** Stable per key, so a thing keeps its colour between renders and reloads. */
export function toneFor(key: string): IconTileTone {
  let hash = 0;
  for (let i = 0; i < key.length; i++) hash = (hash * 31 + key.charCodeAt(i)) >>> 0;
  return TILE_TONES[hash % TILE_TONES.length];
}

const SIZES = {
  sm: "size-8 rounded-[10px] [&>svg]:size-4",
  default: "size-10 rounded-xl [&>svg]:size-5",
  lg: "size-12 rounded-[15px] [&>svg]:size-6",
} as const;

export function IconTile({
  tone = "violet",
  size = "default",
  className,
  ...props
}: React.ComponentProps<"span"> & {
  tone?: IconTileTone;
  size?: keyof typeof SIZES;
}) {
  return (
    <span
      data-slot="icon-tile"
      className={cn(
        "inline-grid shrink-0 place-items-center text-white shadow-elev-1 [&>svg]:shrink-0",
        TONES[tone],
        SIZES[size],
        className,
      )}
      {...props}
    />
  );
}
