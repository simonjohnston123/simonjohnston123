import "server-only";

// Thin Twilio REST helper for the platform's MASTER account. Businesses never
// see Twilio — numbers are provisioned under Placid's account and licensed to
// each location ("Placid Phone"), per the white-label rebilling model.

const API = "https://api.twilio.com/2010-04-01";

function creds(): { sid: string; token: string } | null {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  return sid && token ? { sid, token } : null;
}

export const twilioReady = () => !!creds();

async function tw(path: string, init?: RequestInit): Promise<Record<string, unknown>> {
  const c = creds();
  if (!c) throw new Error("Phone platform not connected yet.");
  const res = await fetch(`${API}/Accounts/${c.sid}${path}`, {
    ...init,
    headers: {
      authorization: "Basic " + Buffer.from(`${c.sid}:${c.token}`).toString("base64"),
      ...(init?.body ? { "content-type": "application/x-www-form-urlencoded" } : {}),
    },
  });
  const j = (await res.json().catch(() => ({}))) as Record<string, unknown> & { message?: string };
  if (!res.ok) throw new Error(String(j.message ?? `Twilio ${res.status}`));
  return j;
}

/** Buy a voice number and point it at the AI receptionist webhooks.
 *  Prefers an AU number; falls back to US while the AU regulatory bundle is
 *  in review (AU purchases fail until Twilio approves the bundle). */
export async function buyReceptionistNumber(friendlyName: string): Promise<{ number: string; country: string }> {
  const base = process.env.APP_URL || "https://placidcrm.com";

  async function firstAvailable(country: string): Promise<string | null> {
    try {
      const j = (await tw(`/AvailablePhoneNumbers/${country}/Local.json?VoiceEnabled=true&PageSize=1`)) as {
        available_phone_numbers?: { phone_number: string }[];
      };
      return j.available_phone_numbers?.[0]?.phone_number ?? null;
    } catch { return null; }
  }

  for (const country of ["AU", "US"]) {
    const candidate = await firstAvailable(country);
    if (!candidate) continue;
    try {
      const body = new URLSearchParams({
        PhoneNumber: candidate,
        FriendlyName: friendlyName.slice(0, 60),
        VoiceUrl: `${base}/api/voice/inbound`,
        VoiceMethod: "POST",
        StatusCallback: `${base}/api/voice/status`,
        StatusCallbackMethod: "POST",
      });
      const bought = (await tw(`/IncomingPhoneNumbers.json`, { method: "POST", body })) as { phone_number?: string };
      if (bought.phone_number) return { number: bought.phone_number, country };
    } catch {
      // AU purchase fails until the regulatory bundle is approved — try next.
      continue;
    }
  }
  throw new Error("Couldn't provision a number right now — the AU bundle may still be in review. Try again shortly.");
}
