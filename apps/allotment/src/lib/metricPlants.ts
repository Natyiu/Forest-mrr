import { GardenState, HistoricalSnapshot } from '../types';
import { PeriodMetrics } from './metrics';
import { PlantSpec } from '../components/metricPlantSprite';
import { DASH, compactMoney, money, percent, ratioLabel, signedPercent } from './format';

/**
 * Eight metrics, eight specimens.
 *
 * Each mapping answers the same two questions — *how much is there* (vigour)
 * and *is that good* (health) — and then borrows whichever bits of the garden's
 * vocabulary the metric actually earns: shoots for growth it really had,
 * stumps for accounts that really left, gaps for revenue really lost.
 *
 * Nothing here is decorative. If a metric has no expansion this month it gets
 * no shoots, and the card says so in figures beside the plant. The plant is a
 * second reading of the number, never a replacement for it.
 */

export type MetricId =
  | 'mrr' | 'arr' | 'nrr' | 'grr'
  | 'logoChurn' | 'quickRatio' | 'arpa' | 'concentration';

/** Every metric there is, in the order they stand in the border. */
export const METRIC_IDS: MetricId[] = [
  'mrr', 'arr', 'nrr', 'grr', 'logoChurn', 'quickRatio', 'arpa', 'concentration',
];

/** Narrow an untrusted string — a query parameter — to a metric, or nothing. */
export function toMetricId(value: string | null | undefined): MetricId | null {
  return METRIC_IDS.includes(value as MetricId) ? (value as MetricId) : null;
}

export interface MetricCard {
  id: MetricId;
  label: string;
  value: string;
  /** Small print under the value. */
  hint: string;
  delta?: string;
  deltaTone?: 'good' | 'bad' | 'flat';
  spec: PlantSpec;
  /** How to read this particular plant. */
  reading: string;
  /** What good looks like, stated rather than implied by the colour. */
  benchmark: string;
  /** Which of the existing charts belongs under this metric. */
  chart: 'trend' | 'movement' | 'plans' | null;
}

/**
 * Where each ratio sits between "poor" and "good".
 *
 * Written down in one place and quoted on every card, because a plant coloured
 * amber is an opinion, and an opinion in a dashboard has to show its working.
 * These are conventional B2B SaaS bands, not laws — move them and every
 * specimen re-reads itself.
 */
const BANDS = {
  nrr: { poor: 0.9, good: 1.1 },
  grr: { poor: 0.85, good: 0.98 },
  logoChurn: { poor: 0.03, good: 0.005 },
  quickRatio: { poor: 1, good: 4 },
  concentration: { poor: 0.5, good: 0.2 },
};

/** 0 at `poor`, 1 at `good`, either direction. */
function score(value: number, band: { poor: number; good: number }): number {
  const span = band.good - band.poor;
  if (span === 0) return 0.5;
  return Math.max(0, Math.min(1, (value - band.poor) / span));
}

const clampCount = (value: number, max: number) => Math.max(0, Math.min(max, Math.round(value)));

/** A specimen for a metric that has no value this month. */
const DORMANT: PlantSpec = { vigour: 0.12, health: 0.5 };

