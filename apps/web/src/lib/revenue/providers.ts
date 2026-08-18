/**
 * **Which payment providers this product can read revenue from, and what it
 * takes to connect each one.** One list, shared by the browser and the server.
 *
 * Connecting a provider is not one shape of form. Stripe wants a restricted key
 * and nothing else; RevenueCat wants a key, a project ID *and* the public share
 * URL of its verified-metrics page; Superwall cannot tell you which application
 * you mean until it has the key, so its second question depends on the answer to
 * its first. Writing six forms is six places for the copy to drift out of step
 * with the six sets of instructions — and the instructions are the part a user
 * actually follows, so they are data here rather than JSX.
 *
 * Every provider therefore declares its own ordered `steps`, and the dialog is a
 * renderer. Adding a seventh provider is an entry in `REVENUE_PROVIDERS` plus a
 * `probe` in `providers.server.ts`; it is not a migration (the column is a
 * string), not a new form, and not a new set of numbered headings.
 *
 * **The keys asked for are read-only, and that is enforced rather than
 * requested.** Stripe's field takes `rk_…` (restricted) and rejects a full
 * `sk_…` secret key, because a dashboard that only ever reads charges has no
 * business holding a key that can move money. The provider help text says the
 * same thing in each provider's own words.
 *
 * This module is imported by client components: it must stay free of `node:`
 * imports, database access and secrets.
 */

export const REVENUE_PROVIDER_IDS = [
  "stripe",
  "polar",
  "lemonsqueezy",
  "dodopayments",
  "revenuecat",
  "superwall",
] as const;

export type RevenueProviderId = (typeof REVENUE_PROVIDER_IDS)[number];

export function isRevenueProviderId(value: string): value is RevenueProviderId {
  return (REVENUE_PROVIDER_IDS as readonly string[]).includes(value);
}

/** The names a credential can be filed under. */
export type CredentialField =
  | "apiKey"
  | "organizationId"
  | "projectId"
  | "shareUrl"
  | "applicationId";

export type Credentials = Partial<Record<CredentialField, string>>;

/**
 * The dark card under a field: how to get the thing the field is asking for.
 *
 * `title` is a link — every one of these ends at the page where the key is
 * made, because a numbered list whose first step is "find the right page" has
 * skipped the hard step.
 */
export interface HelpCard {
  title: string;
  href: string;
  steps: string[];
}

interface StepBase {
  label: string;
  help?: HelpCard;
}

/**
 * A step that asks for nothing.
 *
 * Superwall's middle step is "enter the API key to see projects" — a state of
 * the form rather than a question. It is numbered because the user counts it,
 * and it renders as a heading with no input.
 */
export interface NoteStep extends StepBase {
  kind: "note";
}

export interface InputStep extends StepBase {
  /** `secret` values are sealed at rest and never sent back to the browser. */
  kind: "secret" | "text" | "url";
  name: CredentialField;
  placeholder: string;
  /** Shape check, run before a round trip is spent on the provider. */
  pattern: RegExp;
  /** Said in the negative case, so it has to name the fix. */
  patternHint: string;
}

/**
 * A field whose options only the provider can supply — filled in by asking it,
 * once the key above is valid.
 */
export interface RemoteSelectStep extends StepBase {
  kind: "remote-select";
  name: CredentialField;
  placeholder: string;
  /** Shown in the disabled select before the key can be used. */
  emptyPlaceholder: string;
}

export type ProviderStep = NoteStep | InputStep | RemoteSelectStep;

export interface RevenueProvider {
  id: RevenueProviderId;
  name: string;
  /**
   * The monogram tile in the select and the connection list.
   *
   * A brand colour is one of the few places raw hex is right: it identifies a
   * company rather than encoding a value, it must not shift with the season or
   * the theme, and Stripe's violet is Stripe's violet in the dark too.
   */
  mark: { initials: string; brand: string; ink: "light" | "dark" };
  /** One line under the provider select, when the provider needs a caveat. */
  note?: string;
  steps: ProviderStep[];
}

/* ------------------------------------------------------------------ registry */

