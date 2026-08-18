import { GardenState, HistoricalSnapshot, PlanChange, PlanTier, Plant } from '../types';
import { MEADOW_ARPA, planStateAt, tierOfPlan } from './gardenUtils';
import { planBaseMrr, planCount, planNames, planPosition, planRank, plans, sampleRamp } from './plans';

const CUSTOMER_FIRST_NAMES = [
  'Acme Corp', 'Apex Bio', 'SaaSFlow', 'Vortex', 'Linearity', 'Aura Tech', 'Helios', 
  'Hyperion', 'Nexus', 'Starlight', 'OmniData', 'Prism Labs', 'Cobalt', 'Zenith', 
  'Veritas', 'Kinetix', 'Pinnacle', 'Radiant', 'Synergy', 'Solstice', 'Arcadia',
  'Catalyst', 'Meridian', 'Chronos', 'Aether', 'Novus', 'Summit', 'Titan', 'Vanguard',
  'Echo Systems', 'Beacon', 'Atlas', 'Polaris', 'Orion', 'Equinox', 'Nimbus'
];

const CUSTOMER_INDIVIDUAL_NAMES = [
  'Clara Oswald', 'Marcus Aurelius', 'Elena Rostova', 'Devon Vance', 'Sophia Lin',
  'Liam Chen', 'Amara Patel', 'Lucas Wright', 'Nadia Hassan', 'Julian Thorne',
  'Aria Montgomery', 'Ethan Hunt', 'Sora Takahashi', 'Mateo Silva', 'Zoe Sterling',
  'Gideon Cross', 'Maya Lin', 'Caleb Rivers', 'Ines Dupont', 'Vikram Seth',
  'Fiona Gallagher', 'Xavier Reed', 'Freya Lindqvist', 'Tariq Al-Mansoor', 'Chloe Bennett'
];

const COUNTRIES_LIST = [
  { code: 'US', name: 'United States', flag: '🇺🇸', region: 'North America', lat: 37.09, lng: -95.71 },
  { code: 'GB', name: 'United Kingdom', flag: '🇬🇧', region: 'Europe', lat: 55.37, lng: -3.43 },
  { code: 'DE', name: 'Germany', flag: '🇩🇪', region: 'Europe', lat: 51.16, lng: 10.45 },
  { code: 'FR', name: 'France', flag: '🇫🇷', region: 'Europe', lat: 46.22, lng: 2.21 },
  { code: 'JP', name: 'Japan', flag: '🇯🇵', region: 'Asia Pacific', lat: 36.20, lng: 138.25 },
  { code: 'CA', name: 'Canada', flag: '🇨🇦', region: 'North America', lat: 56.13, lng: -106.34 },
  { code: 'AU', name: 'Australia', flag: '🇦🇺', region: 'Asia Pacific', lat: -25.27, lng: 133.77 },
  { code: 'BR', name: 'Brazil', flag: '🇧🇷', region: 'Latin America', lat: -14.23, lng: -51.92 },
  { code: 'IN', name: 'India', flag: '🇮🇳', region: 'Asia Pacific', lat: 20.59, lng: 78.96 },
  { code: 'SG', name: 'Singapore', flag: '🇸🇬', region: 'Asia Pacific', lat: 1.35, lng: 103.81 },
  { code: 'NL', name: 'Netherlands', flag: '🇳🇱', region: 'Europe', lat: 52.13, lng: 5.29 },
  { code: 'SE', name: 'Sweden', flag: '🇸🇪', region: 'Europe', lat: 60.12, lng: 18.64 },
  { code: 'ES', name: 'Spain', flag: '🇪🇸', region: 'Europe', lat: 40.46, lng: -3.74 },
  { code: 'IT', name: 'Italy', flag: '🇮🇹', region: 'Europe', lat: 41.87, lng: 12.56 },
  { code: 'CH', name: 'Switzerland', flag: '🇨🇭', region: 'Europe', lat: 46.81, lng: 8.22 },
];

