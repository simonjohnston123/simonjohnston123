import "server-only";
import { prisma } from "@/lib/db";
import { encryptJson, decryptJson } from "@/lib/crypto";

// ---------------------------------------------------------------------------
// Google for business accounts. ONE Placid-owned OAuth app (white-label); each
// business connects their own Google account once and picks which services to
// grant. Refresh tokens are stored encrypted per location.
// ---------------------------------------------------------------------------

export type GoogleServiceKey = "gmail" | "calendar" | "contacts" | "business" | "merchant" | "sheets" | "drive" | "youtube";

export const GOOGLE_SERVICES: {
  key: GoogleServiceKey; label: string; icon: string; blurb: string; scopes: string[]; tier: "basic" | "sensitive" | "restricted";
}[] = [
  {
    key: "gmail", label: "Gmail", icon: "✉️", blurb: "Send and receive email in your CRM inbox.",
    scopes: ["https://www.googleapis.com/auth/gmail.modify", "https://www.googleapis.com/auth/gmail.send"],
    tier: "restricted",
  },
  {
    key: "calendar", label: "Calendar", icon: "📅", blurb: "Two-way sync between bookings and your Google Calendar.",
    scopes: ["https://www.googleapis.com/auth/calendar", "https://www.googleapis.com/auth/calendar.events"],
    tier: "sensitive",
  },
  {
    key: "contacts", label: "Contacts", icon: "👥", blurb: "Import your Google contacts into the CRM.",
    scopes: ["https://www.googleapis.com/auth/contacts"],
    tier: "sensitive",
  },
  {
    key: "business", label: "Business Profile", icon: "📍", blurb: "Post updates and reply to Google reviews.",
    scopes: ["https://www.googleapis.com/auth/business.manage"],
    tier: "sensitive",
  },
  {
    key: "merchant", label: "Merchant Center", icon: "🛒", blurb: "Push your products to Google Shopping.",
    scopes: ["https://www.googleapis.com/auth/content"],
    tier: "sensitive",
  },
  {
    key: "sheets", label: "Sheets", icon: "📊", blurb: "Export reports and import data from spreadsheets.",
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
    tier: "sensitive",
  },
  {
    key: "drive", label: "Drive", icon: "📁", blurb: "Save documents and media to your Drive.",
    scopes: ["https://www.googleapis.com/auth/drive.file"],
    tier: "restricted",
  },
  {
    key: "youtube", label: "YouTube", icon: "▶️", blurb: "Publish videos straight from the Social Poster.",
    scopes: ["https://www.googleapis.com/auth/youtube.upload", "https://www.googleapis.com/auth/youtube.readonly"],
    tier: "sensitive",
  },
];

const BASE_SCOPES = ["openid", "email", "profile"];

export const googleReady = () => !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);

export function scopesFor(services: GoogleServiceKey[]): string[] {
  const set = new Set(BASE_SCOPES);
  for (const s of GOOGLE_SERVICES) if (services.includes(s.key)) s.scopes.forEach((x) => set.add(x));
  return [...set];
}

type GoogleSecret = { refreshToken: string };
type GoogleMeta = { email?: string; services?: GoogleServiceKey[]; scopes?: string[]; connectedAt?: string };

export function googleAuthUrl(locationId: string, services: GoogleServiceKey[]): string {
  const base = process.env.APP_URL || "https://placidcrm.com";
  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID ?? "",
    redirect_uri: `${base}/api/integrations/google/callback`,
    response_type: "code",
    access_type: "offline",
    prompt: "consent",
    include_granted_scopes: "true",
    scope: scopesFor(services).join(" "),
    state: `${locationId}|${services.join(",")}`,
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
}

/** Swap an authorisation code for tokens and save the connection. */
export async function saveGoogleConnection(code: string, locationId: string, services: GoogleServiceKey[]): Promise<{ email?: string } | null> {
  const base = process.env.APP_URL || "https://placidcrm.com";
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: process.env.GOOGLE_CLIENT_ID ?? "",
      client_secret: process.env.GOOGLE_CLIENT_SECRET ?? "",
      redirect_uri: `${base}/api/integrations/google/callback`,
      grant_type: "authorization_code",
    }),
  });
  const tok = (await res.json().catch(() => ({}))) as { access_token?: string; refresh_token?: string; scope?: string };
  if (!tok.refresh_token) return null;

  let email: string | undefined;
  try {
    const me = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", { headers: { authorization: `Bearer ${tok.access_token}` } });
    email = ((await me.json()) as { email?: string }).email;
  } catch { /* cosmetic */ }

  const meta: GoogleMeta = { email, services, scopes: (tok.scope ?? "").split(" ").filter(Boolean), connectedAt: new Date().toISOString() };
  await prisma.connection.upsert({
    where: { locationId_provider: { locationId, provider: "GOOGLE" } },
    create: { locationId, provider: "GOOGLE", status: "CONNECTED", accountLabel: email ?? "Google account", secretCipher: encryptJson({ refreshToken: tok.refresh_token } satisfies GoogleSecret), meta: meta as object },
    update: { status: "CONNECTED", accountLabel: email ?? "Google account", secretCipher: encryptJson({ refreshToken: tok.refresh_token } satisfies GoogleSecret), meta: meta as object },
  });
  return { email };
}

/** A fresh access token for this business's Google account, or null. */
export async function googleAccessToken(locationId: string): Promise<string | null> {
  const conn = await prisma.connection.findUnique({ where: { locationId_provider: { locationId, provider: "GOOGLE" } } });
  if (!conn?.secretCipher || conn.status !== "CONNECTED") return null;
  let refreshToken: string;
  try { refreshToken = decryptJson<GoogleSecret>(conn.secretCipher).refreshToken; } catch { return null; }

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID ?? "",
      client_secret: process.env.GOOGLE_CLIENT_SECRET ?? "",
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });
  const j = (await res.json().catch(() => ({}))) as { access_token?: string };
  if (!j.access_token) {
    // Revoked or expired — mark it so the UI prompts a reconnect.
    await prisma.connection.update({ where: { id: conn.id }, data: { status: "ERROR" } }).catch(() => {});
    return null;
  }
  return j.access_token;
}

export async function googleStatus(locationId: string): Promise<{ connected: boolean; email?: string; services: GoogleServiceKey[]; status?: string }> {
  const conn = await prisma.connection.findUnique({ where: { locationId_provider: { locationId, provider: "GOOGLE" } } });
  if (!conn) return { connected: false, services: [] };
  const meta = (conn.meta ?? {}) as GoogleMeta;
  return { connected: conn.status === "CONNECTED", email: meta.email, services: meta.services ?? [], status: conn.status };
}

/** Authenticated Google API call for a location. */
export async function gapi(locationId: string, url: string, init?: RequestInit): Promise<Response | null> {
  const token = await googleAccessToken(locationId);
  if (!token) return null;
  return fetch(url, { ...init, headers: { ...(init?.headers ?? {}), authorization: `Bearer ${token}` } });
}
