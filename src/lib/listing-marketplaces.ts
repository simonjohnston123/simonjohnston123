// Marketplace rulebooks for the Listing Tool. Each marketplace is a config
// object (fields + limits + validation + how to seed a draft from a product +
// the SAVED AI RULES that tell the optimiser how to maximise exposure and price),
// so adding a marketplace = adding a rulebook, not a new code branch.

export type MarketplaceKey =
  | "PLACID_CONNECT"
  | "EBAY"
  | "AMAZON"
  | "TIKTOK"
  | "GOOGLE"
  | "FACEBOOK"
  | "TEMU";

export type FieldType = "text" | "textarea" | "list" | "price" | "number";

export type ListingField = {
  id: string;
  label: string;
  type: FieldType;
  max?: number; // char cap for text/textarea; item cap for list
  required?: boolean;
  aiWritable?: boolean;
  help?: string;
};

export type Violation = { field: string; message: string };

export type ProductSeed = {
  name: string;
  description: string | null;
  priceCents: number | null;
  price: number | null;
  imageUrl: string | null;
  category: string | null;
};

export type Rulebook = {
  key: MarketplaceKey;
  label: string;
  available: boolean; // false = rulebook shown but publishing is "coming soon"
  blurb: string;
  fields: ListingField[];
  aiRules: string; // saved optimisation rules the AI must follow for this marketplace
  pricingHint: string; // how the AI should suggest a price for this marketplace
  seed: (p: ProductSeed) => Record<string, unknown>;
};

function dollars(p: ProductSeed): number {
  if (typeof p.priceCents === "number") return Math.round(p.priceCents) / 100;
  if (typeof p.price === "number") return p.price;
  return 0;
}

function clip(s: string | null | undefined, n: number): string {
  return (s ?? "").slice(0, n);
}

