import { GrowthStage, HealthState, PlanTier, Plant, SpeciesFamily } from '../types';
import { planBaseMrr, planPosition, rampIndex, tierOfPlan } from './plans';

/**
 * Average revenue per long-tail subscription. The meadow is drawn as one mass
 * rather than as individual plants, but it is real revenue and has to price
 * consistently everywhere it is counted.
 */
export const MEADOW_ARPA = 18;

/**
 * A plan's rung on the ladder.
 *
 * Was a `Record<PlanTier, 0|1|2|3>` keyed by the four literal plan names. It
 * is a lookup against the catalogue now, so it is a call rather than an index
 * — and deliberately renamed, because a table and a function that read the
 * same at the call site is how `TIER_OF_PLAN[plan]` survives a refactor as
 * `undefined` instead of a type error.
 */
export { tierOfPlan };

/**
 * The plan and price a subscription was on at a point in time.
 *
 * `plant.plan` / `plant.mrr` are the *current* values; a plant that upgraded in
 * March must not be drawn at its new plan's size when you scrub back to January,
 * and its January revenue must be the price it was actually paying then.
 */
export function planStateAt(plant: Plant, atMs: number): { plan: PlanTier; mrr: number } {
  const changes = plant.changes;
  if (!changes?.length) return { plan: plant.plan, mrr: plant.mrr };

  // Walk backwards to the most recent change that had already happened.
  for (let i = changes.length - 1; i >= 0; i--) {
    if (changes[i].at <= atMs) return { plan: changes[i].toPlan, mrr: changes[i].toMrr };
  }
  // Before every change, so it is still on what it signed up with.
  return { plan: changes[0].fromPlan, mrr: changes[0].fromMrr };
}

export function getTenureDays(startedMs: number, currentTimeMs: number = Date.now()): number {
  return Math.max(0, (currentTimeMs - startedMs) / (1000 * 60 * 60 * 24));
}

export function getGrowthStage(tenureDays: number): GrowthStage {
  if (tenureDays < 2) return 'seed';
  if (tenureDays < 14) return 'sprout';
  if (tenureDays < 60) return 'young';
  if (tenureDays < 180) return 'established';
  if (tenureDays < 730) return 'mature';
  return 'ancient';
}

/**
 * Four families, spread across however many plans there are.
 *
 * A family is a word, not a number, so it cannot be interpolated the way a
 * canopy height can — the ladder picks the nearest of the four. Two plans get
 * the herbs and the broadleaves; five put two neighbours in the same family,
 * which is the honest answer when the vocabulary is shorter than the ladder.
 */
const SPECIES_FAMILIES: SpeciesFamily[] = [
  'Ground herbs',
  'Flowering shrubs',
  'Small trees',
  'Broadleaf & conifer',
];

export function getSpeciesFamily(tier: PlanTier): SpeciesFamily {
  return SPECIES_FAMILIES[rampIndex(planPosition(tier), SPECIES_FAMILIES.length)];
}

export function getHealthState(plant: Plant, currentTimeMs: number = Date.now()): HealthState {
  if (plant.status === 'canceled') {
    if (plant.canceled_at) {
      const daysCanceled = (currentTimeMs - plant.canceled_at) / (1000 * 60 * 60 * 24);
      if (daysCanceled > 30) return 'stump'; // After 30 days, becomes bare stump / soil
    }
    return 'stump';
  }

  if (plant.failed_attempts === 0) {
    if (plant.floweringUntil && plant.floweringUntil > currentTimeMs) {
      return 'recovered';
    }
    return 'healthy';
  }
  if (plant.failed_attempts === 1) return 'yellowing';
  if (plant.failed_attempts === 2) return 'wilting';
  if (plant.failed_attempts >= 3) return 'browning';

  return 'healthy';
}

/**
 * How much bigger than a typical account on its own plan this one is.
 *
 * The reference price comes from the catalogue rather than from a second table
 * of base MRRs kept alongside the generator's — two lists of the same four
 * numbers had already drifted apart by 20%, which meant the size a plant was
 * drawn at and the price the book gave it were reading off different ladders.
 */
export function getCanopyMultiplier(mrr: number, tier: PlanTier): number {
  const ratio = mrr / planBaseMrr(tier);
  // Logarithmic scale so high MRR widens canopy visibly without blowing up
  return Math.min(2.0, Math.max(0.7, 0.8 + Math.log2(Math.max(0.5, ratio)) * 0.35));
}

export function getSeason(monthIndex: number): 'spring' | 'summer' | 'autumn' | 'winter' {
  if (monthIndex >= 2 && monthIndex <= 4) return 'spring';
  if (monthIndex >= 5 && monthIndex <= 7) return 'summer';
  if (monthIndex >= 8 && monthIndex <= 10) return 'autumn';
  return 'winter';
}
