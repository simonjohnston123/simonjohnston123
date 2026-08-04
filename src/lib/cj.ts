import "server-only";
import { prisma } from "@/lib/db";
import { getSetting, setSetting } from "@/lib/platform-settings";

// ---------------------------------------------------------------------------
// CJ Dropshipping — server-side catalogue feed.
//
// Uses CJ's Developer API (api key), NOT a browser session: this has to run on
// a cron without anyone logged in. Get the key from CJ → My CJ → Authorization.
//
// Access tokens last ~15 days and CJ rate-limits token creation hard (1 per
// 300s), so the token is cached in the Setting table and reused across
// requests and restarts.
// ---------------------------------------------------------------------------

const BASE = "https://developers.cjdropshipping.com/api2.0/v1";

export const CJ_SETTING = {
  email: "cj_email",
  apiKey: "cj_api_key",
  token: "cj_access_token",
  tokenExpiry: "cj_access_token_expiry",
} as const;

/**
 * Which countries a warehouse may sell to.
 *
 * This is the geo-gate: a product row imported from the AU warehouse gets
 * shipCountries ["AU"], so the existing channel gate physically cannot push it
 * to eBay US. China is the global hub and reaches everywhere, but slowly — its
 * rows are marked so listings can carry an honest dispatch time.
 */
export const WAREHOUSE_REACH: Record<string, string[]> = {
  AU: ["AU", "NZ"],
  US: ["US"],
  GB: ["GB", "IE"],
  DE: ["DE", "AT", "NL", "BE", "PL", "CZ"],
  FR: ["FR", "BE", "LU"],
  ES: ["ES", "PT"],
  RO: ["RO", "BG", "HU"],
  CA: ["CA"],
  MX: ["MX"],
  JP: ["JP"],
  TH: ["TH"],
  MY: ["MY", "SG"],
  PH: ["PH"],
  AE: ["AE", "SA"],
  NG: ["NG"],
  // The China hub ships worldwide — long transit, so kept distinct on purpose.
  CN: ["AU", "US", "GB", "NZ", "CA", "DE", "FR", "ES", "IE", "SG"],
};

/** Warehouses that hold local stock (fast delivery), China excluded. */
export const LOCAL_WAREHOUSES = Object.keys(WAREHOUSE_REACH).filter((c) => c !== "CN");

export type CjCreds = { email: string; apiKey: string };

export async function cjCredentials(): Promise<CjCreds | null> {
  const email = (await getSetting(CJ_SETTING.email)) || process.env.CJ_EMAIL || null;
  const apiKey = (await getSetting(CJ_SETTING.apiKey)) || process.env.CJ_API_KEY || null;
  return email && apiKey ? { email, apiKey } : null;
}

export const cjReady = async () => Boolean(await cjCredentials());

async function mintToken(creds: CjCreds): Promise<string | null> {
  const res = await fetch(`${BASE}/authentication/getAccessToken`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email: creds.email, apiKey: creds.apiKey }),
  });
  if (!res.ok) return null;
  const json = (await res.json()) as { result?: boolean; data?: { accessToken?: string; accessTokenExpiryDate?: string } };
  const token = json.data?.accessToken;
  if (!token) return null;

  // Expire our copy a day early so a request never dies mid-import.
  const expiry = json.data?.accessTokenExpiryDate
    ? Date.parse(json.data.accessTokenExpiryDate) - 24 * 3600_000
    : Date.now() + 13 * 24 * 3600_000;

  await setSetting(CJ_SETTING.token, token);
  await setSetting(CJ_SETTING.tokenExpiry, String(expiry));
  return token;
}

export async function cjToken(): Promise<string | null> {
  const creds = await cjCredentials();
  if (!creds) return null;

  const cached = await getSetting(CJ_SETTING.token);
  const expiry = Number((await getSetting(CJ_SETTING.tokenExpiry)) ?? 0);
  if (cached && expiry > Date.now()) return cached;

  return mintToken(creds);
}

/** CJ allows roughly one call per second on catalogue endpoints. */
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function cjGet<T>(path: string, params: Record<string, string | number>): Promise<T | null> {
  const token = await cjToken();
  if (!token) return null;
  const qs = new URLSearchParams(Object.entries(params).map(([k, v]) => [k, String(v)]));
  const res = await fetch(`${BASE}${path}?${qs}`, { headers: { "CJ-Access-Token": token } });
  if (!res.ok) return null;
  const json = (await res.json()) as { result?: boolean; data?: T; message?: string };
  return json.data ?? null;
}

export type CjListItem = {
  pid: string;
  productNameEn?: string;
  productSku?: string;
  productImage?: string;
  sellPrice?: string;
  categoryName?: string;
  productWeight?: string;
  /** CJ tells us exactly where this product can ship — better than any map. */
  shippingCountryCodes?: string[] | string;
  isFreeShipping?: string | number;
};

