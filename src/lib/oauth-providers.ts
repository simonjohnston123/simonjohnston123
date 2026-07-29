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
  /** Fetch a human label (page/account name) for display, given the token. */
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

// Facebook + Instagram share ONE Meta app (same App ID/Secret, different scopes).
export const OAUTH: Partial<Record<ProviderKey, OAuthConfig>> = {
  FACEBOOK: {
    clientIdEnv: "FACEBOOK_APP_ID",
    clientSecretEnv: "FACEBOOK_APP_SECRET",
    authUrl: "https://www.facebook.com/v21.0/dialog/oauth",
    tokenUrl: `${GRAPH}/oauth/access_token`,
    scope: "pages_show_list,pages_messaging,pages_manage_metadata,pages_read_engagement,business_management",
    fetchLabel: metaLabel,
  },
  INSTAGRAM: {
    clientIdEnv: "FACEBOOK_APP_ID",
    clientSecretEnv: "FACEBOOK_APP_SECRET",
    authUrl: "https://www.facebook.com/v21.0/dialog/oauth",
    tokenUrl: `${GRAPH}/oauth/access_token`,
    scope: "instagram_basic,instagram_manage_messages,pages_show_list,pages_manage_metadata,business_management",
    fetchLabel: metaLabel,
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
  });
  return `${c.authUrl}?${params.toString()}`;
}

/** Exchange an auth code for an access token. */
export async function exchangeCode(provider: string, code: string): Promise<{ accessToken: string; raw: unknown } | null> {
  const c = OAUTH[provider as ProviderKey];
  if (!c) return null;
  const params = new URLSearchParams({
    client_id: process.env[c.clientIdEnv] ?? "",
    client_secret: process.env[c.clientSecretEnv] ?? "",
    redirect_uri: redirectUri(provider),
    code,
  });
  const res = await fetch(`${c.tokenUrl}?${params.toString()}`);
  if (!res.ok) return null;
  const json = (await res.json()) as { access_token?: string };
  if (!json.access_token) return null;
  return { accessToken: json.access_token, raw: json };
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