export const RULEBOOKS: Record<MarketplaceKey, Rulebook> = {
  PLACID_CONNECT: {
    key: "PLACID_CONNECT",
    label: "Placid Connect",
    available: true,
    blurb: "Our own marketplace — we set the rules, so no external friction. Lists straight into the Placid Connect marketplace.",
    fields: [
      { id: "title", label: "Title", type: "text", max: 120, required: true, aiWritable: true },
      { id: "description", label: "Description", type: "textarea", max: 4000, required: true, aiWritable: true },
      { id: "price", label: "Price (AUD)", type: "price", required: true },
      { id: "category", label: "Category", type: "text", max: 60, required: true },
      { id: "condition", label: "Condition", type: "text", max: 30 },
      { id: "imageUrl", label: "Image link", type: "text", max: 600 },
    ],
    aiRules:
      "Write a clear, benefit-led title (what it is + who it's for + a standout feature). Friendly, trustworthy description with 2–4 short paragraphs or bullet-style lines covering features and benefits. No ALL-CAPS, no keyword stuffing. Keep the category accurate.",
    pricingHint: "Suggest a fair retail price in line with the product's cost and typical online pricing — don't undercut margin.",
    seed: (p) => ({
      title: clip(p.name, 120),
      description: clip(p.description || p.name, 4000),
      price: dollars(p),
      category: p.category || "General",
      condition: "New",
      imageUrl: p.imageUrl || "",
    }),
  },

  EBAY: {
    key: "EBAY",
    label: "eBay",
    available: false, // the working eBay push becomes this adapter in a later phase
    blurb: "Title ≤ 80 chars, item specifics, GTIN/UPC or exemption, business policies. The live eBay push already exists — it plugs in here later.",
    fields: [
      { id: "title", label: "Title", type: "text", max: 80, required: true, aiWritable: true },
      { id: "description", label: "Description", type: "textarea", max: 4000, required: true, aiWritable: true },
      { id: "price", label: "Price (AUD)", type: "price", required: true },
      { id: "category", label: "eBay category", type: "text", max: 60 },
    ],
    aiRules:
      "MAXIMISE eBay search exposure. Use as much of the 80-char title as possible WITHOUT going over. Front-load the words buyers search: [Brand] [Product type] [key feature] [material] [size/colour] [quantity] [condition]. No punctuation gimmicks, no '&', no ALL-CAPS words, no seller slogans. Every word should be a keyword a buyer would type. Description: lead with the key features/specs as scannable lines, then benefits; include size/colour/material 'item specifics' buyers filter on.",
    pricingHint: "Suggest a competitive price close to comparable eBay listings for this item, factoring in ~13% eBay fees — stay competitive but keep it above cost.",
    seed: (p) => ({ title: clip(p.name, 80), description: clip(p.description || p.name, 4000), price: dollars(p), category: p.category || "" }),
  },

  AMAZON: {
    key: "AMAZON",
    label: "Amazon",
    available: false,
    blurb: "Title (best ≤ 80), 5 bullet points, backend keywords, 1000px white-bg image, GTIN required. US = CJ US-warehouse products only.",
    fields: [
      { id: "title", label: "Title", type: "text", max: 200, required: true, aiWritable: true },
      { id: "bullets", label: "Bullet points (5)", type: "list", max: 5, aiWritable: true },
      { id: "description", label: "Description", type: "textarea", max: 2000, aiWritable: true },
      { id: "keywords", label: "Search keywords", type: "text", max: 250, aiWritable: true },
      { id: "price", label: "Price (AUD)", type: "price", required: true },
    ],
    aiRules:
      "Follow Amazon style. Title: [Brand] + product line + key features + size/colour (aim ≤ 80 chars, hard cap 200), Title Case, no promotional phrases. Exactly 5 bullet points, each a benefit-led sentence starting with a capitalised key feature (e.g. 'DURABLE MATERIAL – …'). Backend search keywords: relevant terms NOT already in the title, space-separated, no repeats, no competitor brands. Description: concise, benefit-led.",
    pricingHint: "Suggest a price competitive with similar Amazon listings, allowing for ~15% referral fees while protecting margin.",
    seed: (p) => ({ title: clip(p.name, 200), bullets: [], description: clip(p.description || "", 2000), keywords: "", price: dollars(p) }),
  },

  TIKTOK: {
    key: "TIKTOK",
    label: "TikTok Shop",
    available: false,
    blurb: "Short, punchy, trend-aware listings for impulse buyers. Title + hook description, competitive price, images.",
    fields: [
      { id: "title", label: "Title", type: "text", max: 100, required: true, aiWritable: true },
      { id: "description", label: "Description", type: "textarea", max: 3000, aiWritable: true },
      { id: "price", label: "Price (AUD)", type: "price", required: true },
      { id: "category", label: "Category", type: "text", max: 60 },
    ],
    aiRules:
      "Write for impulse/social buyers. Title: short, punchy, benefit-first with a hook and 1–2 high-intent keywords (no hashtags in the title). Description: a scroll-stopping hook line, then 3–5 quick benefit bullets and a light call-to-action; casual, energetic tone; you may use a few relevant emoji. Emphasise what makes it giftable, viral or a must-have.",
    pricingHint: "Suggest a keen, impulse-friendly price point (often round or charm pricing) that beats typical retail while keeping margin.",
    seed: (p) => ({ title: clip(p.name, 100), description: clip(p.description || p.name, 3000), price: dollars(p), category: p.category || "" }),
  },

  GOOGLE: {
    key: "GOOGLE",
    label: "Google Shopping",
    available: false,
    blurb: "Merchant Center feed: title ≤ 150, description ≤ 5000, GTIN/MPN or identifier_exists=no, google_product_category.",
    fields: [
      { id: "title", label: "Title", type: "text", max: 150, required: true, aiWritable: true },
      { id: "description", label: "Description", type: "textarea", max: 5000, required: true, aiWritable: true },
      { id: "price", label: "Price (AUD)", type: "price", required: true },
      { id: "google_product_category", label: "Google product category", type: "text", max: 100 },
    ],
    aiRules:
      "Optimise for Google Shopping. Title: natural language, front-load [Brand] [Product] [key attributes: colour, size, material, quantity] — match how people search, no promotional text or ALL-CAPS. Description: accurate, detailed, keyword-rich but readable; include the attributes a shopper filters by. Keep the google_product_category accurate.",
    pricingHint: "Suggest a market-accurate price; Google surfaces price comparisons, so being competitive matters — keep it realistic and above cost.",
    seed: (p) => ({ title: clip(p.name, 150), description: clip(p.description || p.name, 5000), price: dollars(p), google_product_category: p.category || "" }),
  },

  FACEBOOK: {
    key: "FACEBOOK",
    label: "Facebook",
    available: false,
    blurb: "Catalog feed: title, description, condition, price, image, brand, category. Uses the existing Meta app.",
    fields: [
      { id: "title", label: "Title", type: "text", max: 100, required: true, aiWritable: true },
      { id: "description", label: "Description", type: "textarea", max: 5000, required: true, aiWritable: true },
      { id: "price", label: "Price (AUD)", type: "price", required: true },
      { id: "category", label: "Category", type: "text", max: 60 },
    ],
    aiRules:
      "Write for Facebook Shop/Marketplace. Title: clear and specific with the key feature and condition; approachable tone. Description: friendly, concise, benefit-led; mention condition and what's included; avoid keyword stuffing.",
    pricingHint: "Suggest a fair, locally-competitive price; Marketplace buyers are price-sensitive but keep it above cost.",
    seed: (p) => ({ title: clip(p.name, 100), description: clip(p.description || p.name, 5000), price: dollars(p), category: p.category || "" }),
  },

  TEMU: {
    key: "TEMU",
    label: "Temu",
    available: false,
    blurb: "Category + attributes, aggressively competitive price, variants, images. Semi-managed seller platform.",
    fields: [
      { id: "title", label: "Title", type: "text", max: 130, required: true, aiWritable: true },
      { id: "description", label: "Description", type: "textarea", max: 3000, aiWritable: true },
      { id: "price", label: "Price (AUD)", type: "price", required: true },
      { id: "category", label: "Category", type: "text", max: 60 },
    ],
    aiRules:
      "Temu is price-and-value driven. Title: keyword-rich with the product type, key features and size/colour; emphasise value. Description: highlight value, quality and use-cases in short scannable lines. Plain, clear language.",
    pricingHint: "Suggest an aggressively competitive price — Temu shoppers expect the lowest — but never below cost.",
    seed: (p) => ({ title: clip(p.name, 130), description: clip(p.description || p.name, 3000), price: dollars(p), category: p.category || "" }),
  },
};

