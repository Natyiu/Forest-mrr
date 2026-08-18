import { type HistoricalSnapshot, type PlanTier, type Plant } from '../types';
import { planNamesDescending } from './plans';
import { MEADOW_ARPA } from './gardenUtils';

/**
 * What the garden is worth, and why it changed.
 *
 * The plot answers "how is the book doing?" beautifully and "by how much?" not
 * at all. Everything here is the second question: the five ways a month's
 * revenue can move, the two retention ratios that say whether the book grows
 * without new logos, and the handful of ratios an operator actually opens a
 * dashboard to read.
 *
 * All of it is derived — pure functions over the snapshot series, no state, no
 * fetch. That is deliberate: the same numbers have to come out whether you are
 * looking at today or scrubbed to March 2024, and a derivation cannot drift
 * from the thing it derives.
 *
 * One rule holds the whole module together: **the waterfall must reconcile.**
 *   starting + new + expansion + reactivation − contraction − churn + meadow = ending
 * If that identity ever fails, the numbers are decoration. `reconciles()` below
 * checks it, and the movement panel refuses to imply precision it does not have.
 */

/** One month of revenue movement, in dollars of MRR. All parts are positive. */
export interface MrrMovement {
  /** 'YYYY-MM' of the closing month. */
  month: string;
  label: string;
  /** Book value at the start of the month, meadow included. */
  starting: number;
  /** First-time subscriptions. */
  new: number;
  /** Upgrades on subscriptions that were already here. */
  expansion: number;
  /** Subscriptions that came back after cancelling. */
  reactivation: number;
  /** Downgrades on subscriptions that stayed. */
  contraction: number;
  /** Subscriptions that left. */
  churn: number;
  /** Net movement of the long-tail meadow, which is tracked as a mass. */
  meadow: number;
  ending: number;
  /** Signed sum of everything above. */
  net: number;
}

export interface PeriodMetrics {
  month: string;
  label: string;
  mrr: number;
  /** Annualised run rate. */
  arr: number;
  activeCount: number;
  /** Average revenue per account, meadow included. */
  arpa: number;
  momGrowth: number | null;
  /** Net revenue retention: expansion counted, new logos not. */
  nrr: number | null;
  /** Gross revenue retention: the ceiling is 100%. */
  grr: number | null;
  /** Share of last month's logos that left. */
  logoChurnRate: number | null;
  /** Share of last month's revenue lost to churn and downgrades. */
  revenueChurnRate: number | null;
  /** Growth dollars earned per dollar lost. Above 4 is healthy. */
  quickRatio: number | null;
  /** ARPA ÷ monthly logo churn. Null while nothing is churning. */
  ltv: number | null;
  atRiskMrr: number;
  atRiskCount: number;
  /** Share of revenue sitting in the ten largest accounts. */
  top10Concentration: number;
  movement: MrrMovement | null;
}

export interface CohortRow {
  /** 'YYYY-MM' the cohort signed up in. */
  cohort: string;
  label: string;
  logos: number;
  startingMrr: number;
  /**
   * Retention at month 0, 1, 2 … as a ratio of the cohort's starting value.
   * Revenue retention can exceed 1 when a cohort upgrades; logo retention
   * cannot. Runs only as far as the data goes.
   */
  periods: number[];
}

const isActive = (plant: Plant) => plant.status !== 'canceled';

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function monthLabel(snapshot: Pick<HistoricalSnapshot, 'year' | 'month'>): string {
  return `${MONTH_NAMES[snapshot.month]} ${String(snapshot.year).slice(2)}`;
}

/** subscription_id → MRR, for the subscriptions that were live that month. */
function activeBook(snapshot: HistoricalSnapshot): Map<string, number> {
  const book = new Map<string, number>();
  snapshot.plants.forEach((plant) => {
    if (isActive(plant)) book.set(plant.subscription_id, plant.mrr);
  });
  return book;
}

const sum = (values: Iterable<number>) => {
  let total = 0;
  for (const value of values) total += value;
  return total;
};

/**
 * Split the month-over-month change into the five movements plus the meadow.
 *
 * A subscription is *new* if it was not on the book last month and had not
 * signed up before it either; if it had, it is a *reactivation* — the same
 * dollars, but a very different thing to have caused.
 */
