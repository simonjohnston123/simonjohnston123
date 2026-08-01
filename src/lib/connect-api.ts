import "server-only";
import { randomBytes, timingSafeEqual } from "crypto";
import { getSetting, setSetting, SETTING_KEYS } from "@/lib/platform-settings";

// The Placid CRM ⇄ Placid Connect API contract (see CRM_API_CONTRACT.md).
// Single merchant: everything is the Placid Deals catalogue.
export const CONNECT_MERCHANT_LOCATION_ID = "cms5c2jlo000h371jy00i0csk";
export const CONNECT_API_BASE = "https://placidcrm.com/api/connect";

/** The shared Bearer token Connect uses. Auto-generated + persisted on first read. */
export async function getConnectApiToken(): Promise<string> {
  let t = await getSetting(SETTING_KEYS.connectApiToken);
  if (!t) {
    t = "pck_" + randomBytes(24).toString("hex");
    await setSetting(SETTING_KEYS.connectApiToken, t);
  }
  return t;
}

/** True if the request carries the correct Bearer token. */
export async function connectAuthed(authHeader: string | null): Promise<boolean> {
  if (!authHeader) return false;
  const m = authHeader.match(/^Bearer\s+(.+)$/i);
  if (!m) return false;
  const expected = await getConnectApiToken();
  // constant-time-ish compare
  const a = Buffer.from(m[1]);
  const b = Buffer.from(expected);
  return a.length === b.length && require("crypto").timingSafeEqual(a, b);
}