/**
 * Invent the plan history behind a subscription's *current* plan.
 *
 * Generated backwards from where the account ended up, so the last change
 * always lands exactly on `plan`/`mrr` and the two views of the same
 * subscription — the tree in the bed and the row in the waterfall — can never
 * disagree about what it pays.
 */
function generatePlanHistory(
  plan: PlanTier,
  mrr: number,
  startedMs: number,
  nowMs: number
): PlanChange[] | undefined {
  const tenureDays = (nowMs - startedMs) / (1000 * 60 * 60 * 24);
  if (tenureDays < 120) return undefined; // Too young to have moved.

  const ladder = planNames();
  const rung = planRank(plan);
  const roll = Math.random();

  // A move somewhere in the middle of the account's life, never in the last
  // fortnight — a change that recent has not shown up in a monthly close yet.
  const changeAt = startedMs + (nowMs - 15 * 86400000 - startedMs) * (0.25 + Math.random() * 0.55);

  if (roll < 0.24 && rung > 0) {
    const fromPlan = ladder[rung - 1];
    return [{
      at: changeAt,
      fromPlan,
      toPlan: plan,
      fromMrr: Math.round(planBaseMrr(fromPlan) * (0.85 + Math.random() * 0.4)),
      toMrr: mrr,
    }];
  }

  if (roll < 0.32 && rung < ladder.length - 1) {
    const fromPlan = ladder[rung + 1];
    return [{
      at: changeAt,
      fromPlan,
      toPlan: plan,
      fromMrr: Math.round(planBaseMrr(fromPlan) * (0.85 + Math.random() * 0.4)),
      toMrr: mrr,
    }];
  }

  return undefined;
}

/**
 * Invent a book of business: every subscription that has ever existed, with the
 * dates it signed up, changed plan and (sometimes) left.
 *
 * This is the only source of randomness in the app. Everything else — the
 * garden, the timeline, the metrics — is this list read at a date.
 */
