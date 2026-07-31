import "server-only";
import crypto from "crypto";
import type { ProviderKey } from "@/lib/integrations-catalog";

// Server-side OAuth wiring. Each provider becomes "live" only when its app
// credentials are present in the environment — so the Integrations tab shows
// "Coming soon" until you register the Placid app and set the keys.

const GRAPH = "https://graph.facebook.com/v21.0";

type OAuthConfig = {
  clientIdEnv: string;
  clientSecretEnv: string;
  authUrl: string;
  tokenUrl: string;
  scope: string;
  /** How the token endpoint is called: Meta takes query params on a GET-style
   *  URL; Google takes a POST form body; Square takes a POST JSON body. */
  tokenStyle?: "query" | "post" | "json";
  /** Extra params appended to the consent URL (e.g. Google's offline access). */
  authParams?: Record<string, string>;
  /** Extra headers on the token request (e.g. Square-Version). */
  tokenHeaders?: Record<string, string>;
  /** Square configures the redirect URL in its app dashboard and rejects it as
   *  a consent-URL param — omit it there. */
  omitRedirectInAuth?: boolean;
  /** Send client id/secret as HTTP Basic auth on the token request instead of in
   *  the body (eBay). */
  authHeaderBasic?: boolean;
  /** Use this env value as the redirect_uri instead of our callback URL — eBay
   *  uses a "RuName" that maps to the real callback in its dev portal. */
  redirectUriEnv?: string;
  /** Fully custom flow for platforms that don't do standard OAuth2 (TikTok Shop). */
  flavor?: "tiktok";
  /** TikTok Shop service id (env name) used on its authorize URL. */
  serviceIdEnv?: string;
  /** Fetch a human label (page/account name/email) for display, given the token. */
  fetchLabel?: (accessToken: string) => Promise<string | null>;
};

async function metaLabel(token: string): Promise<string | null> {
  try {
    const res = await fetch(`${GRAPH}/me?fields=name&access_token=${encodeURIComponent(token)}`);
    if (!res.ok) return null;
    const json = (await res.json()) as { name?: string };
    return json.name ?? null;
  } catch {
    return null;
  }
}

async function googleEmail(token: string): Promise<string | null> {
  try {
    const res = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return null;
    const json = (await res.json()) as { email?: string };
    return json.email ?? null;
  } catch {
    return null;
  }
}

const GOOGLE_AUTH = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN = "https://oauth2.googleapis.com/token";
// Gmail, Google Calendar and Google Business all share ONE Google Cloud app
// (same client id/secret) — only the requested scopes differ.
const GOOGLE_ID_ENV = "GOOGLE_CLIENT_ID";
const GOOGLE_SECRET_ENV = "GOOGLE_CLIENT_SECRET";
const GOOGLE_OFFLINE = { access_type: "offline", prompt: "consent", include_granted_scopes: "true" };

// Square uses the merchant's own OAuth. One Placid Connect Square app; each business
// signs into their own Square account. Sandbox vs production via SQUARE_ENV.
const SQUARE_BASE =
  process.env.SQUARE_ENV === "sandbox" ? "https://connect.squareupsandbox.com" : "https://connect.squareup.com";
const SQUARE_VERSION = "2024-10-17";

async function squareLabel(token: string): Promise<string | null> {
  try {
    const res = await fetch(`${SQUARE_BASE}/v2/merchants`, {
      headers: { Authorization: `Bearer ${token}`, "Square-Version": SQUARE_VERSION },
    });
    if (!res.ok) return null;
    const json = (await res.json()) as { merchant?: { business_name?: string }[] };
    return json.merchant?.[0]?.business_name ?? "Square account";
  } catch {
    return null;
  }
}

async function stripeLabel(token: string): Promise<string | null> {
  try {
    // The connected account's own key → fetch its account profile.
    const res = await fetch("https://api.stripe.com/v1/account", { headers: { Authorization: `Bearer ${token}` } });
    if (!res.ok) return null;
    const json = (await res.json()) as { business_profile?: { name?: string }; email?: string };
    return json.business_profile?.name || json.email || "Stripe account";
  } catch {
    return null;
  }
}

/** Provider-specific non-secret ids worth keeping on the connection (for API calls). */
export function connectionMeta(provider: string, raw: unknown): Record<string, unknown> {
  const r = (raw ?? {}) as Record<string, unknown>;
  if (provider === "STRIPE") return { stripeUserId: r.stripe_user_id, publishableKey: r.stripe_publishable_key };
  if (provider === "SQUARE") return { merchantId: r.merchant_id };
  return {};
}

