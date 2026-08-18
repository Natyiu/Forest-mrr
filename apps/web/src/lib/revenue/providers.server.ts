import "server-only";

import {
  type Credentials,
  type RevenueProviderId,
  REVENUE_PROVIDERS,
} from "./providers";

/**
 * **Proving a key works before saving it.**
 *
 * A connect form that stores whatever it was given always succeeds, and then the
 * dashboard is empty and nobody knows which of the six things went wrong. So
 * every provider is *asked*, once, with the key the user just pasted, using the
 * cheapest read that needs the same permission the refresh will need: one page
 * of subscriptions, one project, one account. If that read works the key is
 * saved; if it does not, nothing is written and the provider's own reason comes
 * back into the dialog.
 *
 * The endpoints below are each provider's documented v1/v2 REST API:
 *
 *   Stripe        GET  api.stripe.com/v1/subscriptions          Bearer rk_…
 *   Polar         GET  api.polar.sh/v1/subscriptions            Bearer polar_oat_…
 *   LemonSqueezy  GET  api.lemonsqueezy.com/v1/users/me         Bearer + vnd.api+json
 *   DodoPayments  GET  live.dodopayments.com/subscriptions      Bearer
 *   RevenueCat    GET  api.revenuecat.com/v2/projects/{id}      Bearer sk_…
 *   Superwall     GET  api.superwall.com/v2/projects            Bearer sk_…
 *
 * Two of them have a second environment behind the same key format — Polar's
 * sandbox and Dodo's test mode — and there is nothing in either key that says
 * which it is. Rather than asking the user to tell us something their dashboard
 * already knows, the probe tries live and falls back to the test host on a 401,
 * and records which one answered.
 *
 * Superwall's project payload is the one shape not pinned down by a public
 * schema, so it is read tolerantly (see `readSuperwallOptions`) instead of being
 * indexed into and crashing on the day it differs.
 */

export interface ProviderProbe {
  /** What the provider called this account. Shown as "which Stripe is this". */
  accountLabel: string;
  /**
   * The logo the provider holds for this account, when it publishes one a
   * read-only key can fetch. **Imported rather than asked for**: a business
   * selling through Polar has already put its mark on its own checkout page.
   * `undefined` is a normal answer — see `pickLogo`.
   */
  logoUrl?: string;
  /** One line of evidence the read actually returned data. */
  detail?: string;
  /** Which environment answered, when a provider has more than one. */
  environment?: "live" | "test";
}

export interface RemoteOption {
  id: string;
  label: string;
  /** The project an application belongs to, when the provider nests them. */
  group?: string;
  /** An icon the provider holds for this application, if it publishes one. */
  logoUrl?: string;
}

/** A failure worth showing a user verbatim. */
export class ProviderError extends Error {
  readonly status?: number;

  constructor(message: string, status?: number) {
    super(message);
    this.name = "ProviderError";
    this.status = status;
  }
}

const TIMEOUT_MS = 12_000;

interface RequestOptions {
  headers?: Record<string, string>;
  /** Named in every error message, so the user knows who said no. */
  providerName: string;
  /** Appended to a 403, because a scope error is fixed by knowing the scope. */
  scopeHint?: string;
  /** Errors are returned rather than thrown — for the best-effort extras. */
  soft?: boolean;
}

async function getJson(url: string, options: RequestOptions): Promise<unknown> {
  let response: Response;

  try {
    response = await fetch(url, {
      method: "GET",
      headers: { Accept: "application/json", ...options.headers },
      signal: AbortSignal.timeout(TIMEOUT_MS),
      cache: "no-store",
    });
  } catch (error) {
    if (options.soft) throw new ProviderError("unreachable");
    const timedOut = error instanceof Error && error.name === "TimeoutError";
    throw new ProviderError(
      timedOut
        ? `${options.providerName} did not answer within ${TIMEOUT_MS / 1000} seconds. Try again.`
        : `${options.providerName} could not be reached from this server.`,
    );
  }

  if (!response.ok) {
    if (options.soft) throw new ProviderError("refused", response.status);
    throw new ProviderError(describeStatus(response.status, options), response.status);
  }

  try {
    return (await response.json()) as unknown;
  } catch {
    if (options.soft) throw new ProviderError("unparseable");
    throw new ProviderError(`${options.providerName} returned something that is not JSON.`);
  }
}

