import "server-only";
import { getSetting, setSetting } from "@/lib/platform-settings";

// ---------------------------------------------------------------------------
// Currency conversion for supplier costs.
//
// CJ quotes in USD; the catalogue prices in AUD. Importing CJ's numbers as if
// they were AUD understates cost by ~43%, which turns a 70% markup into roughly
// break-even once eBay's fees land. So every supplier figure is converted at a
// real rate before it is stored.
//
// The rate is fetched live and cached for a day. If the fetch fails we fall
// back to a DELIBERATELY CONSERVATIVE rate — over-stating cost makes a product
// look less profitable, which is the safe direction to be wrong in.
// ---------------------------------------------------------------------------

const RATE_KEY = "fx_usd_aud";
const RATE_AT_KEY = "fx_usd_aud_at";
const TTL_MS = 24 * 3600_000;

/** Used only when the live sources are unreachable. Higher = safer. */
const CONSERVATIVE_USD_AUD = 1.6;

const SOURCES = [
  { url: "https://open.er-api.com/v6/latest/USD", pick: (j: any) => j?.rates?.AUD },
  { url: "https://api.frankfurter.app/latest?from=USD&to=AUD", pick: (j: any) => j?.rates?.AUD },
];

async function fetchLiveRate(): Promise<number | null> {
  for (const s of SOURCES) {
    try {
      const res = await fetch(s.url, { signal: AbortSignal.timeout(8000) });
      if (!res.ok) continue;
      const rate = Number(s.pick(await res.json()));
      // Sanity-check: AUD has not left this band in decades. A garbage value
      // would silently reprice the whole catalogue.
      if (Number.isFinite(rate) && rate > 1.0 && rate < 2.5) return rate;
    } catch {
      // try the next source
    }
  }
  return null;
}

/** Current USD→AUD rate, cached for a day. */
export async function usdToAudRate(): Promise<number> {
  const cached = Number(await getSetting(RATE_KEY));
  const at = Number((await getSetting(RATE_AT_KEY)) ?? 0);
  if (Number.isFinite(cached) && cached > 0 && Date.now() - at < TTL_MS) return cached;

  const live = await fetchLiveRate();
  if (live) {
    await setSetting(RATE_KEY, String(live));
    await setSetting(RATE_AT_KEY, String(Date.now()));
    return live;
  }
  // Keep using a stale cached rate over the blunt fallback — it's closer.
  return Number.isFinite(cached) && cached > 0 ? cached : CONSERVATIVE_USD_AUD;
}

/** Convert a USD amount to AUD cents. */
export async function usdToAudCents(usd: number | null | undefined): Promise<number | null> {
  const n = Number(usd);
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.round(n * (await usdToAudRate()) * 100);
}