/** One page of the CJ catalogue for a given warehouse country. */
export async function cjListProducts(countryCode: string, pageNum: number, pageSize = 200): Promise<CjListItem[]> {
  const data = await cjGet<{ list?: CjListItem[] }>("/product/list", {
    pageNum,
    pageSize,
    countryCode,
  });
  return data?.list ?? [];
}

export type CjStock = { countryCode?: string; storageNum?: number; areaEn?: string };

/** Real warehouse stock per country for a product. */
export async function cjStock(pid: string): Promise<CjStock[]> {
  const data = await cjGet<CjStock[]>("/product/stock/queryByPid", { pid });
  return Array.isArray(data) ? data : [];
}

// --- Import ----------------------------------------------------------------

export type CjImportResult = { ok: boolean; error?: string; warehouse: string; created: number; updated: number; scanned: number };

/** Retail = cost x this. Matches the Dropshipzone import. */
const MARKUP = Number(process.env.CJ_MARKUP ?? "1.7");

/**
 * Import one CJ warehouse into the catalogue.
 *
 * One product row PER WAREHOUSE — the same item in the AU warehouse and the
 * China warehouse are commercially different things (days vs weeks), so they
 * must not be merged. externalId is `<pid>:<warehouse>` to keep them distinct
 * and make re-runs idempotent.
 */
export async function importCjWarehouse(
  locationId: string,
  countryCode: string,
  opts: { maxPages?: number; pageSize?: number } = {},
): Promise<CjImportResult> {
  const out: CjImportResult = { ok: true, warehouse: countryCode, created: 0, updated: 0, scanned: 0 };
  if (!(await cjReady())) return { ...out, ok: false, error: "CJ API key not set (Admin → Integrations)." };

  const reach = WAREHOUSE_REACH[countryCode] ?? [countryCode];
  const maxPages = opts.maxPages ?? 30;
  const pageSize = opts.pageSize ?? 200;

  for (let page = 1; page <= maxPages; page++) {
    const items = await cjListProducts(countryCode, page, pageSize);
    if (!items.length) break;

    for (const it of items) {
      if (!it.pid || !it.productNameEn) continue;
      out.scanned++;

      const costCents = Math.round(Number(it.sellPrice ?? 0) * 100) || null;
      const externalId = `${it.pid}:${countryCode}`;

      // Prefer CJ's own answer for where this can ship; fall back to the
      // warehouse map only when they don't say.
      const raw = Array.isArray(it.shippingCountryCodes)
        ? it.shippingCountryCodes
        : typeof it.shippingCountryCodes === "string" && it.shippingCountryCodes
          ? it.shippingCountryCodes.split(/[,\s]+/).filter(Boolean)
          : [];
      // CJ emits pseudo-codes like "CN_US" (China warehouse, US-bound). Left
      // raw they match no customer, so the product is silently unsellable.
      const declared = [...new Set(raw.map((c) => (c.includes("_") ? c.split("_").pop()! : c)).filter((c) => /^[A-Z]{2}$/.test(c)))];
      const shipCountries = declared.length ? declared : reach;

      const existing = await prisma.product.findFirst({
        where: { locationId, source: "CJ Dropshipping", externalId },
        select: { id: true },
      });

      const data = {
        name: it.productNameEn.slice(0, 300),
        sku: it.productSku ?? null,
        imageUrl: it.productImage ?? null,
        category: it.categoryName ?? null,
        costCents,
        priceCents: costCents ? Math.round(costCents * MARKUP) : null,
        supplier: "CJ Dropshipping",
        warehouse: countryCode,
        shipCountries,
        source: "CJ Dropshipping",
        externalId,
      };

      if (existing) {
        await prisma.product.update({ where: { id: existing.id }, data });
        out.updated++;
      } else {
        await prisma.product.create({ data: { ...data, locationId, active: true } });
        out.created++;
      }
    }

    await sleep(1100); // stay inside CJ's ~1 req/sec catalogue limit
  }

  return out;
}

/** Refresh stock levels for already-imported CJ products (the "live feed"). */
export async function refreshCjStock(locationId: string, limit = 200): Promise<{ checked: number; updated: number }> {
  const rows = await prisma.product.findMany({
    where: { locationId, source: "CJ Dropshipping", externalId: { not: null } },
    orderBy: { updatedAt: "asc" }, // oldest-checked first, so it cycles
    take: limit,
    select: { id: true, externalId: true, warehouse: true },
  });

  let updated = 0;
  for (const r of rows) {
    const pid = (r.externalId ?? "").split(":")[0];
    if (!pid) continue;
    const stock = await cjStock(pid);
    const mine = stock.find((s) => s.countryCode === r.warehouse);
    // Only CJ warehouse stock counts. Factory stock is not shippable today and
    // treating it as inventory is what produces "where is my order" messages.
    await prisma.product.update({ where: { id: r.id }, data: { inventory: mine?.storageNum ?? 0 } });
    updated++;
    await sleep(1100);
  }
  return { checked: rows.length, updated };
}
