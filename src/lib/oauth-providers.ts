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
   *  URL; Google (and most OAuth2 servers) take a POST form body. */
  tokenStyle?: "query" | "post";
  /** Extra params appended to the consent URL (e.g. Google's offline access). */
  authParams?: Record<string, string>;
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
    redirect_uri: redirectUri(provider),
    scope: c.scope,
    response_type: "code",
    state,
    ...(c.authParams ?? {}),
  });
  return `${c.authUrl}?${params.toString()}`;
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
  const params = new URLSearchParams({
    client_id: process.env[c.clientIdEnv] ?? "",
    client_secret: process.env[c.clientSecretEnv] ?? "",
    redirect_uri: redirectUri(provider),
    code,
    grant_type: "authorization_code",
  });
  const res =
    c.tokenStyle === "post"
      ? await fetch(c.tokenUrl, {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: params.toString(),
        })
      : await fetch(`${c.tokenUrl}?${params.toString()}`);
  if (!res.ok) return null;
  const json = (await res.json()) as { access_token?: string; refresh_token?: string; expires_in?: number };
  if (!json.access_token) return null;
  return {
    accessToken: json.access_token,
    refreshToken: json.refresh_token,
    expiresAt: json.expires_in ? Date.now() + json.expires_in * 1000 : undefined,
    raw: json,
  };
}

/** Trade a refresh token for a fresh access token (Google-style POST). */
export async function refreshToken(provider: string, refresh: string): Promise<TokenSet | null> {
  const c = OAUTH[provider as ProviderKey];
  if (!c) return null;
  const params = new URLSearchParams({
    client_id: process.env[c.clientIdEnv] ?? "",
    client_secret: process.env[c.clientSecretEnv] ?? "",
    refresh_token: refresh,
    grant_type: "refresh_token",
  });
  const res = await fetch(c.tokenUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: params.toString(),
  });
  if (!res.ok) return null;
  const json = (await res.json()) as { access_token?: string; refresh_token?: string; expires_in?: number };
  if (!json.access_token) return null;
  return {
    accessToken: json.access_token,
    refreshToken: json.refresh_token ?? refresh, // Google usually omits it on refresh
    expiresAt: json.expires_in ? Date.now() + json.expires_in * 1000 : undefined,
    raw: json,
  };
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