// Facebook + Instagram share ONE Meta app (same App ID/Secret, different scopes).
export const OAUTH: Partial<Record<ProviderKey, OAuthConfig>> = {
  FACEBOOK: {
    clientIdEnv: "FACEBOOK_APP_ID",
    clientSecretEnv: "FACEBOOK_APP_SECRET",
    authUrl: "https://www.facebook.com/v21.0/dialog/oauth",
    tokenUrl: `${GRAPH}/oauth/access_token`,
    scope: "pages_show_list,pages_messaging,pages_manage_metadata,pages_read_engagement,business_management",
    tokenStyle: "query",
    fetchLabel: metaLabel,
  },
  INSTAGRAM: {
    clientIdEnv: "FACEBOOK_APP_ID",
    clientSecretEnv: "FACEBOOK_APP_SECRET",
    authUrl: "https://www.facebook.com/v21.0/dialog/oauth",
    tokenUrl: `${GRAPH}/oauth/access_token`,
    scope: "instagram_basic,instagram_manage_messages,pages_show_list,pages_manage_metadata,business_management",
    tokenStyle: "query",
    fetchLabel: metaLabel,
  },
  GOOGLE_CALENDAR: {
    clientIdEnv: GOOGLE_ID_ENV,
    clientSecretEnv: GOOGLE_SECRET_ENV,
    authUrl: GOOGLE_AUTH,
    tokenUrl: GOOGLE_TOKEN,
    scope: "https://www.googleapis.com/auth/calendar.events openid email",
    tokenStyle: "post",
    authParams: GOOGLE_OFFLINE,
    fetchLabel: googleEmail,
  },
  SQUARE: {
    clientIdEnv: "SQUARE_APP_ID",
    clientSecretEnv: "SQUARE_APP_SECRET",
    authUrl: `${SQUARE_BASE}/oauth2/authorize`,
    tokenUrl: `${SQUARE_BASE}/oauth2/token`,
    scope: "MERCHANT_PROFILE_READ PAYMENTS_WRITE PAYMENTS_READ ORDERS_READ ORDERS_WRITE",
    tokenStyle: "json",
    tokenHeaders: { "Square-Version": SQUARE_VERSION },
    authParams: { session: "false" },
    omitRedirectInAuth: true,
    fetchLabel: squareLabel,
  },
  STRIPE: {
    // Stripe Connect (Standard) — "Connect with Stripe" one-click. clientId is
    // the platform's Connect client id (ca_…); secret is the platform key (sk_…).
    clientIdEnv: "STRIPE_CONNECT_CLIENT_ID",
    clientSecretEnv: "STRIPE_SECRET_KEY",
    authUrl: "https://connect.stripe.com/oauth/authorize",
    tokenUrl: "https://connect.stripe.com/oauth/token",
    scope: "read_write",
    tokenStyle: "post",
    fetchLabel: stripeLabel,
  },
  EBAY: {
    // eBay OAuth: Basic-auth token exchange, and redirect_uri is a "RuName"
    // (configured in the eBay dev portal → mapped to our callback URL).
    clientIdEnv: "EBAY_CLIENT_ID",
    clientSecretEnv: "EBAY_CLIENT_SECRET",
    authUrl: "https://auth.ebay.com/oauth2/authorize",
    tokenUrl: "https://api.ebay.com/identity/v1/oauth2/token",
    scope:
      "https://api.ebay.com/oauth/api_scope https://api.ebay.com/oauth/api_scope/sell.inventory https://api.ebay.com/oauth/api_scope/sell.fulfillment",
    tokenStyle: "post",
    authHeaderBasic: true,
    redirectUriEnv: "EBAY_RUNAME",
  },
  TIKTOK: {
    // TikTok Shop uses app_key/app_secret + a service_id on authorize, and a
    // non-standard token endpoint — handled by the "tiktok" flavor below.
    clientIdEnv: "TIKTOK_APP_KEY",
    clientSecretEnv: "TIKTOK_APP_SECRET",
    authUrl: "https://services.tiktokshop.com/open/authorize",
    tokenUrl: "https://auth.tiktok-shops.com/api/v2/token/get",
    scope: "",
    flavor: "tiktok",
    serviceIdEnv: "TIKTOK_SERVICE_ID",
  },
};

export function oauthConfig(provider: string): OAuthConfig | undefined {
  return OAUTH[provider as ProviderKey];
}

/** A provider's OAuth is usable only once its app keys are configured. */
export function isConfigured(provider: string): boolean {
  const c = OAUTH[provider as ProviderKey];
  return Boolean(c && process.env[c.clientIdEnv] && process.env[c.clientSecretEnv]);
}

export function appUrl(): string {
  return (process.env.APP_URL || "https://placidcrm.com").replace(/\/$/, "");
}

export function redirectUri(provider: string): string {
  return `${appUrl()}/api/integrations/${provider.toLowerCase()}/callback`;
}

