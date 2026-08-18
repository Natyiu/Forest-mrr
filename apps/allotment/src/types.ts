import { PlanDefinition } from './lib/plans';

/**
 * A plan's name, as the product spells it.
 *
 * It was a union of four literals, which made the plan ladder a compile-time
 * fact: a product selling two plans, or five, or the same four under different
 * names, could not be represented without editing the type and then chasing
 * every `Record<PlanTier, …>` it broke. The ladder is data now — see
 * `lib/plans.ts` — so this is the string that indexes it, and the ordering the
 * union used to imply is `planRank()`.
 */
export type PlanTier = string;

export type HealthState = 'healthy' | 'thirsty' | 'yellowing' | 'wilting' | 'browning' | 'recovered' | 'stump';

export type SpeciesFamily = 'Ground herbs' | 'Flowering shrubs' | 'Small trees' | 'Broadleaf & conifer';

export type GrowthStage = 'seed' | 'sprout' | 'young' | 'established' | 'mature' | 'ancient';

/**
 * A plan change on a subscription. Without these a book of subscriptions has no
 * expansion or contraction revenue, and half of SaaS reporting — net revenue
 * retention, the movement waterfall, quick ratio — has nothing to measure.
 */
export interface PlanChange {
  at: number; // Unix timestamp in ms
  fromPlan: PlanTier;
  toPlan: PlanTier;
  fromMrr: number;
  toMrr: number;
}

export interface Plant {
  subscription_id: string;
  customer_id: string;
  customer_name: string;
  started: number; // Unix timestamp in ms
  plan: PlanTier;
  /** The plan's rung on the ladder, 0 at the cheapest. `tierOfPlan(plan)`. */
  tier: number;
  mrr: number; // MRR in dollars
  /** Upgrades and downgrades, oldest first. Absent means the plan never moved. */
  changes?: PlanChange[];
  status: 'active' | 'past_due' | 'canceled';
  failed_attempts: number; // 0: healthy, 1: yellowing, 2: wilting, 3: browning
  last_payment: number;
  canceled_at?: number; // Unix timestamp in ms
  cohort: string; // 'YYYY-MM'
  
  // Geo & Country Location
  countryCode?: string; // 'US', 'GB', 'DE', etc.
  countryName?: string; // 'United States', 'Germany', etc.
  countryFlag?: string; // '🇺🇸', '🇩🇪', etc.
  region?: string; // 'North America', 'Europe', 'Asia Pacific', 'Latin America'
  lat?: number;
  lng?: number;

  // Placement & Visual dynamics
  gridX?: number;
  gridY?: number;
  bedIndex?: number;
  rowIndex?: number;
  colIndex?: number;
  isFlowering?: boolean;
  floweringUntil?: number;
  prunedAt?: number;
  variantSeed?: number;
}

export interface GardenState {
  plants: Plant[];
  /**
   * The ladder this book was generated against, so a client can adopt the
   * server's plans along with the server's subscriptions. Absent on a garden
   * built locally, which is already standing on the catalogue it generated.
   */
  planCatalogue?: PlanDefinition[];
  tierPercentiles: Record<PlanTier, number>;
  meadowCount: number;
  meadowHealth: number; // 0 to 1
  mrr: number;
  activeCount: number;
  atRiskCount: number;
  totalCustomers: number;
}

export type PaymentEventType = 
  | 'payment' 
  | 'failed_payment' 
  | 'recovery' 
  | 'upgrade' 
  | 'downgrade' 
  | 'churn' 
  | 'new_sub' 
  | 'refund';

export interface PaymentEvent {
  id: string;
  type: PaymentEventType;
  subscription_id: string;
  customer_name: string;
  plan: PlanTier;
  amount: number;
  timestamp: number;
}

export interface WeatherState {
  rainIntensity: number; // payments in trailing hour
  sunbeamPlantId: string | null;
  sunbeamAmount: number | null;
  cloudShadow: boolean;
  drought: boolean; // true if no payments in 6+ hrs
  season: 'spring' | 'summer' | 'autumn' | 'winter';
  lastPaymentTime: number;
}

export interface HistoricalSnapshot {
  dateStr: string; // 'YYYY-MM'
  year: number;
  month: number; // 0-11
  mrr: number;
  activeCount: number;
  atRiskCount: number;
  plants: Plant[];
  meadowCount: number;
}