export function buildMetricCards(
  metrics: PeriodMetrics,
  snapshots: HistoricalSnapshot[],
  index: number,
  garden: GardenState
): MetricCard[] {
  const window = snapshots.slice(Math.max(0, index - 11), index + 1);

  // MRR and ARPA have no industry benchmark, so they are scored against the
  // book's own recent past: a full canopy means "at its twelve-month peak".
  const peakMrr = Math.max(...window.map((snapshot) => snapshot.mrr), 1);
  const peakArpa = Math.max(
    ...window.map((snapshot) => (snapshot.activeCount ? snapshot.mrr / snapshot.activeCount : 0)),
    1
  );

  const growth = metrics.momGrowth;
  const growing = growth !== null && growth >= 0;
  const movement = metrics.movement;
  const gained = movement ? movement.new + movement.expansion + movement.reactivation : 0;
  const lost = movement ? movement.churn + movement.contraction : 0;
  const busiest = Math.max(gained, lost, 1);

  const mrrSpec: PlantSpec = {
    vigour: metrics.mrr / peakMrr,
    health: growth === null ? 0.7 : growth >= 0 ? 1 : growth > -0.02 ? 0.5 : 0.2,
    shoots: growing && growth ? clampCount(growth * 120, 4) : 0,
    fallen: !growing && growth ? clampCount(-growth * 120, 5) : 0,
    blossom: growth !== null && growth > 0.03,
  };

  return [
    {
      id: 'mrr',
      label: 'MRR',
      value: compactMoney(metrics.mrr),
      hint: 'this month',
      delta: signedPercent(metrics.momGrowth),
      deltaTone: metrics.momGrowth === null ? 'flat' : metrics.momGrowth >= 0 ? 'good' : 'bad',
      spec: mrrSpec,
      reading:
        'The canopy is this month’s revenue against its twelve-month peak; shoots are the month’s growth, fallen leaves its decline.',
      benchmark: `Twelve-month peak is ${money(peakMrr)}.`,
      chart: 'trend',
    },
    {
      id: 'arr',
      label: 'ARR',
      value: compactMoney(metrics.arr),
      hint: 'run rate',
      spec: { ...mrrSpec, mature: true, shoots: 0, fallen: 0 },
      reading:
        'The same specimen, grown on: annual run rate is this month held for twelve, so it is the MRR tree with a year of trunk on it.',
      benchmark: 'A projection, not a forecast — it assumes nothing changes.',
      chart: 'trend',
    },
    {
      id: 'nrr',
      label: 'Net retention',
      value: percent(metrics.nrr),
      hint: 'expansion counted',
      delta: metrics.nrr === null ? undefined : metrics.nrr >= 1 ? 'growing' : 'shrinking',
      deltaTone: metrics.nrr === null ? 'flat' : metrics.nrr >= 1 ? 'good' : 'bad',
      spec:
        metrics.nrr === null
          ? DORMANT
          : {
              vigour: Math.max(0, Math.min(1, (metrics.nrr - 0.8) / 0.4)),
              health: score(metrics.nrr, BANDS.nrr),
              shoots: metrics.nrr > 1 ? clampCount((metrics.nrr - 1) * 50, 5) : 0,
              fallen: metrics.nrr < 1 ? clampCount((1 - metrics.nrr) * 50, 6) : 0,
              blossom: metrics.nrr >= 1.05,
            },
      reading:
        'What last month’s customers are worth now. Shoots are upgrades, fallen leaves are downgrades and cancellations — new logos are not counted here at all.',
      benchmark: 'Healthy is 110% or better; under 100% the book shrinks without new logos.',
      chart: 'movement',
    },
    {
      id: 'grr',
      label: 'Gross retention',
      value: percent(metrics.grr),
      hint: 'ceiling is 100%',
      spec:
        metrics.grr === null
          ? DORMANT
          : {
              vigour: Math.max(0.1, metrics.grr),
              health: score(metrics.grr, BANDS.grr),
              // No shoots, ever: this measure cannot exceed what it started with.
              gaps: clampCount((1 - metrics.grr) * 40, 5),
              fallen: clampCount((1 - metrics.grr) * 40, 6),
            },
      reading:
        'The same canopy with expansion taken away — gaps are what churn and downgrades bit out of it. Nothing can grow back here, which is why there are never shoots.',
      benchmark: 'Healthy is 98% or better. 100% is the ceiling.',
      chart: 'movement',
    },
    {
      id: 'logoChurn',
      label: 'Logo churn',
      value: percent(metrics.logoChurnRate, 2),
      hint: 'of last month’s accounts',
      spec:
        metrics.logoChurnRate === null
          ? DORMANT
          : {
              vigour: 0.55,
              health: score(metrics.logoChurnRate, BANDS.logoChurn),
              companions: 6,
              companionScale: 0.55,
              stumps: clampCount((metrics.logoChurnRate / BANDS.logoChurn.poor) * 6, 6),
            },
      reading:
        'Stumps in the bed are accounts that left. They are scaled against the 3%-a-month band, not counted one-for-one — the true figure is the number above.',
      benchmark: 'Healthy is under 1% of accounts a month; 3% is a fire.',
      chart: 'movement',
    },
    {
      id: 'quickRatio',
      label: 'Quick ratio',
      value: ratioLabel(metrics.quickRatio),
      hint: 'gained per dollar lost',
      delta: metrics.quickRatio !== null && metrics.quickRatio >= 4 ? 'healthy' : undefined,
      deltaTone: 'good',
      spec:
        metrics.quickRatio === null
          ? DORMANT
          : {
              vigour: 0.3 + score(metrics.quickRatio, BANDS.quickRatio) * 0.6,
              health: score(metrics.quickRatio, BANDS.quickRatio),
              shoots: gained > 0 ? clampCount((gained / busiest) * 5, 5) : 0,
              fallen: lost > 0 ? clampCount((lost / busiest) * 6, 6) : 0,
            },
      reading:
        'Growth against loss, side by side: shoots are every dollar gained this month, fallen leaves every dollar lost. The taller the shoots outnumber the litter, the better.',
      benchmark: 'Healthy is 4× — four dollars gained for each one lost.',
      chart: 'movement',
    },
    {
      id: 'arpa',
      label: 'ARPA',
      value: money(metrics.arpa),
      hint: 'per subscriber',
      spec: {
        vigour: metrics.arpa / peakArpa,
        health: metrics.arpa >= peakArpa * 0.95 ? 1 : metrics.arpa >= peakArpa * 0.8 ? 0.5 : 0.2,
        companions: 4,
        companionScale: 0.45,
      },
      reading:
        'One specimen at the average size of the whole bed. It grows when the book moves upmarket and shrinks when the long tail grows faster than the trees.',
      benchmark: `Twelve-month best is ${money(peakArpa)} per subscriber.`,
      chart: 'plans',
    },
    {
      id: 'concentration',
      label: 'Top 10 share',
      value: percent(metrics.top10Concentration, 0),
      hint: 'concentration risk',
      delta: metrics.top10Concentration > 0.4 ? 'concentrated' : undefined,
      deltaTone: 'bad',
      spec: {
        // The specimen *is* the top ten: the more of the book they carry, the
        // more they overshadow the bed around them.
        vigour: 0.35 + metrics.top10Concentration * 0.65,
        health: score(metrics.top10Concentration, BANDS.concentration),
        companions: 6,
        companionScale: Math.max(0.16, 0.75 - metrics.top10Concentration),
      },
      reading:
        'The specimen is your ten largest accounts; the plants around it are everyone else. When one tree shades the whole bed, losing it takes the bed with it.',
      benchmark: 'Comfortable is under 20% in the top ten; over 50% is a single-customer risk.',
      chart: 'plans',
    },
  ];
}

/** The value line for a card that has nothing to show. */
export const NO_VALUE = DASH;