export const MARKETPLACE_LIST: Rulebook[] = Object.values(RULEBOOKS);

// Typical selling-fee % per marketplace (editable defaults — used for profit maths).
export const MARKETPLACE_FEE_PCT: Record<MarketplaceKey, number> = {
  PLACID_CONNECT: 5,
  EBAY: 13,
  AMAZON: 15,
  TIKTOK: 8,
  GOOGLE: 0,
  FACEBOOK: 5,
  TEMU: 10,
};

export function feePct(key: string): number {
  return MARKETPLACE_FEE_PCT[key as MarketplaceKey] ?? 0;
}

export function rulebook(key: string): Rulebook | undefined {
  return RULEBOOKS[key as MarketplaceKey];
}

/** Validate one item's fields against its marketplace rulebook. */
export function validateFields(key: string, fields: Record<string, unknown>): Violation[] {
  const rb = rulebook(key);
  if (!rb) return [];
  const out: Violation[] = [];
  for (const f of rb.fields) {
    const v = fields[f.id];
    if (f.type === "list") {
      const arr = Array.isArray(v) ? v.filter((x) => String(x).trim()) : [];
      if (f.max && arr.length > f.max) out.push({ field: f.id, message: `${f.label}: ${arr.length}/${f.max} items` });
      continue;
    }
    if (f.type === "price") {
      const n = Number(v);
      if (f.required && (!Number.isFinite(n) || n <= 0)) out.push({ field: f.id, message: `${f.label} is required` });
      continue;
    }
    const s = typeof v === "string" ? v : v == null ? "" : String(v);
    if (f.required && !s.trim()) out.push({ field: f.id, message: `${f.label} is required` });
    if (f.max && s.length > f.max) out.push({ field: f.id, message: `${f.label}: ${s.length}/${f.max} chars` });
  }
  return out;
}
