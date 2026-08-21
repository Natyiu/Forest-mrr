/**
 * What kind of business a startup is, for the Forests board's per-category
 * leaderboards. One list, the way `FEEDBACK_CATEGORIES` is one list: the
 * settings select, the board's filter pills and the row chips all render this,
 * so a category cannot exist in one surface and not another.
 *
 * Deliberately short and generic — a category here is a shelf to compare
 * against, not a taxonomy, and twelve shelves with one forest each is a board
 * nobody can compare anything on.
 */
export const STARTUP_CATEGORIES = [
  { value: "saas", label: "SaaS" },
  { value: "ai", label: "AI" },
  { value: "devtools", label: "Dev tools" },
  { value: "ecommerce", label: "E-commerce" },
  { value: "fintech", label: "Fintech" },
  { value: "education", label: "Education" },
  { value: "health", label: "Health" },
  { value: "media", label: "Media & content" },
  { value: "other", label: "Other" },
] as const;

export type StartupCategory = (typeof STARTUP_CATEGORIES)[number]["value"];

export const isStartupCategory = (value: string): value is StartupCategory =>
  STARTUP_CATEGORIES.some((category) => category.value === value);

export const categoryLabel = (value: string | null): string | null =>
  STARTUP_CATEGORIES.find((category) => category.value === value)?.label ?? null;
