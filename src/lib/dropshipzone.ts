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