export const REVENUE_PROVIDERS: Record<RevenueProviderId, RevenueProvider> = {
  stripe: {
    id: "stripe",
    name: "Stripe",
    mark: { initials: "S", brand: "#635BFF", ink: "light" },
    note: "Restricted keys only. A full secret key can move money; reading your MRR does not need to.",
    steps: [
      {
        kind: "secret",
        name: "apiKey",
        label: "Stripe API key",
        placeholder: "rk_live_...",
        // Restricted keys are `rk_`; `sk_` is the full secret key and is
        // refused rather than quietly accepted.
        pattern: /^rk_(live|test)_[A-Za-z0-9]{16,}$/,
        patternHint:
          "That is not a restricted key. Restricted keys start with rk_live_ (or rk_test_) — a key starting with sk_ has full access to your account.",
        help: {
          title: "Click here to create a read-only API key.",
          // The dashboard's own create-key page. The permission names are in
          // the query string as a convenience; Stripe ignores what it does not
          // recognise, which is why step 2 also spells them out.
          href:
            "https://dashboard.stripe.com/apikeys/create" +
            "?name=Revenue%20dashboard%20(read-only)" +
            "&permissions[]=rak_charge_read" +
            "&permissions[]=rak_customer_read" +
            "&permissions[]=rak_subscription_read" +
            "&permissions[]=rak_invoice_read",
          steps: [
            "Scroll down and click 'Create key'",
            "Don't change the permissions — Charges, Customers, Subscriptions and Invoices need 'Read'",
            "Don't delete the key or we can't refresh revenue",
          ],
        },
      },
    ],
  },

  polar: {
    id: "polar",
    name: "Polar",
    mark: { initials: "P", brand: "#111827", ink: "light" },
    steps: [
      {
        kind: "secret",
        name: "apiKey",
        label: "Polar API key",
        placeholder: "polar_oat_...",
        pattern: /^polar_oat_[A-Za-z0-9_-]{16,}$/,
        patternHint: "A Polar organization access token starts with polar_oat_.",
        help: {
          title: "Click here to create an Organization Access Token.",
          href: "https://polar.sh/dashboard",
          steps: [
            "Click 'Settings' on the left sidebar, then 'General'",
            "Scroll to bottom and click 'New Token' button in 'Developer' section",
            "Choose 'No expiration'.",
            "Select 'orders:read', 'subscriptions:read', and 'organizations:read' permissions",
            "Create the token and copy/paste it here",
          ],
        },
      },
      {
        kind: "text",
        name: "organizationId",
        label: "Organization Identifier",
        placeholder: "e.g., 123e4567-e89b-12d3-a456-426614174000",
        // Polar's own field, and it is a UUID. An organization access token can
        // be scoped to more than one organization, so which one the numbers come
        // from is a question the token cannot answer on its own.
        pattern: /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
        patternHint:
          "The organization identifier is a UUID, like 123e4567-e89b-12d3-a456-426614174000.",
        help: {
          title: "Click here to open your Polar dashboard.",
          href: "https://polar.sh/dashboard",
          steps: [
            "Your organization Identifier in Settings > General > Organization Identifier",
          ],
        },
      },
    ],
  },

  lemonsqueezy: {
    id: "lemonsqueezy",
    name: "LemonSqueezy",
    mark: { initials: "L", brand: "#FFC233", ink: "dark" },
    steps: [
      {
        kind: "secret",
        name: "apiKey",
        label: "LemonSqueezy API key",
        placeholder: "eyJ0eXAiOiJKV1QiLCJhbGciOiJhbGc...",
        // LemonSqueezy keys are JWTs, so they open with the base64 of `{"typ"`.
        pattern: /^ey[A-Za-z0-9._-]{32,}$/,
        patternHint: "A LemonSqueezy API key is a long token beginning with 'ey'.",
        help: {
          title: "Click here to create an API key.",
          href: "https://app.lemonsqueezy.com/settings/api",
          steps: [
            'Click the + icon next to "API Keys"',
            "Set the expiration date to 10+ years from now",
            "Copy the generated API key and paste it here",
          ],
        },
      },
    ],
  },

  dodopayments: {
    id: "dodopayments",
    name: "DodoPayment",
    mark: { initials: "D", brand: "#D6F84C", ink: "dark" },
    steps: [
      {
        kind: "secret",
        name: "apiKey",
        label: "DodoPayment API key",
        placeholder: "Bearer token...",
        // Pasted straight out of a curl example, a Dodo key often arrives with
        // the word `Bearer` still attached; `normalizeCredential` takes it off
        // before this runs.
        pattern: /^[A-Za-z0-9._-]{16,}$/,
        patternHint: "Paste the API key itself — no quotes, no surrounding text.",
        help: {
          title: "Click here to open your DodoPayment dashboard.",
          href: "https://app.dodopayments.com/settings/api-keys",
          steps: [
            "Go to Settings > API Keys or Developer section",
            "Create a new Read-only API key",
            "Copy the generated API key and paste it here",
          ],
        },
      },
    ],
  },

  revenuecat: {
    id: "revenuecat",
    name: "RevenueCat",
    mark: { initials: "RC", brand: "#F2545B", ink: "light" },
    steps: [
      {
        kind: "secret",
        name: "apiKey",
        label: "RevenueCat API key",
        placeholder: "sk_...",
        pattern: /^sk_[A-Za-z0-9]{16,}$/,
        patternHint: "A RevenueCat V2 secret key starts with sk_.",
        help: {
          title: "Click here to open your RevenueCat dashboard.",
          href: "https://app.revenuecat.com/settings/api-keys",
          steps: [
            "Go to 'API Keys' section",
            "Create a new Secret API key (V2 API version + 'Read only' permissions for all)",
          ],
        },
      },
      {
        kind: "text",
        name: "projectId",
        label: "Project ID",
        placeholder: "e.g., 4f956494",
        pattern: /^[A-Za-z0-9]{6,}$/,
        patternHint: "The project ID is the short code in your dashboard URL.",
        help: {
          title: "Click here to open your RevenueCat dashboard.",
          href: "https://app.revenuecat.com/projects",
          steps: ["Go to 'Project Settings' and copy the Project ID"],
        },
      },
      {
        kind: "url",
        name: "shareUrl",
        label: "Share URL",
        placeholder: "https://verified.revenuecat.com/habitsgarden",
        // Either the whole URL or the slug on its own; `normalizeCredential`
        // turns the second into the first.
        pattern: /^https:\/\/verified\.revenuecat\.com\/[A-Za-z0-9._~-]+$/,
        patternHint:
          "Paste the verified page URL (or just its slug) — https://verified.revenuecat.com/your-slug",
        help: {
          title: "Click here to open your RevenueCat dashboard.",
          href: "https://app.revenuecat.com/projects",
          steps: [
            "Enable 'Verified Metrics' in 'Project Settings' > 'Share'",
            "The Chart must include Sparklines and Visible Metrics must include MRR and Revenue",
            "Copy the slug from your verified page URL",
          ],
        },
      },
    ],
  },

  superwall: {
    id: "superwall",
    name: "Superwall",
    mark: { initials: "SW", brand: "#0F172A", ink: "light" },
    steps: [
      {
        kind: "secret",
        name: "apiKey",
        label: "Superwall API key",
        placeholder: "sk_...",
        pattern: /^sk_[A-Za-z0-9._-]{16,}$/,
        patternHint: "A Superwall organization API key starts with sk_.",
        help: {
          title: "Open the Superwall API docs.",
          href: "https://superwall.com/docs/overview-settings-keys",
          steps: [
            "Go to your Superwall dashboard API keys",
            "Create an organization API key for this dashboard",
            "Enable READ access for all scopes",
            "Copy the generated API key and paste it here",
          ],
        },
      },
      { kind: "note", label: "Enter API key to see projects" },
      {
        kind: "remote-select",
        name: "applicationId",
        label: "Select application",
        placeholder: "Select an application",
        emptyPlaceholder: "Select a project first",
      },
    ],
  },
};