export function generateBook(targetTimestampMs: number = Date.now()): Plant[] {
  const plants: Plant[] = [];
  let plantIdCounter = 1000;

  // Dearest first, so the biggest accounts take the front of the name list and
  // the long tail of Starters gets the numbered overflow.
  const ladder = plans().slice().reverse();

  ladder.forEach((cfg, rungFromTop) => {
    const rung = ladder.length - 1 - rungFromTop;
    const [minAccounts, maxAccounts] = cfg.accounts;
    const totalForTier = Math.floor(minAccounts + Math.random() * (maxAccounts - minAccounts));
    
    for (let i = 0; i < totalForTier; i++) {
      // Pick random signup date between Jan 2024 and targetTimestampMs
      const maxTenureDays = Math.max(1, (targetTimestampMs - new Date(2024, 0, 1).getTime()) / (1000 * 60 * 60 * 24));
      // Exponential skew toward newer signups
      const tenureDays = Math.pow(Math.random(), 1.6) * maxTenureDays;
      const startedMs = targetTimestampMs - tenureDays * 24 * 60 * 60 * 1000;
      
      const startedDate = new Date(startedMs);
      const cohortStr = `${startedDate.getFullYear()}-${String(startedDate.getMonth() + 1).padStart(2, '0')}`;

      // Random name
      // The top of the ladder is bought by companies; below that it is a coin
      // toss. "Top" is the dearest third, whatever the ladder's length.
      const isCorp = rung >= (planCount() - 1) * (2 / 3) || Math.random() > 0.5;
      const name = isCorp 
        ? CUSTOMER_FIRST_NAMES[i % CUSTOMER_FIRST_NAMES.length] + (i > CUSTOMER_FIRST_NAMES.length ? ` ${i}` : '')
        : CUSTOMER_INDIVIDUAL_NAMES[i % CUSTOMER_INDIVIDUAL_NAMES.length];

      // MRR variance
      const mrrVariance = 0.8 + Math.random() * 0.5;
      const mrr = Math.round(cfg.baseMrr * mrrVariance);

      // Status & dunning simulation
      let status: 'active' | 'past_due' | 'canceled' = 'active';
      let failed_attempts = 0;
      let canceled_at: number | undefined = undefined;

      const rndHealth = Math.random();
      if (rndHealth < 0.05) {
        // Yellowing (1st failed charge)
        status = 'past_due';
        failed_attempts = 1;
      } else if (rndHealth < 0.08) {
        // Wilting (2nd failed charge)
        status = 'past_due';
        failed_attempts = 2;
      } else if (rndHealth < 0.10) {
        // Browning (3rd failed charge)
        status = 'past_due';
        failed_attempts = 3;
      } else if (rndHealth < 0.24) {
        // Churned. Cancellations are spread across the account's life rather
        // than bunched into the last few weeks: piled at the end they would
        // leave every historical month at 100% retention, which makes the
        // cohort triangle and the churn line say nothing at all.
        status = 'canceled';
        canceled_at = startedMs + (targetTimestampMs - startedMs) * (0.25 + Math.random() * 0.75);
      }

      // Sliced off the plan's own name, so ids stay readable whatever the plans
      // are called — and suffixed with the rung, because two plans can easily
      // share their first three letters ("Pro" and "Professional").
      const slug = cfg.name.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 3) || 'pln';
      const subId = `sub_${slug}${rung}_${plantIdCounter++}`;

      // Pick country based on index
      const countryObj = COUNTRIES_LIST[i % COUNTRIES_LIST.length];

      plants.push({
        subscription_id: subId,
        customer_id: `cus_${plantIdCounter}`,
        customer_name: name,
        started: startedMs,
        plan: cfg.name,
        tier: rung,
        mrr,
        // A cancelled account stops moving plans on the day it leaves.
        changes: generatePlanHistory(cfg.name, mrr, startedMs, canceled_at ?? targetTimestampMs),
        status,
        failed_attempts,
        last_payment: targetTimestampMs - Math.random() * 14 * 24 * 60 * 60 * 1000,
        canceled_at,
        cohort: cohortStr,
        countryCode: countryObj.code,
        countryName: countryObj.name,
        countryFlag: countryObj.flag,
        region: countryObj.region,
        lat: countryObj.lat + (Math.random() - 0.5) * 4,
        lng: countryObj.lng + (Math.random() - 0.5) * 4,
        variantSeed: i,
      });
    }
  });

  return plants;
}

/** The garden at a moment, built from a fresh book. Kept for callers that only want one. */
export function generateSyntheticGarden(targetTimestampMs: number = Date.now()): GardenState {
  return toGardenState(generateBook(targetTimestampMs), targetTimestampMs);
}

/** How long a cancelled subscription is still drawn, as a stump, before the bed is cleared. */
const STUMP_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

/** The long tail, as a mass. Grows steadily over the life of the business. */
function meadowCountAt(year: number, month: number): number {
  return Math.floor(40 + ((year - 2024) * 12 + month) * 5.8);
}

/**
 * Roughly where each plan sits in the book, as a percentile.
 *
 * Sampled off the ladder rather than listed per plan, so it says something for
 * a two-plan catalogue and for a five-plan one. The control points are the
 * numbers that were written out by hand for the four-plan book, so that book
 * still reports exactly what it always did.
 */
const PERCENTILE_RAMP = [40, 65, 85, 98];

function tierPercentiles(): Record<string, number> {
  const table: Record<string, number> = {};
  plans().forEach((plan) => {
    table[plan.name] = Math.round(sampleRamp(PERCENTILE_RAMP, planPosition(plan.name)));
  });
  return table;
}

/**
 * The book of business as it stood at one moment: who is planted, what they
 * pay, and the standing totals.
 *
 * Subscriptions that cancelled more than a month ago are gone — their bed has
 * been cleared and replanted. Everything else, including recent stumps, is
 * still on the plot.
 */
