"use client";

import { useState } from "react";

import { cn } from "@/lib/utils";

/**
 * **What a startup looks like: its provider's logo, or the emoji it was given.**
 *
 * One component because there are four switchers and lists that draw this, and a
 * business that is a Polar avatar in one of them and a seedling in another reads
 * as two businesses.
 *
 * The image is **imported, never uploaded** — see `RevenueConnection.accountImage`.
 * A company selling through Polar or LemonSqueezy has already given its payment
 * provider a logo, and asking for it again is asking somebody to do a job that is
 * done. Three of the six publish nothing a read-only key can fetch, so the emoji
 * is not a placeholder waiting to be replaced: for those it is the answer.
 *
 * `<img>` rather than `next/image` on purpose: the host is whichever CDN a payment
 * provider happens to use, and an allow-list of remote patterns in `next.config`
 * would need editing every time one of them moved — a broken logo on somebody's
 * dashboard is not worth the optimisation on a 36px square.
 *
 * **A URL is not a picture.** Polar hands back a `logo.dev` address with
 * `fallback=404` on it for organizations that never uploaded one, so the honest
 * answer to a failed load is the emoji, not the browser's broken-image glyph. That
 * is the whole reason this is a client component.
 */
export function StartupMark({
  image,
  emoji,
  name,
  className,
  emojiClassName,
}: {
  image?: string | null;
  emoji?: string | null;
  /** Only ever alt text: the name is always beside this on screen. */
  name: string;
  className?: string;
  emojiClassName?: string;
}) {
  const [broken, setBroken] = useState(false);

  if (image && !broken) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={image}
        alt=""
        aria-hidden
        title={name}
        loading="lazy"
        onError={() => setBroken(true)}
        className={cn("shrink-0 rounded-xl object-cover", className)}
      />
    );
  }

  return (
    <span
      aria-hidden
      className={cn(
        "grid shrink-0 place-items-center rounded-xl bg-muted leading-none",
        className,
        emojiClassName,
      )}
    >
      {emoji ?? "🌱"}
    </span>
  );
}