function describeStatus(status: number, options: RequestOptions): string {
  const who = options.providerName;

  if (status === 401)
    return `${who} rejected the key. Create a new one and paste it again — a key that has been revoked or has expired cannot be recovered.`;
  if (status === 403)
    return `${who} accepted the key but not its permissions.${options.scopeHint ? ` ${options.scopeHint}` : ""}`;
  if (status === 404)
    return `${who} has nothing at that address — check the IDs above.`;
  if (status === 429) return `${who} is rate-limiting this key. Wait a minute and try again.`;
  if (status >= 500) return `${who} is having trouble right now (${status}). Nothing was saved; try again shortly.`;
  return `${who} refused the request (${status}).`;
}

/** A best-effort extra: a nicer label, a count. Never a reason to fail. */
async function optional<T>(work: () => Promise<T>): Promise<T | null> {
  try {
    return await work();
  } catch {
    return null;
  }
}

const bearer = (key: string) => ({ Authorization: `Bearer ${key}` });

/* ------------------------------------------------------- reading loose JSON */

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function str(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

/**
 * A logo URL out of an account payload, if there is one.
 *
 * Six providers, six schemas, and only two of them are pinned down: Polar's
 * organization carries `avatar_url` and a LemonSqueezy store carries `avatar_url`.
 * Rather than hand-writing a path for the four that may or may not publish one,
 * the account object each probe *already fetched* is scanned for the handful of
 * names this field goes by. If a provider adds one tomorrow under any of them it
 * arrives for free; if it never does, nothing is invented and the startup keeps
 * its emoji.
 *
 * Two rules, both about not putting something on a page that is not a logo:
 * **https only** — an http image is blocked as mixed content and a `data:` or
 * `javascript:` string in a provider payload has no business in an `<img>` — and
 * **no recursion**, so a customer avatar three levels down a subscription cannot
 * be mistaken for the account's own mark.
 */
const LOGO_KEYS = [
  "avatar_url",
  "avatarUrl",
  "logo_url",
  "logoUrl",
  "icon_url",
  "iconUrl",
  "image_url",
  "imageUrl",
  "logo",
  "icon",
  "image",
] as const;

function pickLogo(...records: Array<Record<string, unknown>>): string | undefined {
  for (const record of records) {
    for (const key of LOGO_KEYS) {
      const value = str(record[key]);
      if (value && value.startsWith("https://")) return value;
    }
  }
  return undefined;
}

/** The first array under any of `keys`, for payloads that disagree on the name. */
function listUnder(payload: unknown, keys: string[]): unknown[] {
  if (Array.isArray(payload)) return payload;
  const record = asRecord(payload);
  for (const key of keys) {
    if (Array.isArray(record[key])) return record[key] as unknown[];
  }
  return [];
}

function countFrom(payload: unknown, items: unknown[]): string | undefined {
  const record = asRecord(payload);
  const pagination = asRecord(record.pagination);
  const total =
    typeof pagination.total_count === "number"
      ? pagination.total_count
      : typeof record.total_count === "number"
        ? (record.total_count as number)
        : undefined;

  if (typeof total === "number") {
    return `${total.toLocaleString()} subscription${total === 1 ? "" : "s"} visible`;
  }
  if (items.length) return "subscriptions visible";
  return "no subscriptions on this account yet";
}

/* ------------------------------------------------------------------- probes */

async function probeStripe(credentials: Credentials): Promise<ProviderProbe> {
  const key = credentials.apiKey!;
  const providerName = "Stripe";
  const scopeHint =
    "The key needs Read on Charges, Customers, Subscriptions and Invoices.";

  const payload = await getJson("https://api.stripe.com/v1/subscriptions?limit=1", {
    headers: bearer(key),
    providerName,
    scopeHint,
  });
  const items = asArray(asRecord(payload).data);

  // A restricted key is usually not allowed to read the account itself, so the
  // label is asked for separately and its refusal is not a failure.
  const account = await optional(() =>
    getJson("https://api.stripe.com/v1/account", { headers: bearer(key), providerName, soft: true }),
  );
  const accountRecord = asRecord(account);
  const label =
    str(asRecord(accountRecord.business_profile).name) ??
    str(asRecord(asRecord(accountRecord.settings).dashboard).display_name) ??
    str(accountRecord.id) ??
    "Stripe account";

  /*
    No logo from Stripe, on purpose rather than by omission. `settings.branding`
    holds `icon` and `logo`, but both are *file IDs*: turning one into a URL means
    creating a file link, which is a write, and this key is deliberately read-only.
    The File object's own `url` needs the secret key to fetch, so it cannot go in
    an `<img>` either. A Stripe startup keeps its emoji.
  */
  return {
    accountLabel: label,
    detail: countFrom(payload, items),
    environment: key.startsWith("rk_test_") ? "test" : "live",
  };
}

async function probePolar(credentials: Credentials): Promise<ProviderProbe> {
  const key = credentials.apiKey!;
  const organizationId = credentials.organizationId!;
  const providerName = "Polar";
  const scopeHint = "The token needs orders:read, subscriptions:read and organizations:read.";

  const hosts: Array<{ base: string; environment: "live" | "test" }> = [
    { base: "https://api.polar.sh", environment: "live" },
    { base: "https://sandbox-api.polar.sh", environment: "test" },
  ];

  let lastError: ProviderError | null = null;

  for (const host of hosts) {
    try {
      // Named rather than listed: the token may see several organizations, and
      // asking for *this* one is what turns a wrong identifier into a 404 here
      // instead of into somebody else's revenue on the plot.
      const organization = await getJson(
        `${host.base}/v1/organizations/${encodeURIComponent(organizationId)}`,
        { headers: bearer(key), providerName, scopeHint },
      );

      const payload = await getJson(
        `${host.base}/v1/subscriptions?organization_id=${encodeURIComponent(organizationId)}&limit=1`,
        { headers: bearer(key), providerName, scopeHint },
      );
      const items = listUnder(payload, ["items", "data"]);

      const record = asRecord(organization);

      return {
        accountLabel: str(record.name) ?? str(record.slug) ?? "Polar organization",
        // Documented on the organization object, and the same image Polar shows
        // on this business's checkout and customer portal.
        logoUrl: pickLogo(record),
        detail: countFrom(payload, items),
        environment: host.environment,
      };
    } catch (error) {
      lastError = error instanceof ProviderError ? error : new ProviderError(String(error));
      // A rejected token and an unknown organization are both what a *sandbox*
      // pair looks like when it is asked of production, so both are worth
      // re-asking the other environment. Anything else is a real answer.
      if (lastError.status !== 401 && lastError.status !== 404) throw lastError;
    }
  }

  throw (
    lastError ??
    new ProviderError("Polar rejected the token, or has no organization with that identifier.")
  );
}

async function probeLemonSqueezy(credentials: Credentials): Promise<ProviderProbe> {
  const key = credentials.apiKey!;
  const providerName = "LemonSqueezy";
  const headers = {
    ...bearer(key),
    // The API is JSON:API, and it is strict about both of these.
    Accept: "application/vnd.api+json",
    "Content-Type": "application/vnd.api+json",
  };

  const me = await getJson("https://api.lemonsqueezy.com/v1/users/me", {
    headers,
    providerName,
  });
  const attributes = asRecord(asRecord(asRecord(me).data).attributes);

  // The key that can read the user is not necessarily the key that can read the
  // money, so the thing we will actually refresh from is what gets checked.
  const subscriptions = await getJson(
    "https://api.lemonsqueezy.com/v1/subscriptions?page[size]=1",
    { headers, providerName, scopeHint: "The key needs access to your store's subscriptions." },
  );
  const items = listUnder(subscriptions, ["data"]);

  /*
    The *store* is the business; the user is whoever holds the key. Both objects
    carry `avatar_url`, so the store is asked for first and the user is the
    fallback — a personal avatar is a better mark than none, and a wrong one is
    impossible here because a key sees only its own account.
  */
  const store = await optional(() =>
    getJson("https://api.lemonsqueezy.com/v1/stores?page[size]=1", {
      headers,
      providerName,
      soft: true,
    }),
  );
  const storeAttributes = asRecord(asRecord(listUnder(asRecord(store).data, [])[0]).attributes);

  return {
    accountLabel: str(attributes.name) ?? str(attributes.email) ?? "LemonSqueezy account",
    logoUrl: pickLogo(storeAttributes, attributes),
    detail: countFrom(asRecord(subscriptions).meta ?? subscriptions, items),
    environment: "live",
  };
}

async function probeDodoPayments(credentials: Credentials): Promise<ProviderProbe> {
  const key = credentials.apiKey!;
  const providerName = "DodoPayment";

  const hosts: Array<{ base: string; environment: "live" | "test" }> = [
    { base: "https://live.dodopayments.com", environment: "live" },
    { base: "https://test.dodopayments.com", environment: "test" },
  ];

  let lastError: ProviderError | null = null;

  for (const host of hosts) {
    try {
      const payload = await getJson(`${host.base}/subscriptions?page_size=1`, {
        headers: bearer(key),
        providerName,
        scopeHint: "The key needs read access to subscriptions.",
      });
      const items = listUnder(payload, ["items", "data"]);

      // Dodo publishes no business object this key is documented to read, so the
      // subscription payload's own business block is scanned and usually empty.
      const business = asRecord(asRecord(items[0]).business ?? asRecord(payload).business);

      return {
        accountLabel: host.environment === "live" ? "DodoPayment (live)" : "DodoPayment (test mode)",
        logoUrl: pickLogo(business),
        detail: countFrom(payload, items),
        environment: host.environment,
      };
    } catch (error) {
      lastError = error instanceof ProviderError ? error : new ProviderError(String(error));
      if (lastError.status !== 401) throw lastError;
    }
  }

  throw lastError ?? new ProviderError("DodoPayment rejected the key.");
}

async function probeRevenueCat(credentials: Credentials): Promise<ProviderProbe> {
  const key = credentials.apiKey!;
  const projectId = credentials.projectId!;
  const shareUrl = credentials.shareUrl;
  const providerName = "RevenueCat";
  const headers = bearer(key);

  const project = await getJson(`https://api.revenuecat.com/v2/projects/${encodeURIComponent(projectId)}`, {
    headers,
    providerName,
    scopeHint: "The V2 secret key needs Read on project, charts and metrics.",
  });

  // The overview is the endpoint a refresh will read, so it is the one that has
  // to work — not merely the one that names the project.
  const overview = await getJson(
    `https://api.revenuecat.com/v2/projects/${encodeURIComponent(projectId)}/metrics/overview`,
    { headers, providerName, scopeHint: "The key needs the 'metrics' read permission." },
  );

  const metrics = listUnder(asRecord(overview).metrics ?? overview, ["metrics", "data"]);
  const mrr = metrics
    .map(asRecord)
    .find((metric) => str(metric.id) === "mrr" || str(metric.name)?.toLowerCase() === "mrr");
  const mrrValue = typeof asRecord(mrr).value === "number" ? (asRecord(mrr).value as number) : null;

  // The share URL is the public half of this connection. If it 404s the page is
  // not published, and that is worth saying now rather than after saving.
  if (shareUrl) {
    const reachable = await optional(async () => {
      const response = await fetch(shareUrl, {
        method: "GET",
        redirect: "follow",
        signal: AbortSignal.timeout(TIMEOUT_MS),
        cache: "no-store",
      });
      return response.status;
    });
    if (reachable === 404) {
      throw new ProviderError(
        "That verified-metrics page does not exist yet. Enable 'Verified Metrics' under Project Settings > Share, then paste the slug again.",
      );
    }
  }

  return {
    accountLabel: str(asRecord(project).name) ?? `RevenueCat project ${projectId}`,
    logoUrl: pickLogo(asRecord(project)),
    detail:
      mrrValue !== null
        ? `MRR reported as ${mrrValue.toLocaleString(undefined, { style: "currency", currency: "USD", maximumFractionDigits: 0 })}`
        : "metrics readable",
    environment: "live",
  };
}

/**
 * Superwall's hierarchy is organization → projects → applications, and the
 * dialog needs the applications. The payload's exact field names are not fixed
 * by a published schema, so both levels are read for whichever of `id`/`name`
 * they carry, and a project with no applications stands as an option itself.
 */
function readSuperwallOptions(payload: unknown): RemoteOption[] {
  const projects = listUnder(payload, ["projects", "data", "items", "results"]);
  const options: RemoteOption[] = [];

  for (const entry of projects) {
    const project = asRecord(entry);
    const projectName = str(project.name) ?? str(project.slug) ?? str(project.id) ?? "Project";
    const applications = listUnder(project.applications ?? project.apps, [
      "applications",
      "apps",
      "data",
      "items",
    ]);

    if (!applications.length) {
      const id = str(project.id);
      if (id) options.push({ id, label: projectName, logoUrl: pickLogo(project) });
      continue;
    }

    for (const candidate of applications) {
      const application = asRecord(candidate);
      const id = str(application.id) ?? str(application.application_id);
      if (!id) continue;
      options.push({
        id,
        label: str(application.name) ?? str(application.slug) ?? id,
        group: projectName,
        // An application icon if this payload happens to carry one; Superwall's
        // shape is not fixed by a published schema, so it is read, not assumed.
        logoUrl: pickLogo(application, project),
      });
    }
  }

  return options;
}

async function fetchSuperwallOptions(key: string): Promise<RemoteOption[]> {
  const payload = await getJson("https://api.superwall.com/v2/projects", {
    headers: bearer(key),
    providerName: "Superwall",
    scopeHint: "The organization key needs READ access for all scopes.",
  });
  return readSuperwallOptions(payload);
}

async function probeSuperwall(credentials: Credentials): Promise<ProviderProbe> {
  const options = await fetchSuperwallOptions(credentials.apiKey!);
  const applicationId = credentials.applicationId;

  if (!options.length) {
    throw new ProviderError(
      "That key works, but Superwall returned no applications for this organization.",
    );
  }

  const chosen = options.find((option) => option.id === applicationId);
  if (!chosen) {
    throw new ProviderError("Pick one of the applications this key can see.");
  }

  return {
    accountLabel: chosen.group ? `${chosen.group} · ${chosen.label}` : chosen.label,
    logoUrl: chosen.logoUrl,
    detail: `${options.length} application${options.length === 1 ? "" : "s"} visible to this key`,
    environment: "live",
  };
}

/* ------------------------------------------------------------------ surface */

const PROBES: Record<RevenueProviderId, (credentials: Credentials) => Promise<ProviderProbe>> = {
  stripe: probeStripe,
  polar: probePolar,
  lemonsqueezy: probeLemonSqueezy,
  dodopayments: probeDodoPayments,
  revenuecat: probeRevenueCat,
  superwall: probeSuperwall,
};

/**
 * Ask a provider whether this credential works. Throws `ProviderError` with a
 * message written for the person holding the key.
 */
export function probeProvider(
  providerId: RevenueProviderId,
  credentials: Credentials,
): Promise<ProviderProbe> {
  return PROBES[providerId](credentials);
}

/** The options behind a `remote-select` step. Only Superwall has one today. */
export async function fetchRemoteOptions(
  providerId: RevenueProviderId,
  apiKey: string,
): Promise<RemoteOption[]> {
  if (providerId === "superwall") return fetchSuperwallOptions(apiKey);
  throw new ProviderError(`${REVENUE_PROVIDERS[providerId].name} has nothing to look up.`);
}