export function computeMovement(
  previous: HistoricalSnapshot,
  current: HistoricalSnapshot
): MrrMovement {
  const before = activeBook(previous);
  const after = activeBook(current);

  const previousPlants = new Map(previous.plants.map((plant) => [plant.subscription_id, plant]));

  let fresh = 0;
  let expansion = 0;
  let reactivation = 0;
  let contraction = 0;
  let churn = 0;

  after.forEach((mrr, id) => {
    const was = before.get(id);
    if (was === undefined) {
      // Not on the book last month. Was it ever?
      fresh += previousPlants.has(id) ? 0 : mrr;
      reactivation += previousPlants.has(id) ? mrr : 0;
      return;
    }
    if (mrr > was) expansion += mrr - was;
    else if (mrr < was) contraction += was - mrr;
  });

  before.forEach((mrr, id) => {
    if (!after.has(id)) churn += mrr;
  });

  const meadow = (current.meadowCount - previous.meadowCount) * MEADOW_ARPA;
  const starting = sum(before.values()) + previous.meadowCount * MEADOW_ARPA;
  const net = fresh + expansion + reactivation - contraction - churn + meadow;

  return {
    month: current.dateStr,
    label: monthLabel(current),
    starting,
    new: fresh,
    expansion,
    reactivation,
    contraction,
    churn,
    meadow,
    ending: starting + net,
    net,
  };
}

/** The identity the whole panel rests on. Off-by-a-dollar is rounding, not a bug. */
export function reconciles(movement: MrrMovement, snapshot: HistoricalSnapshot): boolean {
  return Math.abs(movement.ending - snapshot.mrr) <= 1;
}

const ratio = (numerator: number, denominator: number): number | null =>
  denominator > 0 ? numerator / denominator : null;

/**
 * Everything the metrics panel shows for one month.
 *
 * Ratios return null rather than zero when their denominator is empty: a book
 * with nothing to churn has *no* churn rate, and printing "0%" for it would be
 * a claim the data cannot support.
 */
/**
 * A month with no book behind it.
 *
 * Since the sample data was removed, "no snapshots at all" is a state the app can
 * genuinely be in — a signed-in user who has connected nothing. Every count is
 * zero and **every ratio is `null`**, which the panels already render as an em
 * dash: a 0% retention on a business that has no customers would be a claim about
 * nothing. Without this, `computeMetrics` read `snapshots[-1]` and threw on the
 * first render.
 */
const NO_METRICS: PeriodMetrics = {
  month: '',
  label: '—',
  mrr: 0,
  arr: 0,
  activeCount: 0,
  arpa: 0,
  momGrowth: null,
  nrr: null,
  grr: null,
  logoChurnRate: null,
  revenueChurnRate: null,
  quickRatio: null,
  ltv: null,
  atRiskMrr: 0,
  atRiskCount: 0,
  top10Concentration: 0,
  movement: null,
};

export function computeMetrics(snapshots: HistoricalSnapshot[], index: number): PeriodMetrics {
  if (!snapshots.length) return NO_METRICS;

  const current = snapshots[Math.max(0, Math.min(index, snapshots.length - 1))];
  const previous = index > 0 ? snapshots[index - 1] : null;
  const movement = previous ? computeMovement(previous, current) : null;

  const activePlants = current.plants.filter(isActive);
  const bookMrr = sum(activePlants.map((plant) => plant.mrr));
  const atRisk = activePlants.filter((plant) => plant.failed_attempts > 0);

  const startingBook = previous ? sum(activeBook(previous).values()) : 0;
  const previousLogos = previous ? activeBook(previous).size : 0;

  const churnedLogos = previous
    ? [...activeBook(previous).keys()].filter((id) => !activeBook(current).has(id)).length
    : 0;

  const retained = movement
    ? startingBook + movement.expansion + movement.reactivation - movement.contraction - movement.churn
    : null;

  const lost = movement ? movement.churn + movement.contraction : 0;
  const gained = movement ? movement.new + movement.expansion + movement.reactivation : 0;

  const logoChurnRate = ratio(churnedLogos, previousLogos);
  const arpa = current.activeCount > 0 ? current.mrr / current.activeCount : 0;

  const topTen = [...activePlants].sort((a, b) => b.mrr - a.mrr).slice(0, 10);

  return {
    month: current.dateStr,
    label: monthLabel(current),
    mrr: current.mrr,
    arr: current.mrr * 12,
    activeCount: current.activeCount,
    arpa,
    momGrowth: previous && previous.mrr > 0 ? (current.mrr - previous.mrr) / previous.mrr : null,
    nrr: retained !== null ? ratio(retained, startingBook) : null,
    grr: movement ? ratio(startingBook - movement.churn - movement.contraction, startingBook) : null,
    logoChurnRate,
    revenueChurnRate: movement ? ratio(lost, startingBook) : null,
    quickRatio: ratio(gained, lost),
    ltv: logoChurnRate && logoChurnRate > 0 ? arpa / logoChurnRate : null,
    atRiskMrr: sum(atRisk.map((plant) => plant.mrr)),
    atRiskCount: atRisk.length,
    top10Concentration: bookMrr > 0 ? sum(topTen.map((plant) => plant.mrr)) / bookMrr : 0,
    movement,
  };
}

