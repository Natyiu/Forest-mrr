import type { Marker } from 'cobe';
import { type Plant } from '../types';
import { largestPlan, planPosition, sampleRamp } from './plans';

/**
 * The book of business as COBE markers.
 *
 * One marker per subscription, at the customer's own coordinates, sized by
 * where its plan sits on the ladder and coloured in the same three the plot and
 * the sidebars already use: amber for a failing payment, emerald for the top
 * plan, blue for everyone else. It lives here rather than inline in a view
 * because two globes draw it — the panel and the Earth view — and a dot that
 * means "past due" on one and "top plan" on the other would be worse than no
 * colour at all.
 */

const PAST_DUE: [number, number, number] = [245 / 255, 158 / 255, 11 / 255];
const TOP_PLAN: [number, number, number] = [16 / 255, 185 / 255, 129 / 255];
const EVERYONE_ELSE: [number, number, number] = [59 / 255, 130 / 255, 246 / 255];

/** Fallback coordinates: the middle of the United States, as the data does. */
const UNPLACED: [number, number] = [37.09, -95.71];

/** Dot radius up the ladder, cheapest first. Sampled, so any length works. */
const SIZE_RAMP = [0.022, 0.03, 0.04, 0.055];

export function subscriptionMarkers(plants: Plant[]): Marker[] {
  // Resolved once per call rather than per marker: this runs over the whole
  // book every time a filter changes.
  const top = largestPlan();
  return plants.map((plant) => ({
    location:
      plant.lat != null && plant.lng != null
        ? ([plant.lat, plant.lng] as [number, number])
        : UNPLACED,
    size: sampleRamp(SIZE_RAMP, planPosition(plant.plan)),
    color:
      plant.status === 'past_due'
        ? PAST_DUE
        : plant.plan === top
        ? TOP_PLAN
        : EVERYONE_ELSE,
  }));
}
