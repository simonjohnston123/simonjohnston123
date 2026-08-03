import "server-only";

import { prisma } from "@/lib/db";
import { encryptJson, decryptJson } from "@/lib/crypto";
import { refreshToken } from "@/lib/oauth-providers";
import type { Connection } from "@prisma/client";

// Two-way Google Calendar sync.
//
//  Outbound  — when a Placid appointment is created/cancelled we mirror it to
//              the operator's Google Calendar (so it shows on their phone).
//  Inbound   — we pull the operator's Google events into ExternalBusy so the
//              public slot engine won't offer times they're already committed.
//
// Everything here is BEST-EFFORT and fail-soft: if Google is unreachable, the
// token is bad, or the business hasn't connected, bookings still work normally.

const PROVIDER = "GOOGLE_CALENDAR" as const;
const API = "https://www.googleapis.com/calendar/v3";
const BUSY_SYNC_THROTTLE_MS = 3 * 60 * 1000; // don't re-pull more than every 3 min
const BUSY_WINDOW_DAYS = 45;

type StoredTokens = { accessToken: string; refreshToken?: string; expiresAt?: number };
type ConnMeta = { calendarId?: string; lastBusySyncAt?: number };

/** The CONNECTED calendar connection for a location, or null.
 *  Prefers the legacy dedicated GOOGLE_CALENDAR connection; otherwise falls
 *  back to the unified GOOGLE connection (one Google login covering every
 *  service), provided the business granted the calendar scope. */
async function getConnection(locationId: string): Promise<Connection | null> {
  const dedicated = await prisma.connection.findFirst({
    where: { locationId, provider: PROVIDER, status: "CONNECTED" },
  });
  if (dedicated) return dedicated;

  const unified = await prisma.connection.findFirst({
    where: { locationId, provider: "GOOGLE", status: "CONNECTED" },
  });
  if (!unified) return null;
  const services = ((unified.meta ?? {}) as { services?: string[] }).services ?? [];
  return services.includes("calendar") ? unified : null;
}

function calendarId(conn: Connection): string {
  return (conn.meta as unknown as ConnMeta)?.calendarId || "primary";
}

/** Return a usable access token, refreshing (and persisting) when expired. */
async function freshAccessToken(conn: Connection): Promise<string | null> {
  let tokens: StoredTokens;
  try {
    tokens = decryptJson<StoredTokens>(conn.secretCipher ?? "");
  } catch {
    return null;
  }
  const stillValid = tokens.expiresAt && Date.now() < tokens.expiresAt - 60_000;
  if (stillValid) return tokens.accessToken;
  if (!tokens.refreshToken) return tokens.accessToken || null; // no way to refresh; try as-is

  const next = await refreshToken(PROVIDER, tokens.refreshToken);
  if (!next) {
    // Refresh failed — token was revoked or the app credentials changed.
    await prisma.connection.update({ where: { id: conn.id }, data: { status: "ERROR" } }).catch(() => {});
    return null;
  }
  const merged: StoredTokens = {
    accessToken: next.accessToken,
    refreshToken: next.refreshToken ?? tokens.refreshToken,
    expiresAt: next.expiresAt,
  };
  await prisma.connection
    .update({ where: { id: conn.id }, data: { secretCipher: encryptJson(merged) } })
    .catch(() => {});
  return merged.accessToken;
}