// ---- Signed state (CSRF + carries the locationId across the round-trip) ------

function stateSecret(): string {
  return process.env.AUTH_SECRET || "";
}

export function signState(payload: Record<string, string>): string {
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const sig = crypto.createHmac("sha256", stateSecret()).update(body).digest("base64url");
  return `${body}.${sig}`;
}

export function verifyState(state: string): Record<string, string> | null {
  const [body, sig] = state.split(".");
  if (!body || !sig) return null;
  const expected = crypto.createHmac("sha256", stateSecret()).update(body).digest("base64url");
  try {
    if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
  } catch {
    return null;
  }
  try {
    return JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
  } catch {
    return null;
  }
}

/** Build the provider consent URL to send the client to. */
export function buildAuthUrl(provider: string, state: string): string | null {
  const c = OAUTH[provider as ProviderKey];
  if (!c) return null;

  // TikTok Shop: authorize takes just the service_id (+ our state for CSRF).
  if (c.flavor === "tiktok") {
    const p = new URLSearchParams({ service_id: process.env[c.serviceIdEnv ?? ""] ?? "", state });
    return `${c.authUrl}?${p.toString()}`;
  }

  const params = new URLSearchParams({
    client_id: process.env[c.clientIdEnv] ?? "",
    scope: c.scope,
    response_type: "code",
    state,
    ...(c.authParams ?? {}),
  });
  // eBay sends its RuName as the redirect_uri value; Square omits it entirely.
  const redirect = c.redirectUriEnv ? process.env[c.redirectUriEnv] : c.omitRedirectInAuth ? undefined : redirectUri(provider);
  if (redirect) params.set("redirect_uri", redirect);
  return `${c.authUrl}?${params.toString()}`;
}

type RawToken = { access_token?: string; refresh_token?: string; expires_in?: number; expires_at?: string };

function toTokenSet(json: RawToken): TokenSet | null {
  if (!json.access_token) return null;
  const expiresAt = json.expires_in
    ? Date.now() + json.expires_in * 1000
    : json.expires_at
    ? Date.parse(json.expires_at) || undefined
    : undefined;
  return { accessToken: json.access_token, refreshToken: json.refresh_token, expiresAt, raw: json };
}

export type TokenSet = {
  accessToken: string;
  refreshToken?: string;
  /** Absolute expiry time (ms since epoch), when the provider tells us. */
  expiresAt?: number;
  raw: unknown;
};

function basicAuth(c: OAuthConfig): string {
  return "Basic " + Buffer.from(`${process.env[c.clientIdEnv] ?? ""}:${process.env[c.clientSecretEnv] ?? ""}`).toString("base64");
}

// Providers whose client secret can be set from the admin UI (encrypted Setting
// store) instead of server env — so a super-admin can connect an OAuth app
// without SSH. Dynamic import keeps the server-only settings module out of any
// client bundle that imports this file's types.
const SECRET_SETTING_KEY: Record<string, string> = { EBAY: "ebay_client_secret" };

async function clientSecret(provider: string, c: OAuthConfig): Promise<string> {
  const key = SECRET_SETTING_KEY[provider];
  if (key) {
    try {
      const { getSetting } = await import("@/lib/platform-settings");
      const v = await getSetting(key);
      if (v) return v;
    } catch {
      /* fall back to env */
    }
  }
  return process.env[c.clientSecretEnv] || "";
}

async function basicAuthAsync(provider: string, c: OAuthConfig): Promise<string> {
  const secret = await clientSecret(provider, c);
  return "Basic " + Buffer.from(`${process.env[c.clientIdEnv] ?? ""}:${secret}`).toString("base64");
}

/** Like isConfigured, but also honours a secret stored in the admin settings. */
export async function isConfiguredAsync(provider: string): Promise<boolean> {
  const c = OAUTH[provider as ProviderKey];
  if (!c || !process.env[c.clientIdEnv]) return false;
  return Boolean(await clientSecret(provider, c));
}

/** TikTok Shop returns tokens nested under `data`, with epoch-second expiries. */
function tiktokTokenSet(json: unknown): TokenSet | null {
  const d = ((json as { data?: Record<string, unknown> })?.data ?? {}) as Record<string, unknown>;
  const access = typeof d.access_token === "string" ? d.access_token : "";
  if (!access) return null;
  const exp = Number(d.access_token_expire_in);
  return {
    accessToken: access,
    refreshToken: typeof d.refresh_token === "string" ? d.refresh_token : undefined,
    expiresAt: Number.isFinite(exp) && exp > 0 ? exp * 1000 : undefined,
    raw: json,
  };
}

