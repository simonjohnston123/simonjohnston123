import "server-only";

// Dropshipzone Retailer API (read-only) for the branded Product Sourcing page.
// Auth: POST /auth {email,password} → JWT (~15 min). Rate: 60/min — we stay low.
// Suppliers stay invisible to businesses; this powers "Placid Sourcing".

const BASE = (process.env.DZ_API_BASE || "https://api.dropshipzone.com.au").replace(/\/$/, "");

let _token: string | null = null;
let _exp = 0;

export const dzReady = () => !!(process.env.DZ_EMAIL && process.env.DZ_PASSWORD);

async function auth(): Promise<string> {
  if (_token && Date.now() < _exp) return _token;
  const res = await fetch(`${BASE}/auth`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email: process.env.DZ_EMAIL, password: process.env.DZ_PASSWORD }),
  });
  const j = (await res.json().catch(() => ({}))) as { token?: string; exp?: number };
  if (!j.token) throw new Error("Sourcing supplier authentication failed.");
  _token = j.token;
  _exp = (j.exp ? j.exp * 1000 : Date.now() + 14 * 60000) - 30000;
  return _token;
}

async function dzGet(path: string, query: Record<string, string | number | undefined>): Promise<Record<string, unknown>> {
  const token = await auth();
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(query)) if (v !== undefined && v !== "") qs.append(k, String(v));
  const res = await fetch(`${BASE}${path}?${qs}`, { headers: { authorization: `jwt ${token}` } });
  const j = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (res.status === 401) { _token = null; throw new Error("Supplier session expired — try again."); }
  if (res.status >= 400) throw new Error(`Supplier error ${res.status}`);
  return j;
}

export type DzItem = {
  sku: string;
  title: string;
  image: string | null;
  gallery: string[];
  costCents: number;
  rrpCents: number;
  stock: number;
  category: string;
  desc: string;
};

type RawDz = {
  sku?: string; title?: string; gallery?: unknown; cost?: number | string; RrpPrice?: number | string;
  stock_qty?: number | string; in_stock?: number | string; Category?: string; desc?: string; product_status?: number; disable?: string;
};

function mapItem(p: RawDz): DzItem | null {
  if (!p.sku || !p.title) return null;
  const gallery = Array.isArray(p.gallery) ? (p.gallery as unknown[]).filter((x): x is string => typeof x === "string") : [];
  return {
    sku: String(p.sku),
    title: String(p.title),
    image: gallery[0] ?? null,
    gallery: gallery.slice(0, 6),
    costCents: Math.round(Number(p.cost ?? 0) * 100),
    rrpCents: Math.round(Number(p.RrpPrice ?? 0) * 100),
    stock: parseInt(String(p.stock_qty ?? 0), 10) || 0,
    category: String(p.Category ?? ""),
    desc: String(p.desc ?? "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, 600),
  };
}

/** Search/browse the DZ catalogue. Keyword is passed to the API when supported
 *  and ALSO applied locally as a filter so results are always relevant. */
export async function dzSearch(opts: { keywords?: string; page?: number }): Promise<{ items: DzItem[]; totalPages: number }> {
  const page = Math.max(1, opts.page ?? 1);
  const j = (await dzGet("/v2/products", {
    limit: 60,
    page_no: page,
    in_stock: "true",
    keywords: opts.keywords?.trim() || undefined,
  })) as { result?: RawDz[]; total_pages?: number };
  let items = (j.result ?? []).map(mapItem).filter((x): x is DzItem => !!x);

  const kw = (opts.keywords ?? "").trim().toLowerCase();
  if (kw) {
    const words = kw.split(/\s+/).filter((w) => w.length >= 3).map((w) => w.replace(/s$/, ""));
    if (words.length) {
      const filtered = items.filter((it) => { const t = `${it.title} ${it.category}`.toLowerCase(); return words.some((w) => t.includes(w)); });
      if (filtered.length) items = filtered; // if the API ignored keywords, self-filter
    }
  }
  return { items: items.slice(0, 48), totalPages: Number(j.total_pages ?? 1) };
}

// ---------------------------------------------------------------------------
// Cost + stock backfill.
//
// Only 102 of 60,001 catalogue products had a cost price, which made margin
// invisible and the ordering desk half-blind. /v2/products?skus=A,B,C returns
// the supplier's real cost, stock, weight and ETA per SKU, so this fills it in.
//
// Note the parameter is `skus` (plural). `sku` is silently ignored and you get
// an unfiltered page back — which looks like it worked.
// ---------------------------------------------------------------------------

export type DzFacts = {
  sku: string;
  costCents: number | null;
  rrpCents: number | null;
  stock: number | null;
  weightKg: number | null;
  ean: string | null;
  eta: string | null;
  /** Unconditionally free to send anywhere in AU — safe to sell at $0 postage. */
  freeShipping: boolean;
  /** Free "with limits" — DZ surcharges somewhere, and their API won't say where. */
  limitedFreeShipping: boolean;
  /** Structured specs — what makes a product comparable rather than just listable. */
  attributes: Record<string, unknown>;
};

type RawFacts = Record<string, unknown>;

const num = (v: unknown): number | null => {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

/** Drop empty values so a product's attributes say only what we actually know. */
function cleanAttributes(o: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(o)) {
    if (v === null || v === undefined || v === "") continue;
    if (typeof v === "object" && !Array.isArray(v) && Object.keys(v as object).length === 0) continue;
    out[k] = v;
  }
  return out;
}

/** Look up supplier facts for a batch of SKUs (keep batches modest — 60/min). */
export async function dzFactsForSkus(skus: string[]): Promise<Map<string, DzFacts>> {
  const out = new Map<string, DzFacts>();
  if (!skus.length) return out;

  const j = (await dzGet("/v2/products", {
    skus: skus.join(","),
    limit: Math.min(skus.length, 100),
    page_no: 1,
  })) as { result?: RawFacts[] };

  for (const r of j.result ?? []) {
    const sku = String(r.sku ?? "");
    if (!sku) continue;
    const cost = num(r.cost);
    const rrp = num(r.RrpPrice);
    out.set(sku, {
      sku,
      costCents: cost === null ? null : Math.round(cost * 100),
      rrpCents: rrp === null ? null : Math.round(rrp * 100),
      stock: num(r.stock_qty),
      weightKg: num(r.weight),
      ean: r.eancode ? String(r.eancode) : null,
      eta: r.ETA ? String(r.ETA) : null,
      // Two different promises, and the difference matters: "1" is free
      // outright, while limited_au_free_shipping means free to most of AU with
      // a surcharge somewhere DZ won't disclose. Only the first is safe to
      // quote as $0.
      freeShipping: String(r.freeshipping ?? "0") === "1",
      limitedFreeShipping: r.limited_au_free_shipping === true,
      attributes: cleanAttributes({
        weightKg: num(r.weight),
        lengthMm: num(r.length),
        widthMm: num(r.width),
        heightMm: num(r.height),
        cbm: num(r.cbm),
        barcode: r.eancode ? String(r.eancode) : null,
        brand: r.brand ? String(r.brand) : null,
        colour: r.colour ? String(r.colour) : null,
        dispatchEta: r.ETA ? String(r.ETA) : null,
        spec: r.spec ? String(r.spec).slice(0, 2000) : null,
        rrpCents: rrp === null ? null : Math.round(rrp * 100),
        category: cleanAttributes({
          l1: r.l1_category_name ? String(r.l1_category_name) : null,
          l2: r.l2_category_name ? String(r.l2_category_name) : null,
          l3: r.l3_category_name ? String(r.l3_category_name) : null,
        }),
      }),
    });
  }
  return out;
}
