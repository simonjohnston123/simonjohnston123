// Marketplace rulebooks for the Listing Tool. Each marketplace is a config
// object (fields + limits + validation + how to seed a draft from a product),
// so adding a marketplace = adding a rulebook, not a new code branch.

export type MarketplaceKey = "PLACID_CONNECT" | "EBAY" | "AMAZON" | "TEMU" | "FACEBOOK" | "GOOGLE";

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
    seed: (p) => ({ title: clip(p.name, 80), description: clip(p.description || p.name, 4000), price: dollars(p), category: p.category || "" }),
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
    seed: (p) => ({ title: clip(p.name, 100), description: clip(p.description || p.name, 5000), price: dollars(p), category: p.category || "" }),
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
    seed: (p) => ({ title: clip(p.name, 200), bullets: [], description: clip(p.description || "", 2000), keywords: "", price: dollars(p) }),
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
    seed: (p) => ({ title: clip(p.name, 130), description: clip(p.description || p.name, 3000), price: dollars(p), category: p.category || "" }),
  },
};

export const MARKETPLACE_LIST: Rulebook[] = Object.values(RULEBOOKS);

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
