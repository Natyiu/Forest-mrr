/**
 * The plan catalogue — **what this product actually sells.**
 *
 * Four plans called Starter, Pro, Scale and Enterprise used to be spelled out
 * in fifteen places: the generator's tier config, the tree/tower/fish sprite
 * tables, the foliage ramp, the filter chips, the globe marker sizes, the
 * upgrade ladder in the simulator, the `?tier=` allow-list. A product with two
 * plans, or three, or one called "Hobby" instead of "Starter", had to be
 * hand-edited into every one of them, and any that was missed failed silently:
 * a sprite table keyed by name returns `undefined` for a plan it has never
 * heard of, and the tree simply does not draw.
 *
 * So the ladder is declared **once, here**, and everything else asks. Nothing
 * downstream names a plan or counts them.
 *
 * ## What a plan is
 *
 * A name, a price, and how many accounts sit on it. That is the whole
 * contract — everything visual is derived, because a colour or a canopy shape
 * hand-picked per plan is a thing that has to be re-picked the moment the
 * ladder changes length.
 *
 * ## Position, not name
 *
 * The one thing the ladder guarantees is **order**: cheapest first, dearest
 * last. `planPosition()` turns that into a number from 0 to 1, and every
 * derived ramp — canopy height, tower height, fish length, foliage lightness,
 * marker size — is a sample from that position rather than a lookup by name.
 * Two plans get the two ends; five get five even rungs; the authored
 * four-plan values are reproduced exactly, because the ramps below have them
 * as their control points.
 *
 * ## Changing it
 *
 * `setPlanCatalogue()` at startup, before a book is generated. The server
 * reads `ALLOTMENT_PLANS` (JSON) and ships whatever it is using in
 * `/api/garden`, so the client adopts the server's ladder along with the
 * server's book — a client drawing its own four plans against a server's three
 * is the same class of bug as adopting the garden without the history.
 */

export interface PlanDefinition {
  /** Whatever the product calls it. Free text; only uniqueness is required. */
  name: string;
  /**
   * What a typical account on this plan pays per month. It sets the generated
   * book's prices *and* the size a plant is drawn at, so the two can never
   * drift apart the way two separate tables of base prices had.
   */
  baseMrr: number;
  /** How many accounts the generated book puts on this plan, `[min, max]`. */
  accounts: [number, number];
}

/**
 * The default ladder: a four-rung B2B SaaS book.
 *
 * It is a default, not a definition. Nothing outside this file assumes these
 * names, these prices, or that there are four of them.
 */
export const DEFAULT_PLANS: readonly PlanDefinition[] = [
  { name: 'Starter', baseMrr: 25, accounts: [90, 130] },
  { name: 'Pro', baseMrr: 120, accounts: [60, 90] },
  { name: 'Scale', baseMrr: 480, accounts: [28, 40] },
  { name: 'Enterprise', baseMrr: 1800, accounts: [12, 18] },
];

let catalogue: PlanDefinition[] = DEFAULT_PLANS.map((plan) => ({ ...plan }));
let ranks = new Map<string, number>(catalogue.map((plan, i) => [plan.name, i]));
let version = 0;

/**
 * Bumped whenever the ladder changes.
 *
 * Anything that caches something derived from the catalogue — the theme's
 * foliage ramp is the only one — keys that cache on this, so installing a new
 * ladder cannot leave a stale set of greens behind.
 */
export const planCatalogueVersion = () => version;

/** The ladder, cheapest first. */
export const plans = (): readonly PlanDefinition[] => catalogue;

export const planNames = (): string[] => catalogue.map((plan) => plan.name);

export const planCount = () => catalogue.length;

/** Cheapest first, so `-1` means "not a plan we sell". */
export const planRank = (name: string): number => ranks.get(name) ?? -1;

export const isPlan = (name: string): boolean => ranks.has(name);

export const planDef = (name: string): PlanDefinition | undefined =>
  catalogue[ranks.get(name) ?? -1];

/**
 * A plan's rung, as a number `Plant.tier` can hold.
 *
 * Unknown plans land on the bottom rung rather than on `-1`: a subscription
 * arriving over the wire on a plan this build has never heard of should be
 * drawn small, not drawn as an array lookup failure.
 */
export const tierOfPlan = (name: string): number => Math.max(0, planRank(name));

export const planBaseMrr = (name: string): number => planDef(name)?.baseMrr ?? 100;

export const smallestPlan = (): string => catalogue[0].name;
export const largestPlan = (): string => catalogue[catalogue.length - 1].name;

/**
 * The plan a plant is drawn as when the planting says species carries nothing.
 *
 * Logo churn draws every account identically, and "identically" has to be
 * *some* silhouette — the middle of the ladder, because the smallest and the
 * largest both read as a statement about size and this one is not one.
 */
export const middlePlan = (): string => catalogue[Math.floor((catalogue.length - 1) / 2)].name;

/** Dearest first. What the beds, the chips and the breakdown tables are ordered by. */
export const planNamesDescending = (): string[] => planNames().reverse();

/** The next rung up, or `null` at the top of the ladder. */
export const nextPlanUp = (name: string): string | null => {
  const rank = planRank(name);
  return rank >= 0 && rank < catalogue.length - 1 ? catalogue[rank + 1].name : null;
};

/** The next rung down, or `null` at the bottom. */
export const nextPlanDown = (name: string): string | null => {
  const rank = planRank(name);
  return rank > 0 ? catalogue[rank - 1].name : null;
};