/** The MRR series up to and including `index`, for the headline sparkline. */
export function mrrSeries(snapshots: HistoricalSnapshot[], index: number, months = 12): number[] {
  const end = Math.max(0, Math.min(index, snapshots.length - 1)) + 1;
  return snapshots.slice(Math.max(0, end - months), end).map((snapshot) => snapshot.mrr);
}

/** Every month's movement, oldest first. The first month has no predecessor. */
export function movementSeries(snapshots: HistoricalSnapshot[]): MrrMovement[] {
  return snapshots.slice(1).map((snapshot, i) => computeMovement(snapshots[i], snapshot));
}

/**
 * The retention triangle: each signup cohort as a row, each month since signup
 * as a column.
 *
 * Revenue mode is the interesting one — a cohort that upgrades is worth *more*
 * than it started at, which is the only way a chart shows you that expansion is
 * outrunning churn. Logo mode is the sanity check beside it.
 */
export function cohortRetention(
  snapshots: HistoricalSnapshot[],
  upToIndex: number,
  mode: 'revenue' | 'logos' = 'revenue'
): CohortRow[] {
  const end = Math.max(0, Math.min(upToIndex, snapshots.length - 1));
  const rows: CohortRow[] = [];

  snapshots.slice(0, end + 1).forEach((snapshot, cohortIndex) => {
    const members = snapshot.plants.filter(
      (plant) => plant.cohort === snapshot.dateStr && isActive(plant)
    );
    if (!members.length) return;

    const ids = new Set(members.map((plant) => plant.subscription_id));
    const startingMrr = sum(members.map((plant) => plant.mrr));
    const base = mode === 'revenue' ? startingMrr : members.length;
    if (base <= 0) return;

    const periods: number[] = [];
    for (let offset = 0; cohortIndex + offset <= end; offset++) {
      const later = snapshots[cohortIndex + offset];
      const survivors = later.plants.filter(
        (plant) => ids.has(plant.subscription_id) && isActive(plant)
      );
      const value = mode === 'revenue' ? sum(survivors.map((plant) => plant.mrr)) : survivors.length;
      periods.push(value / base);
    }

    rows.push({
      cohort: snapshot.dateStr,
      label: monthLabel(snapshot),
      logos: members.length,
      startingMrr,
      periods,
    });
  });

  return rows.reverse(); // Newest cohort first: it is the one being judged.
}

/** Revenue split by plan, dearest first. Used for the concentration read. */
export function planBreakdown(plants: Plant[]): Array<{ plan: PlanTier; mrr: number; count: number }> {
  return planNamesDescending().map((plan) => {
    const members = plants.filter((plant) => plant.plan === plan && isActive(plant));
    return { plan, mrr: sum(members.map((p) => p.mrr)), count: members.length };
  });
}

/**
 * The dunning worklist, worst first.
 *
 * Sorted by what is actually at stake — dollars × how far down the retry ladder
 * the subscription already is — rather than alphabetically or by attempt count,
 * because a $1,800 account on its first failure is a more urgent phone call
 * than a $25 one on its third.
 */
export function dunningWorklist(plants: Plant[]): Array<Plant & { urgency: number }> {
  return plants
    .filter((plant) => isActive(plant) && plant.failed_attempts > 0)
    .map((plant) => ({ ...plant, urgency: plant.mrr * (1 + plant.failed_attempts) }))
    .sort((a, b) => b.urgency - a.urgency);
}
