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

// Square uses the merchant's own OAuth. One PlacidCRM Square app; each business
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
  const params = new URLSearchParams({
    client_id: process.env[c.clientIdEnv] ?? "",
    scope: c.scope,
    response_type: "code",
    state,
    ...(c.authParams ?? {}),
  });
  if (!c.omitRedirectInAuth) params.set("redirect_uri", redirectUri(provider));
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

/** Exchange an auth code for a token set (access + optional refresh/expiry). */
export async function exchangeCode(provider: string, code: string): Promise<TokenSet | null> {
  const c = OAUTH[provider as ProviderKey];
  if (!c) return null;
  const fields: Record<string, string> = {
    client_id: process.env[c.clientIdEnv] ?? "",
    client_secret: process.env[c.clientSecretEnv] ?? "",
    code,
    grant_type: "authorization_code",
  };
  if (!c.omitRedirectInAuth) fields.redirect_uri = redirectUri(provider);

  let res: Response;
  if (c.tokenStyle === "json") {
    res = await fetch(c.tokenUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(c.tokenHeaders ?? {}) },
      body: JSON.stringify(fields),
    });
  } else if (c.tokenStyle === "post") {
    res = await fetch(c.tokenUrl, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams(fields).toString(),
    });
  } else {
    res = await fetch(`${c.tokenUrl}?${new URLSearchParams(fields).toString()}`);
  }
  if (!res.ok) return null;
  return toTokenSet((await res.json()) as RawToken);
}

/** Trade a refresh token for a fresh access token. */
export async function refreshToken(provider: string, refresh: string): Promise<TokenSet | null> {
  const c = OAUTH[provider as ProviderKey];
  if (!c) return null;
  const fields: Record<string, string> = {
    client_id: process.env[c.clientIdEnv] ?? "",
    client_secret: process.env[c.clientSecretEnv] ?? "",
    refresh_token: refresh,
    grant_type: "refresh_token",
  };
  const res =
    c.tokenStyle === "json"
      ? await fetch(c.tokenUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json", ...(c.tokenHeaders ?? {}) },
          body: JSON.stringify(fields),
        })
      : await fetch(c.tokenUrl, {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
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