/**
 * Where a plan sits on the ladder: 0 at the cheapest, 1 at the dearest.
 *
 * This is the number every derived ramp is sampled at, and it is the reason
 * nothing downstream has to know how many plans there are. A one-plan
 * catalogue sits in the middle rather than at either end, because with nothing
 * to be ordered against, "the smallest" and "the largest" are both claims the
 * data cannot support.
 */
export function planPosition(name: string): number {
  if (catalogue.length === 1) return 0.5;
  return Math.max(0, planRank(name)) / (catalogue.length - 1);
}

/**
 * Read a hand-authored ramp at an arbitrary position.
 *
 * The control points are the values that were tuned by eye for the four-plan
 * ladder — canopy heights, tower footprints, fish lengths, swatch lightnesses.
 * Piecewise-linear between them, so four plans reproduce the authored numbers
 * exactly, two plans get the two ends, and five get five rungs of the same
 * curve rather than a new table somebody has to invent.
 */
export function sampleRamp(points: readonly number[], position: number): number {
  if (points.length === 1) return points[0];
  const at = Math.min(1, Math.max(0, position)) * (points.length - 1);
  const lo = Math.floor(at);
  const hi = Math.min(points.length - 1, lo + 1);
  return points[lo] + (points[hi] - points[lo]) * (at - lo);
}

/**
 * Pick one of a fixed set of *discrete* things — a canopy shape, a species
 * family, a building type — at a position on the ladder.
 *
 * Silhouettes cannot be interpolated the way a height can: half a conifer and
 * half a clover is neither. So the archetypes are spread across the ladder and
 * the nearest one wins. With more plans than archetypes two neighbours share a
 * silhouette; they are still told apart by size and by the foliage ramp, both
 * of which stay exact at any length.
 */
export function rampIndex(position: number, count: number): number {
  if (count <= 1) return 0;
  return Math.round(Math.min(1, Math.max(0, position)) * (count - 1));
}

/**
 * The size ladder, in unscaled plot units.
 *
 * A canopy's height, a tower's height and a fish's swim depth are all this
 * ladder, which is what lets the shape switch never reframe the camera and
 * never change which subscription looks like the big one. It used to be
 * written out three times, once per sprite file, which is three chances for
 * them to disagree.
 */
export const SIZE_LADDER = [18, 28, 46, 64] as const;

/** How tall the dearest plan stands. Sampled, so it holds for any ladder. */
export const planSize = (name: string): number => sampleRamp(SIZE_LADDER, planPosition(name));

/* ------------------------------------------------------------- installing */

class PlanCatalogueError extends Error {}

/**
 * Check a ladder before it is installed.
 *
 * Strict on purpose. A catalogue is configuration, read once at startup, and
 * every failure it can have is silent downstream: a duplicate name makes one
 * plan's accounts disappear into another's bed, and prices out of order invert
 * every ramp in the app so that the cheapest plan is drawn as the biggest
 * tree.
 */
export function validatePlanCatalogue(input: unknown): PlanDefinition[] {
  if (!Array.isArray(input) || input.length === 0) {
    throw new PlanCatalogueError('A plan catalogue must be a non-empty array of plans.');
  }

  const seen = new Set<string>();
  let previousMrr = -Infinity;

  return input.map((raw, i) => {
    const plan = raw as Partial<PlanDefinition>;
    const name = typeof plan?.name === 'string' ? plan.name.trim() : '';
    if (!name) throw new PlanCatalogueError(`Plan ${i} has no name.`);
    if (seen.has(name)) throw new PlanCatalogueError(`Two plans are both called "${name}".`);
    seen.add(name);

    const baseMrr = Number(plan?.baseMrr);
    if (!Number.isFinite(baseMrr) || baseMrr <= 0) {
      throw new PlanCatalogueError(`Plan "${name}" needs a baseMrr above zero.`);
    }
    // Cheapest first is the one thing the whole app reads off this list.
    if (baseMrr <= previousMrr) {
      throw new PlanCatalogueError(
        `Plans must be listed cheapest first: "${name}" at ${baseMrr} follows ${previousMrr}.`
      );
    }
    previousMrr = baseMrr;

    const accounts = plan?.accounts;
    const [min, max] = Array.isArray(accounts) ? accounts : [];
    if (!Number.isFinite(min) || !Number.isFinite(max) || min < 0 || max < min) {
      throw new PlanCatalogueError(`Plan "${name}" needs accounts as [min, max], min ≤ max.`);
    }

    return { name, baseMrr, accounts: [Math.floor(min), Math.floor(max)] as [number, number] };
  });
}

/**
 * Install a ladder. Call it before generating a book, not after.
 *
 * A garden already on screen is a set of subscriptions whose `plan` strings
 * came from the *old* ladder; swapping underneath them leaves every one of
 * them on a plan the catalogue no longer sells. The two call sites that do
 * this — the server at boot, and the client the moment it adopts the server's
 * book — both replace the book in the same breath.
 */
export function setPlanCatalogue(input: unknown): readonly PlanDefinition[] {
  catalogue = validatePlanCatalogue(input);
  ranks = new Map(catalogue.map((plan, i) => [plan.name, i]));
  version++;
  return catalogue;
}

/**
 * A ladder from a JSON string, for an environment variable.
 *
 * Returns `null` for absent or unparseable input so a caller can fall back to
 * the default; a *parseable but invalid* ladder still throws, because that is
 * somebody having configured this and got it wrong, which is worth a crash at
 * boot rather than a quietly different dashboard.
 */
export function parsePlanCatalogue(raw: string | undefined | null): PlanDefinition[] | null {
  if (!raw?.trim()) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new PlanCatalogueError('ALLOTMENT_PLANS is not valid JSON.');
  }
  return validatePlanCatalogue(parsed);
}
