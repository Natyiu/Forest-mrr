import { type PlanTier, type Plant } from '../types';
import { planNamesDescending } from './plans';
import { type MetricId } from './metricPlants';
import { type PeriodMetrics } from './metrics';
import { compactMoney, count, percent } from './format';
import { getTenureDays } from './gardenUtils';

/**
 * One book of business, bedded eight different ways.
 *
 * The plot was only ever a picture of MRR: every subscription a tree, bedded by
 * plan. That is one reading of the book, and the app had seven more locked
 * behind a panel of figures. This module is the other seven, planted.
 *
 * The rule that keeps it honest: **a tree is always a subscription, drawn at
 * the size it actually pays.** Changing the metric changes which subscriptions
 * are on the plot and which bed each one stands in — never what a tree means.
 * Net retention is not a different chart, it is last month's customers sorted
 * into what became of them; concentration is the same plot with the ten
 * largest accounts lifted into their own bed. You can compare any two plantings
 * because the trees did not move the goalposts between them.
 *
 * The one exception is logo churn, which counts accounts and not dollars, so it
 * draws every account as the same plant and says so on the stake.
 */

export type BedTone = 'normal' | 'gain' | 'loss' | 'gone';

export interface ViewBed {
  key: string;
  /** Stake, first line. */
  label: string;
  /** Stake, second line: what this bed is worth. */
  note: string;
  plants: Plant[];
  /** `gone` is drawn as stumps — those subscriptions are not there any more. */
  tone: BedTone;
}

export interface GardenPlanting {
  metric: MetricId;
  beds: ViewBed[];
  /** `equal` draws one tree per account whatever it pays. */
  sizeBy: 'mrr' | 'equal';
  /** `uniform` drops the plan species, for the same reason. */
  speciesBy: 'plan' | 'uniform';
  /** Why the plot is bare, when it is. */
  emptyNote: string | null;
}

const isActive = (plant: Plant) => plant.status !== 'canceled';

const sumMrr = (plants: Plant[]) => plants.reduce((total, plant) => total + plant.mrr, 0);

/** `$12.4K · 31 accounts`, the second line of every stake. */
const noteOf = (plants: Plant[], prefix = '') =>
  `${prefix}${compactMoney(sumMrr(plants))} · ${count(plants.length)} ${plants.length === 1 ? 'account' : 'accounts'}`;

const bed = (key: string, label: string, plants: Plant[], note: string, tone: BedTone = 'normal'): ViewBed => ({
  key,
  label,
  note,
  plants,
  tone,
});

/**
 * What happened to last month's book, subscription by subscription.
 *
 * The same split `computeMovement` makes in dollars, kept as the plants
 * themselves so the plot can stand them in beds. A churned subscription is
 * carried over from *last* month's snapshot, because that is the only place it
 * still has a price.
 */
function classify(current: Plant[], previous: Plant[]) {
  const before = new Map(previous.filter(isActive).map((plant) => [plant.subscription_id, plant]));
  const after = new Map(current.filter(isActive).map((plant) => [plant.subscription_id, plant]));
  const everBefore = new Set(previous.map((plant) => plant.subscription_id));

  const expanded: Plant[] = [];
  const contracted: Plant[] = [];
  const held: Plant[] = [];
  const fresh: Plant[] = [];
  const reactivated: Plant[] = [];
  const churned: Plant[] = [];

  let expansion = 0;
  let contraction = 0;

  after.forEach((plant, id) => {
    const was = before.get(id);
    if (!was) {
      // Not on the book last month. Was it ever? The same question
      // `computeMovement` asks, and the same answer.
      if (everBefore.has(id)) reactivated.push(plant);
      else fresh.push(plant);
      return;
    }
    if (plant.mrr > was.mrr) {
      expanded.push(plant);
      expansion += plant.mrr - was.mrr;
    } else if (plant.mrr < was.mrr) {
      contracted.push(plant);
      contraction += was.mrr - plant.mrr;
    } else {
      held.push(plant);
    }
  });

  before.forEach((plant, id) => {
    if (!after.has(id)) churned.push(plant);
  });

  return {
    expanded,
    contracted,
    held,
    fresh,
    reactivated,
    churned,
    expansion,
    contraction,
    churn: sumMrr(churned),
    startingBook: sumMrr([...before.values()]),
    startingLogos: before.size,
  };
}

/**
 * The plot as it has always been: every active subscription, bedded by plan.
 *
 * Dearest bed first, and one bed per plan the product actually sells — so a
 * three-plan catalogue lays out three beds rather than four with one of them
 * permanently empty.
 */
function byPlan(current: Plant[]): ViewBed[] {
  const active = current.filter(isActive);
  return planNamesDescending().map((plan) => {
    const members = active.filter((plant) => plant.plan === plan);
    return bed(plan, plan, members, noteOf(members));
  });
}

const TENURE_BANDS: Array<{ key: string; label: string; min: number }> = [
  { key: 'ancient', label: '2 years and over', min: 730 },
  { key: 'mature', label: '1 to 2 years', min: 365 },
  { key: 'established', label: '6 to 12 months', min: 180 },
  { key: 'young', label: 'Under 6 months', min: 0 },
];

const ARPA_BANDS = { high: 1.25, low: 0.75 };

const empty = (metric: MetricId, note: string): GardenPlanting => ({
  metric,
  beds: [],
  sizeBy: 'mrr',
  speciesBy: 'plan',
  emptyNote: note,
});

/**
 * How to plant the plot for a metric.
 *
 * `current` is the live book at the month on screen; `previous` is the month
 * before it, which is the only way a movement reading can exist at all.
 */