async function gcalFetch(token: string, path: string, init?: RequestInit): Promise<Response> {
  return fetch(`${API}${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", ...(init?.headers ?? {}) },
  });
}

// --- Outbound: Placid appointment → Google event --------------------------

type ApptForSync = {
  id: string;
  title: string;
  notes: string | null;
  startAt: Date;
  endAt: Date;
  externalEventId: string | null;
};

/** Create or update the Google event mirroring a Placid appointment. */
export async function pushAppointment(locationId: string, appt: ApptForSync): Promise<void> {
  try {
    const conn = await getConnection(locationId);
    if (!conn) return;
    const token = await freshAccessToken(conn);
    if (!token) return;

    const body = JSON.stringify({
      summary: appt.title,
      description: appt.notes ?? undefined,
      start: { dateTime: appt.startAt.toISOString() },
      end: { dateTime: appt.endAt.toISOString() },
      // Tag it so the inbound pull can recognise (and skip) our own events.
      extendedProperties: { private: { placidApptId: appt.id } },
    });

    const cal = encodeURIComponent(calendarId(conn));
    if (appt.externalEventId) {
      const res = await gcalFetch(token, `/calendars/${cal}/events/${encodeURIComponent(appt.externalEventId)}`, {
        method: "PATCH",
        body,
      });
      if (res.ok) return;
      if (res.status !== 404 && res.status !== 410) return; // real error → give up quietly
      // Event vanished on Google's side — fall through and recreate it.
    }

    const res = await gcalFetch(token, `/calendars/${cal}/events`, { method: "POST", body });
    if (!res.ok) return;
    const json = (await res.json()) as { id?: string };
    if (json.id) {
      await prisma.appointment
        .update({ where: { id: appt.id }, data: { externalEventId: json.id } })
        .catch(() => {});
    }
  } catch {
    /* fail-soft */
  }
}

/** Remove the Google event for a cancelled/deleted appointment. */
export async function deleteAppointmentEvent(locationId: string, externalEventId: string | null): Promise<void> {
  if (!externalEventId) return;
  try {
    const conn = await getConnection(locationId);
    if (!conn) return;
    const token = await freshAccessToken(conn);
    if (!token) return;
    const cal = encodeURIComponent(calendarId(conn));
    await gcalFetch(token, `/calendars/${cal}/events/${encodeURIComponent(externalEventId)}`, { method: "DELETE" });
  } catch {
    /* fail-soft */
  }
}

// --- Inbound: Google events → ExternalBusy --------------------------------

type GEvent = {
  id: string;
  status?: string;
  summary?: string;
  transparency?: string; // "transparent" = marked Free
  start?: { dateTime?: string; date?: string };
  end?: { dateTime?: string; date?: string };
  extendedProperties?: { private?: Record<string, string> };
};

/**
 * Pull the operator's upcoming Google events into ExternalBusy so they block
 * public booking slots. Throttled per-connection; pass force to bypass.
 * Returns true if a sync actually ran.
 */
export async function syncBusy(locationId: string, opts: { force?: boolean } = {}): Promise<boolean> {
  try {
    const conn = await getConnection(locationId);
    if (!conn) return false;

    const meta = (conn.meta as unknown as ConnMeta) ?? {};
    if (!opts.force && meta.lastBusySyncAt && Date.now() - meta.lastBusySyncAt < BUSY_SYNC_THROTTLE_MS) {
      return false;
    }

    const token = await freshAccessToken(conn);
    if (!token) return false;

    const now = new Date();
    const timeMax = new Date(now.getTime() + BUSY_WINDOW_DAYS * 86400000);
    const cal = encodeURIComponent(calendarId(conn));

    const events: GEvent[] = [];
    let pageToken: string | undefined;
    let guard = 0;
    do {
      const params = new URLSearchParams({
        timeMin: now.toISOString(),
        timeMax: timeMax.toISOString(),
        singleEvents: "true",
        orderBy: "startTime",
        maxResults: "250",
        showDeleted: "false",
      });
      if (pageToken) params.set("pageToken", pageToken);
      const res = await gcalFetch(token, `/calendars/${cal}/events?${params.toString()}`);
      if (!res.ok) break;
      const json = (await res.json()) as { items?: GEvent[]; nextPageToken?: string };
      for (const e of json.items ?? []) events.push(e);
      pageToken = json.nextPageToken;
      guard += 1;
    } while (pageToken && guard < 10);

    // Keep only real, timed, opaque commitments that aren't our own bookings.
    const busy = events
      .filter((e) => e.status !== "cancelled")
      .filter((e) => e.transparency !== "transparent")
      .filter((e) => !e.extendedProperties?.private?.placidApptId)
      .map((e) => ({
        externalId: e.id,
        summary: e.summary ?? null,
        start: e.start?.dateTime ? new Date(e.start.dateTime) : null,
        end: e.end?.dateTime ? new Date(e.end.dateTime) : null,
      }))
      .filter((e): e is { externalId: string; summary: string | null; start: Date; end: Date } =>
        Boolean(e.start && e.end && !Number.isNaN(e.start!.getTime()) && !Number.isNaN(e.end!.getTime())),
      );

    // Replace the window: drop what we had, insert the fresh set. Simpler and
    // more correct than diffing, and the window is small.
    await prisma.$transaction([
      prisma.externalBusy.deleteMany({
        where: { locationId, provider: PROVIDER, startAt: { gte: now, lt: timeMax } },
      }),
      ...(busy.length
        ? [
            prisma.externalBusy.createMany({
              data: busy.map((b) => ({
                locationId,
                provider: PROVIDER,
                externalId: b.externalId,
                startAt: b.start,
                endAt: b.end,
                summary: b.summary,
              })),
              skipDuplicates: true,
            }),
          ]
        : []),
    ]);

    await prisma.connection
      .update({ where: { id: conn.id }, data: { meta: { ...meta, lastBusySyncAt: Date.now() } } })
      .catch(() => {});
    return true;
  } catch {
    return false;
  }
}

/** Busy blocks (external commitments) overlapping a window, as clash intervals. */
export async function externalBusyForCalendar(
  locationId: string,
  from: Date,
  to: Date,
): Promise<{ startAt: Date; endAt: Date }[]> {
  try {
    return await prisma.externalBusy.findMany({
      where: { locationId, endAt: { gte: from }, startAt: { lt: to } },
      select: { startAt: true, endAt: true },
    });
  } catch {
    return [];
  }
}
