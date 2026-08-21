/**
 * The ad rails' inventory — one list, hand-edited.
 *
 * Ten spots: the first five fill the left rail top-down, the next five the
 * right. An empty spot renders as a dashed "Available" card, and the last
 * right-hand card always carries the Advertise pitch with the live count of
 * what is left. Selling a spot is editing this file — deliberately, for now:
 * a checkout, approval queue and image uploads are a business decision, and a
 * hand-vetted list is how every rail like this starts.
 */

export interface AdSpot {
  id: string;
  name: string;
  tagline: string;
  href: string;
  /** Square logo URL (rendered 40px). Falls back to the first letter. */
  image?: string | null;
}

export const AD_SLOTS_PER_SIDE = 5;

/**
 * The rate card. The garden is the page founders live on, so its spots carry
 * the premium; the forests board is the discovery surface; and the bundle is
 * priced so that taking both is the obviously sensible thing to do — which is
 * why every pitch recommends it.
 */
export const GARDEN_SPOT_PRICE = 500;
export const FORESTS_SPOT_PRICE = 300;
export const BUNDLE_PRICE = 700;

const ADVERTISE_EMAIL = "yeabnoah5@gmail.com";

/** A mailto with the placement already named, so the reply can just say yes. */
export function advertiseHref(subject: string): string {
  return `mailto:${ADVERTISE_EMAIL}?subject=${encodeURIComponent(subject)}`;
}

export const ADVERTISE_HREF = advertiseHref("Advertise on Forest MRR");