/** Redirect_uri value for a provider (RuName env for eBay, else our callback). */
function redirectValue(provider: string, c: OAuthConfig): string | undefined {
  if (c.redirectUriEnv) return process.env[c.redirectUriEnv];
  return c.omitRedirectInAuth ? undefined : redirectUri(provider);
}

/** Exchange an auth code for a token set (access + optional refresh/expiry). */
export async function exchangeCode(provider: string, code: string): Promise<TokenSet | null> {
  const c = OAUTH[provider as ProviderKey];
  if (!c) return null;

  // TikTok Shop: GET token endpoint with app_key/app_secret/auth_code.
  if (c.flavor === "tiktok") {
    const p = new URLSearchParams({
      app_key: process.env[c.clientIdEnv] ?? "",
      app_secret: process.env[c.clientSecretEnv] ?? "",
      auth_code: code,
      grant_type: "authorized_code",
    });
    const res = await fetch(`${c.tokenUrl}?${p.toString()}`);
    if (!res.ok) return null;
    return tiktokTokenSet(await res.json());
  }

  const fields: Record<string, string> = { code, grant_type: "authorization_code" };
  const redirect = redirectValue(provider, c);
  if (redirect) fields.redirect_uri = redirect;
  const extraHeaders: Record<string, string> = {};
  if (c.authHeaderBasic) {
    extraHeaders.Authorization = await basicAuthAsync(provider, c);
  } else {
    fields.client_id = process.env[c.clientIdEnv] ?? "";
    fields.client_secret = await clientSecret(provider, c);
  }

  let res: Response;
  if (c.tokenStyle === "json") {
    res = await fetch(c.tokenUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(c.tokenHeaders ?? {}), ...extraHeaders },
      body: JSON.stringify(fields),
    });
  } else if (c.tokenStyle === "post") {
    res = await fetch(c.tokenUrl, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded", ...extraHeaders },
      body: new URLSearchParams(fields).toString(),
    });
  } else {
    res = await fetch(`${c.tokenUrl}?${new URLSearchParams(fields).toString()}`, { headers: extraHeaders });
  }
  if (!res.ok) return null;
  return toTokenSet((await res.json()) as RawToken);
}

/** Trade a refresh token for a fresh access token. */
export async function refreshToken(provider: string, refresh: string): Promise<TokenSet | null> {
  const c = OAUTH[provider as ProviderKey];
  if (!c) return null;

  // TikTok Shop: GET refresh endpoint with app_key/app_secret.
  if (c.flavor === "tiktok") {
    const p = new URLSearchParams({
      app_key: process.env[c.clientIdEnv] ?? "",
      app_secret: process.env[c.clientSecretEnv] ?? "",
      refresh_token: refresh,
      grant_type: "refresh_token",
    });
    const res = await fetch(`${c.tokenUrl}?${p.toString()}`);
    if (!res.ok) return null;
    const set = tiktokTokenSet(await res.json());
    return set ? { ...set, refreshToken: set.refreshToken ?? refresh } : null;
  }

  const fields: Record<string, string> = { refresh_token: refresh, grant_type: "refresh_token" };
  const extraHeaders: Record<string, string> = {};
  if (c.authHeaderBasic) {
    extraHeaders.Authorization = await basicAuthAsync(provider, c);
    if (c.scope) fields.scope = c.scope; // eBay requires scope on refresh
  } else {
    fields.client_id = process.env[c.clientIdEnv] ?? "";
    fields.client_secret = await clientSecret(provider, c);
  }

  const res =
    c.tokenStyle === "json"
      ? await fetch(c.tokenUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json", ...(c.tokenHeaders ?? {}), ...extraHeaders },
          body: JSON.stringify(fields),
        })
      : await fetch(c.tokenUrl, {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded", ...extraHeaders },
          body: new URLSearchParams(fields).toString(),
        });
  if (!res.ok) return null;
  const set = toTokenSet((await res.json()) as RawToken);
  if (!set) return null;
  // Providers often omit the refresh token on refresh — keep the existing one.
  return { ...set, refreshToken: set.refreshToken ?? refresh };
}

/** Parse Meta's signed_request (used by data-deletion & deauthorize callbacks). */
export function parseSignedRequest(signed: string, appSecret: string): Record<string, unknown> | null {
  const [encodedSig, payload] = signed.split(".");
  if (!encodedSig || !payload) return null;
  const expected = crypto.createHmac("sha256", appSecret).update(payload).digest();
  const sig = Buffer.from(encodedSig, "base64");
  try {
    if (!crypto.timingSafeEqual(sig, expected)) return null;
  } catch {
    return null;
  }
  try {
    return JSON.parse(Buffer.from(payload, "base64").toString("utf8"));
  } catch {
    return null;
  }
}