export const REVENUE_PROVIDER_LIST: RevenueProvider[] = REVENUE_PROVIDER_IDS.map(
  (id) => REVENUE_PROVIDERS[id],
);

/* ------------------------------------------------------- shape and cleaning */

/** Steps that carry a value. The notes are chrome. */
export function credentialSteps(
  provider: RevenueProvider,
): Array<InputStep | RemoteSelectStep> {
  return provider.steps.filter(
    (step): step is InputStep | RemoteSelectStep => step.kind !== "note",
  );
}

export function isSecretStep(step: ProviderStep): boolean {
  return step.kind === "secret";
}

/**
 * Clean one pasted value.
 *
 * Everything here exists because of something a person actually pastes: a key
 * copied out of a curl snippet with `Bearer ` in front of it, a URL with a
 * trailing slash, a slug where a URL was asked for, whitespace from a
 * double-click. Rejecting those as malformed would be technically correct and
 * useless, and it has to happen in *this* module so the browser's idea of
 * "valid" and the server's cannot drift.
 */
export function normalizeCredential(
  provider: RevenueProviderId,
  field: CredentialField,
  raw: string,
): string {
  let value = raw.trim();

  if (field === "apiKey") {
    value = value.replace(/^Bearer\s+/i, "").replace(/^["'`]|["'`]$/g, "").trim();
  }

  // A UUID copied out of a dashboard sometimes arrives upper-cased; it is the
  // same identifier, and the pattern is case-insensitive, so it is filed one way.
  if (field === "organizationId") value = value.toLowerCase();

  if (provider === "revenuecat" && field === "shareUrl" && value) {
    value = value.replace(/\/+$/, "");
    // A bare slug is what step 3 literally asks for ("copy the slug"), so it is
    // accepted and completed rather than bounced.
    if (!/^https?:\/\//i.test(value)) {
      value = `https://verified.revenuecat.com/${value.replace(/^\/+/, "")}`;
    }
    value = value.replace(/^http:\/\//i, "https://");
  }

  return value;
}

export interface CredentialProblem {
  field: CredentialField;
  message: string;
}

/**
 * Check a whole credential against its provider's steps.
 *
 * Returns every problem rather than the first, because a form that reveals one
 * mistake per submit is a form that takes three submits.
 */
export function validateCredentials(
  providerId: RevenueProviderId,
  credentials: Credentials,
): CredentialProblem[] {
  const provider = REVENUE_PROVIDERS[providerId];
  const problems: CredentialProblem[] = [];

  for (const step of credentialSteps(provider)) {
    const value = normalizeCredential(providerId, step.name, credentials[step.name] ?? "");

    if (!value) {
      problems.push({ field: step.name, message: `${step.label} is required.` });
      continue;
    }

    if (step.kind !== "remote-select" && !step.pattern.test(value)) {
      problems.push({ field: step.name, message: step.patternHint });
    }
  }

  return problems;
}

/** Normalize every field of a credential in one pass. */
export function normalizeCredentials(
  providerId: RevenueProviderId,
  credentials: Credentials,
): Credentials {
  const out: Credentials = {};
  for (const step of credentialSteps(REVENUE_PROVIDERS[providerId])) {
    const value = normalizeCredential(providerId, step.name, credentials[step.name] ?? "");
    if (value) out[step.name] = value;
  }
  return out;
}

/**
 * Whether the key alone is good enough to go and ask the provider for its
 * project list — the gate on Superwall's second question.
 */
export function apiKeyLooksValid(providerId: RevenueProviderId, apiKey: string): boolean {
  const step = REVENUE_PROVIDERS[providerId].steps.find(
    (candidate): candidate is InputStep =>
      candidate.kind === "secret" && candidate.name === "apiKey",
  );
  if (!step) return false;
  return step.pattern.test(normalizeCredential(providerId, "apiKey", apiKey));
}

/** The last four characters of a key — all a UI is ever shown of one. */
export function secretHint(apiKey: string): string {
  return apiKey.slice(-4);
}

/** Whether this provider asks the provider itself for one of its fields. */
export function hasRemoteStep(providerId: RevenueProviderId): boolean {
  return REVENUE_PROVIDERS[providerId].steps.some((step) => step.kind === "remote-select");
}