export function toGardenState(book: Plant[], atMs: number): GardenState {
  const asOf = new Date(atMs);

  const plants = book
    .filter((p) => p.started <= atMs && !(p.canceled_at && p.canceled_at + STUMP_DAYS_MS < atMs))
    .map((p) => {
      const cancelled = p.canceled_at !== undefined && p.canceled_at <= atMs;
      const { plan, mrr } = planStateAt(p, atMs);
      // Before its cancellation date the subscription is simply a live one —
      // read the other way round, every account that will ever leave looks
      // like it left on day one, and the book has no history to churn out of.
      const status: Plant['status'] = cancelled ? 'canceled' : p.status === 'canceled' ? 'active' : p.status;
      return {
        ...p,
        plan,
        tier: tierOfPlan(plan),
        mrr,
        status,
        failed_attempts: status === 'canceled' ? 0 : p.failed_attempts,
        canceled_at: cancelled ? p.canceled_at : undefined,
      };
    });

  const activePlants = plants.filter((p) => p.status !== 'canceled');
  const atRiskPlants = plants.filter((p) => p.failed_attempts > 0 && p.status !== 'canceled');
  const totalMrr = activePlants.reduce((acc, p) => acc + p.mrr, 0);

  const meadowCount = meadowCountAt(asOf.getFullYear(), asOf.getMonth());

  return {
    plants,
    planCatalogue: plans().map((plan) => ({ ...plan })),
    tierPercentiles: tierPercentiles(),
    meadowCount,
    meadowHealth: 0.94,
    mrr: totalMrr + meadowCount * MEADOW_ARPA,
    activeCount: activePlants.length + meadowCount,
    atRiskCount: atRiskPlants.length,
    totalCustomers: plants.length + meadowCount,
  };
}

/**
 * The garden and its whole timeline, from one book of business.
 *
 * These used to be generated independently, which meant the plot you saw on
 * "today" was a different set of customers from the one the scrubber walked
 * you through — dragging off the last month swapped the entire book. One book,
 * sampled at many dates, is the only way the timeline can be *about* the
 * garden rather than merely resemble it.
 */
export function generateGarden(nowMs: number = Date.now()): {
  garden: GardenState;
  snapshots: HistoricalSnapshot[];
  book: Plant[];
} {
  const book = generateBook(nowMs);
  return {
    book,
    garden: toGardenState(book, nowMs),
    snapshots: generateHistoricalSnapshots(book, nowMs),
  };
}

/**
 * Monthly closes from Jan 2024 to the present month.
 *
 * Every month is sampled from the same book, so a subscription that signs up in
 * March, upgrades in September and cancels the following June appears — with
 * the right plan and the right price — in exactly the months it should.
 */
export function generateHistoricalSnapshots(
  book?: Plant[],
  nowMs: number = Date.now()
): HistoricalSnapshot[] {
  const snapshots: HistoricalSnapshot[] = [];
  const fullBook = book ?? generateBook(nowMs);

  const now = new Date(nowMs);
  const lastYear = now.getFullYear();
  const lastMonth = now.getMonth();

  for (let year = 2024; year <= lastYear; year++) {
    for (let month = 0; month < 12; month++) {
      if (year === lastYear && month > lastMonth) break;

      // Months close on the 28th, except the current one, which closes now —
      // so the far right of the scrubber is genuinely today.
      const isCurrent = year === lastYear && month === lastMonth;
      const timestamp = isCurrent ? nowMs : new Date(year, month, 28).getTime();
      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}`;

      // Sampled through the same function the live garden uses, so the last
      // snapshot and "today" are the same scene rather than two that agree.
      const state = toGardenState(fullBook, timestamp);

      snapshots.push({
        dateStr,
        year,
        month,
        mrr: state.mrr,
        activeCount: state.activeCount,
        atRiskCount: state.atRiskCount,
        plants: state.plants,
        meadowCount: state.meadowCount,
      });
    }
  }

  return snapshots;
}