export function buildGardenPlanting(
  metric: MetricId,
  metrics: PeriodMetrics,
  current: Plant[],
  previous: Plant[] | null
): GardenPlanting {
  const active = current.filter(isActive);

  const movementNote =
    'This is the first month on record — there is no previous close to compare against, so there is nothing to plant.';

  switch (metric) {
    case 'mrr':
      return {
        metric,
        beds: byPlan(current),
        sizeBy: 'mrr',
        speciesBy: 'plan',
        emptyNote: null,
      };

    // Annual run rate is this month held for twelve, so the question worth
    // planting is not "how much" — it is "how much of it would still be here".
    // Bedding by tenure shows exactly how safe the projection is.
    case 'arr':
      return {
        metric,
        beds: TENURE_BANDS.map((band, index) => {
          const ceiling = index === 0 ? Infinity : TENURE_BANDS[index - 1].min;
          const members = active.filter((plant) => {
            const days = getTenureDays(plant.started);
            return days >= band.min && days < ceiling;
          });
          return bed(
            band.key,
            band.label,
            members,
            `${compactMoney(sumMrr(members) * 12)} a year · ${count(members.length)} accounts`
          );
        }),
        sizeBy: 'mrr',
        speciesBy: 'plan',
        emptyNote: null,
      };

    case 'nrr': {
      if (!previous) return empty(metric, movementNote);
      const split = classify(current, previous);
      return {
        metric,
        beds: [
          bed('expanded', 'Expanded', split.expanded, `+${compactMoney(split.expansion)} of upgrades`, 'gain'),
          bed('held', 'Held', split.held, noteOf(split.held)),
          bed('contracted', 'Contracted', split.contracted, `−${compactMoney(split.contraction)} of downgrades`, 'loss'),
          bed('churned', 'Churned', split.churned, `−${compactMoney(split.churn)} gone`, 'gone'),
        ],
        sizeBy: 'mrr',
        speciesBy: 'plan',
        // New logos are deliberately absent: NRR does not count them, and a
        // plot that shows them would be showing a different number.
        emptyNote: null,
      };
    }

    case 'grr': {
      if (!previous) return empty(metric, movementNote);
      const split = classify(current, previous);
      // Expansion cannot count here, so the accounts that grew stand in the
      // same bed as the ones that held: from this metric's point of view they
      // did the same thing — they stayed.
      const kept = [...split.held, ...split.expanded];
      return {
        metric,
        beds: [
          bed('kept', 'Kept', kept, noteOf(kept)),
          bed('contracted', 'Contracted', split.contracted, `−${compactMoney(split.contraction)} of downgrades`, 'loss'),
          bed('churned', 'Churned', split.churned, `−${compactMoney(split.churn)} gone`, 'gone'),
        ],
        sizeBy: 'mrr',
        speciesBy: 'plan',
        emptyNote: null,
      };
    }

    case 'logoChurn': {
      if (!previous) return empty(metric, movementNote);
      const split = classify(current, previous);
      const stayed = [...split.held, ...split.expanded, ...split.contracted];
      return {
        metric,
        beds: [
          bed('stayed', 'Stayed', stayed, `${count(stayed.length)} of ${count(split.startingLogos)} accounts`),
          bed(
            'left',
            'Left this month',
            split.churned,
            `${count(split.churned.length)} accounts · ${percent(metrics.logoChurnRate, 2)}`,
            'gone'
          ),
        ],
        // One account, one plant. This metric counts logos, and a plot that
        // sized them by revenue would be answering the revenue question again.
        sizeBy: 'equal',
        speciesBy: 'uniform',
        emptyNote: null,
      };
    }

    case 'quickRatio': {
      if (!previous) return empty(metric, movementNote);
      const split = classify(current, previous);
      return {
        metric,
        beds: [
          bed('new', 'New', split.fresh, `+${compactMoney(sumMrr(split.fresh))} won`, 'gain'),
          bed('expansion', 'Expanded', split.expanded, `+${compactMoney(split.expansion)} of upgrades`, 'gain'),
          bed('reactivation', 'Came back', split.reactivated, `+${compactMoney(sumMrr(split.reactivated))} returned`, 'gain'),
          bed('contraction', 'Contracted', split.contracted, `−${compactMoney(split.contraction)} of downgrades`, 'loss'),
          bed('churn', 'Churned', split.churned, `−${compactMoney(split.churn)} gone`, 'gone'),
        ],
        sizeBy: 'mrr',
        speciesBy: 'plan',
        emptyNote: null,
      };
    }

    case 'arpa': {
      const average = metrics.arpa;
      const above = active.filter((plant) => plant.mrr > average * ARPA_BANDS.high);
      const around = active.filter(
        (plant) => plant.mrr <= average * ARPA_BANDS.high && plant.mrr >= average * ARPA_BANDS.low
      );
      const below = active.filter((plant) => plant.mrr < average * ARPA_BANDS.low);
      return {
        metric,
        beds: [
          bed('above', 'Above average', above, noteOf(above)),
          bed('around', 'Around average', around, noteOf(around)),
          bed('below', 'Below average', below, noteOf(below)),
        ],
        sizeBy: 'mrr',
        speciesBy: 'plan',
        emptyNote: null,
      };
    }

    case 'concentration': {
      const ranked = [...active].sort((a, b) => b.mrr - a.mrr);
      const top = ranked.slice(0, 10);
      const rest = ranked.slice(10);
      const book = sumMrr(ranked);
      return {
        metric,
        beds: [
          bed(
            'top',
            'The ten largest',
            top,
            `${compactMoney(sumMrr(top))} · ${percent(book > 0 ? sumMrr(top) / book : 0, 0)} of the book`
          ),
          bed('rest', 'Everyone else', rest, noteOf(rest)),
        ],
        sizeBy: 'mrr',
        speciesBy: 'plan',
        emptyNote: null,
      };
    }
  }
}
