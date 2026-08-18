/**
 * How numbers are said out loud.
 *
 * One module so that $49,592 is never $49592 in one panel and $49.6K in the
 * next, and so that "no data" is visibly different from "zero" — a dash, not a
 * 0%, because a ratio with an empty denominator has no value and pretending
 * otherwise is the most common lie a metrics panel tells.
 */

export const DASH = '—';

/** Whole dollars with separators: $49,592. */
export function money(value: number): string {
  return `$${Math.round(value).toLocaleString('en-US')}`;
}

/** Compact dollars for tight spaces: $49.6K, $1.2M. */
export function compactMoney(value: number): string {
  const abs = Math.abs(value);
  if (abs >= 1_000_000) return `$${(value / 1_000_000).toFixed(abs >= 10_000_000 ? 0 : 1)}M`;
  if (abs >= 1_000) return `$${(value / 1_000).toFixed(abs >= 10_000 ? 0 : 1)}K`;
  return `$${Math.round(value)}`;
}

/** Always carries its sign, so a waterfall bar reads without its position. */
export function signedMoney(value: number): string {
  if (Math.round(value) === 0) return money(0);
  return `${value > 0 ? '+' : '−'}${money(Math.abs(value))}`;
}

export function percent(ratio: number | null, digits = 1): string {
  if (ratio === null || !Number.isFinite(ratio)) return DASH;
  return `${(ratio * 100).toFixed(digits)}%`;
}

export function signedPercent(ratio: number | null, digits = 1): string {
  if (ratio === null || !Number.isFinite(ratio)) return DASH;
  const sign = ratio > 0 ? '+' : ratio < 0 ? '−' : '';
  return `${sign}${(Math.abs(ratio) * 100).toFixed(digits)}%`;
}

export function ratioLabel(value: number | null, digits = 1): string {
  if (value === null || !Number.isFinite(value)) return DASH;
  return `${value.toFixed(digits)}×`;
}

export function count(value: number): string {
  return value.toLocaleString('en-US');
}

/** "2 yr 4 mo" / "18 days" — tenure the way a person would say it. */
export function tenureLabel(days: number): string {
  const years = Math.floor(days / 365);
  const months = Math.floor((days % 365) / 30);
  if (years > 0) return `${years} yr ${months} mo`;
  if (months > 0) return `${months} mo`;
  return `${Math.max(0, Math.floor(days))} days`;
}
