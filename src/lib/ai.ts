/**
 * Lightweight AI helpers via the Anthropic REST API (no SDK to keep the Docker
 * build clean). Every helper degrades gracefully to a deterministic heuristic
 * when ANTHROPIC_API_KEY isn't configured, so features work out of the box.
 */

const API_URL = "https://api.anthropic.com/v1/messages";
const MODEL = process.env.ANTHROPIC_MODEL || "claude-haiku-4-5-20251001";

export function aiEnabled(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

async function complete(prompt: string, maxTokens = 400): Promise<string | null> {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return null;
  try {
    const res = await fetch(API_URL, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": key,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: maxTokens,
        messages: [{ role: "user", content: prompt }],
      }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    const text = Array.isArray(data?.content)
      ? data.content.map((b: { text?: string }) => b?.text ?? "").join("")
      : "";
    return text.trim() || null;
  } catch {
    return null;
  }
}

/**
 * Suggest an ordered list of pipeline stage names for a business/sales process.
 * Returns 4–8 short stage names.
 */
export async function generatePipelineStages(description: string): Promise<string[]> {
  const prompt =
    `You are a CRM expert. A business describes their sales or client process below. ` +
    `Return ONLY a JSON array of 4 to 7 short pipeline stage names (2-3 words each), ` +
    `ordered from first contact to closed/won. No prose, no markdown, just the JSON array.\n\n` +
    `Business/process: ${description}`;

  const raw = await complete(prompt, 300);
  const parsed = raw ? parseStringArray(raw) : null;
  if (parsed && parsed.length >= 2) return parsed.slice(0, 8);

  return heuristicStages(description);
}

export type FormFieldSpec = {
  key: string;
  label: string;
  type: "text" | "email" | "phone" | "textarea" | "number" | "date" | "select" | "checkbox";
  required: boolean;
  options?: string[];
  placeholder?: string;
};

const FIELD_TYPES = ["text", "email", "phone", "textarea", "number", "date", "select", "checkbox"];

function slugKey(s: string): string {
  return (
    String(s)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_|_$/g, "")
      .slice(0, 40) || "field"
  );
}

/**
 * Turn a plain-English description into a list of form/survey fields.
 * Falls back to a sensible contact form when no API key is configured.
 */
export async function generateFormFields(description: string, kind: "FORM" | "SURVEY" = "FORM"): Promise<FormFieldSpec[]> {
  const prompt =
    `You design web ${kind === "SURVEY" ? "surveys" : "contact/intake forms"} for small businesses. ` +
    `From the description, return ONLY a JSON array of fields (no prose, no markdown). ` +
    `Each field is an object: {"label": string, "type": one of ${JSON.stringify(FIELD_TYPES)}, ` +
    `"required": boolean, "options": string[] (only for "select"), "placeholder": string (optional)}. ` +
    `Use 3-8 fields. Always include a way to contact the person (email or phone) unless clearly not needed.\n\n` +
    `Description: ${description}`;

  const raw = await complete(prompt, 700);
  const parsed = raw ? parseFieldArray(raw) : null;
  if (parsed && parsed.length) return parsed;
  return heuristicFields(description, kind);
}

function parseFieldArray(raw: string): FormFieldSpec[] | null {
  const match = raw.match(/\[[\s\S]*\]/);
  if (!match) return null;
  let arr: unknown;
  try {
    arr = JSON.parse(match[0]);
  } catch {
    return null;
  }
  if (!Array.isArray(arr)) return null;
  const seen = new Set<string>();
  const out: FormFieldSpec[] = [];
  for (const item of arr) {
    if (!item || typeof item !== "object") continue;
    const o = item as Record<string, unknown>;
    const label = String(o.label ?? o.name ?? "").trim();
    if (!label) continue;
    let type = String(o.type ?? "text").toLowerCase();
    if (!FIELD_TYPES.includes(type)) type = "text";
    let key = slugKey(label);
    while (seen.has(key)) key = `${key}_2`;
    seen.add(key);
    const options = Array.isArray(o.options) ? o.options.map((x) => String(x)).filter(Boolean) : undefined;
    out.push({
      key,
      label,
      type: type as FormFieldSpec["type"],
      required: Boolean(o.required),
      ...(type === "select" && options?.length ? { options } : {}),
      ...(o.placeholder ? { placeholder: String(o.placeholder) } : {}),
    });
  }
  return out.length ? out.slice(0, 12) : null;
}

/** Keyword fallback so form generation works with no API key. */
function heuristicFields(description: string, kind: "FORM" | "SURVEY"): FormFieldSpec[] {
  const d = description.toLowerCase();
  const base: FormFieldSpec[] = [
    { key: "name", label: "Your name", type: "text", required: true },
    { key: "email", label: "Email", type: "email", required: true },
    { key: "phone", label: "Phone", type: "phone", required: false },
  ];
  if (kind === "SURVEY") {
    return [
      ...base,
      { key: "rating", label: "How would you rate us?", type: "select", required: true, options: ["Excellent", "Good", "Okay", "Poor"] },
      { key: "comments", label: "Any comments?", type: "textarea", required: false },
    ];
  }
  if (/book|appoint|quote|inspect|service|job/.test(d)) {
    base.push({ key: "details", label: "What do you need?", type: "textarea", required: false });
  } else {
    base.push({ key: "message", label: "Message", type: "textarea", required: false });
  }
  return base;
}

/** A short, friendly product description from a name (+ optional hint). */
export async function generateProductDescription(name: string, hint?: string): Promise<string> {
  const prompt =
    `Write a single friendly product description (2 sentences, under 40 words, no markdown, ` +
    `no quotes) for an online store listing.\n\nProduct: ${name}${hint ? `\nDetails: ${hint}` : ""}`;
  const raw = await complete(prompt, 160);
  if (raw) return raw.replace(/^["']|["']$/g, "").trim();
  return `${name}${hint ? ` — ${hint}` : ""}. Get in touch to order or find out more.`;
}

export type SetupService = {
  name: string;
  price: number | null;
  durationMinutes: number;
  description: string;
  intakeFields: FormFieldSpec[];
};
export type SetupForm = { name: string; type: "FORM" | "SURVEY"; description: string; fields: FormFieldSpec[] };
export type BusinessSetup = {
  tagline: string;
  about: string;
  services: SetupService[];
  forms: SetupForm[];
};

/**
 * The heart of the onboarding wizard: take a business owner's short answers and
 * draft their whole setup — services (with per-service booking questions),
 * a form or survey, and site copy. Falls back to a sane template with no API key.
 */
export async function generateBusinessSetup(answers: {
  business: string;
  services?: string;
  bookingInfo?: string;
  area?: string;
}): Promise<BusinessSetup> {
  const prompt =
    `You set up small-business booking sites. From the owner's answers, return ONLY JSON ` +
    `(no prose, no markdown) matching exactly this shape:\n` +
    `{"tagline": string, "about": string, ` +
    `"services": [{"name": string, "price": number|null, "durationMinutes": number, "description": string, ` +
    `"intakeFields": [{"label": string, "type": one of ${JSON.stringify(FIELD_TYPES)}, "required": boolean, "options"?: string[]}]}], ` +
    `"forms": [{"name": string, "type": "FORM"|"SURVEY", "description": string, ` +
    `"fields": [{"label": string, "type": one of ${JSON.stringify(FIELD_TYPES)}, "required": boolean, "options"?: string[]}]}]}\n` +
    `Rules: 2-5 services. Each service's intakeFields are the questions THAT service must ask the ` +
    `customer at booking time (e.g. a vehicle roadworthy asks registration number, make/model, and address). ` +
    `Include 1 general enquiry form. Keep durations realistic. Prices in whole dollars or null if unclear. ` +
    `tagline <= 12 words; about = 2-3 sentences.\n\n` +
    `Business: ${answers.business}\n` +
    (answers.services ? `Services offered: ${answers.services}\n` : "") +
    (answers.bookingInfo ? `What they need from a customer when booking: ${answers.bookingInfo}\n` : "") +
    (answers.area ? `Location / service area: ${answers.area}\n` : "");

  const raw = await complete(prompt, 2000);
  const parsed = raw ? parseSetup(raw) : null;
  if (parsed) return parsed;
  return heuristicSetup(answers);
}

function normFields(input: unknown): FormFieldSpec[] {
  if (!Array.isArray(input)) return [];
  const seen = new Set<string>();
  const out: FormFieldSpec[] = [];
  for (const item of input) {
    if (!item || typeof item !== "object") continue;
    const o = item as Record<string, unknown>;
    const label = String(o.label ?? o.name ?? "").trim();
    if (!label) continue;
    let type = String(o.type ?? "text").toLowerCase();
    if (!FIELD_TYPES.includes(type)) type = "text";
    let key = slugKey(label);
    while (seen.has(key)) key = `${key}_2`;
    seen.add(key);
    const options = Array.isArray(o.options) ? o.options.map((x) => String(x)).filter(Boolean) : undefined;
    out.push({
      key,
      label,
      type: type as FormFieldSpec["type"],
      required: Boolean(o.required),
      ...(type === "select" && options?.length ? { options } : {}),
    });
  }
  return out.slice(0, 12);
}

function parseSetup(raw: string): BusinessSetup | null {
  const match = raw.match(/\{[\s\S]*\}/);
  if (!match) return null;
  let obj: Record<string, unknown>;
  try {
    obj = JSON.parse(match[0]);
  } catch {
    return null;
  }
  const servicesRaw = Array.isArray(obj.services) ? obj.services : [];
  const services: SetupService[] = servicesRaw
    .map((s): SetupService | null => {
      if (!s || typeof s !== "object") return null;
      const o = s as Record<string, unknown>;
      const name = String(o.name ?? "").trim();
      if (!name) return null;
      const priceNum = Number(o.price);
      return {
        name,
        price: Number.isFinite(priceNum) && priceNum > 0 ? Math.round(priceNum) : null,
        durationMinutes: Math.min(Math.max(Number(o.durationMinutes) || 30, 5), 480),
        description: String(o.description ?? "").trim(),
        intakeFields: normFields(o.intakeFields),
      };
    })
    .filter((s): s is SetupService => Boolean(s))
    .slice(0, 6);
  if (!services.length) return null;

  const formsRaw = Array.isArray(obj.forms) ? obj.forms : [];
  const forms: SetupForm[] = formsRaw
    .map((f): SetupForm | null => {
      if (!f || typeof f !== "object") return null;
      const o = f as Record<string, unknown>;
      const name = String(o.name ?? "").trim();
      if (!name) return null;
      return {
        name,
        type: String(o.type ?? "FORM") === "SURVEY" ? "SURVEY" : "FORM",
        description: String(o.description ?? "").trim(),
        fields: normFields(o.fields),
      };
    })
    .filter((f): f is SetupForm => Boolean(f))
    .slice(0, 4);

  return {
    tagline: String(obj.tagline ?? "").trim().slice(0, 120),
    about: String(obj.about ?? "").trim().slice(0, 600),
    services,
    forms,
  };
}

function heuristicSetup(answers: { business: string; area?: string }): BusinessSetup {
  const area = answers.area ? ` in ${answers.area}` : "";
  return {
    tagline: `Quality service${area}`,
    about: `${answers.business}. Get in touch to book — we'll look after you.`,
    services: [
      {
        name: "Standard service",
        price: null,
        durationMinutes: 60,
        description: "Our core service. Edit the details and price to match your business.",
        intakeFields: [
          { key: "name", label: "Your name", type: "text", required: true },
          { key: "phone", label: "Phone", type: "phone", required: true },
          { key: "address", label: "Address", type: "text", required: false },
          { key: "details", label: "What do you need?", type: "textarea", required: false },
        ],
      },
    ],
    forms: [
      {
        name: "Enquiry form",
        type: "FORM",
        description: "General enquiries.",
        fields: heuristicFields("enquiry", "FORM"),
      },
    ],
  };
}

function parseStringArray(raw: string): string[] | null {
  const match = raw.match(/\[[\s\S]*\]/);
  if (!match) return null;
  try {
    const arr = JSON.parse(match[0]);
    if (Array.isArray(arr)) {
      return arr.map((s) => String(s).trim()).filter(Boolean);
    }
  } catch {
    /* fall through */
  }
  return null;
}

/** Keyword-based fallback so pipeline generation works with no API key. */
function heuristicStages(description: string): string[] {
  const d = description.toLowerCase();
  if (/storage|yard|unit|container|self.?storage/.test(d))
    return ["Enquiry", "Quote Sent", "Booked", "Moved In", "Active"];
  if (/disab|ndis|support|care|participant/.test(d))
    return ["Referral", "Intake", "Assessment", "Service Agreement", "Onboarded", "Active"];
  if (/driv|lesson|instructor|student|school/.test(d))
    return ["Enquiry", "Booked Lesson", "Learning", "Test Ready", "Passed"];
  if (/real ?estate|property|listing|tenant|rent/.test(d))
    return ["New Lead", "Inspection", "Application", "Approved", "Leased"];
  if (/shop|store|ecom|retail|product|order/.test(d))
    return ["New Lead", "Cart", "Checkout", "Paid", "Fulfilled"];
  return ["New Lead", "Contacted", "Qualified", "Quote Sent", "Won"];
}

// ---- Listing Tool: AI listing optimiser ------------------------------------
export type OptimizeFieldSpec = { id: string; label: string; type: string; max?: number };
export type OptimizeInput = {
  marketplaceLabel: string;
  aiRules: string;
  pricingHint: string;
  fields: OptimizeFieldSpec[]; // the AI-writable fields
  current: Record<string, unknown>;
  product: { name: string; description?: string | null; category?: string | null; price?: number };
};
export type OptimizeResult = { fields: Record<string, unknown>; priceSuggestion: number | null; note: string; ai: boolean };

/** Rewrite a listing's fields to a marketplace's saved rules + suggest a price.
 *  Real Claude when ANTHROPIC_API_KEY is set; a deterministic tidy-up otherwise. */
export async function optimiseListing(input: OptimizeInput): Promise<OptimizeResult> {
  const spec = input.fields
    .map((f) => `- ${f.id} (${f.type}${f.max ? `, max ${f.max}${f.type === "list" ? " items" : " chars"}` : ""}): ${f.label}`)
    .join("\n");
  const prompt = `You are an expert ${input.marketplaceLabel} listing optimiser.
Rewrite this product's listing to follow these rules EXACTLY:
${input.aiRules}

Pricing guidance: ${input.pricingHint}

Product source data:
- Name: ${input.product.name}
- Category: ${input.product.category ?? ""}
- Current price (AUD): ${input.product.price ?? ""}
- Description: ${(input.product.description ?? "").slice(0, 1200)}

Return STRICT JSON only (no markdown, no commentary) with exactly these keys:
${spec}
- priceSuggestion (number, AUD): your recommended sell price per the pricing guidance.
Respect every max limit. For "list" fields return an array of strings. JSON:`;

  const raw = await complete(prompt, 900);
  const parsed = raw ? parseOptimize(raw, input.fields) : null;
  if (parsed) return { fields: parsed.fields, priceSuggestion: parsed.priceSuggestion, note: `Optimised for ${input.marketplaceLabel}.`, ai: true };

  return {
    ...heuristicOptimize(input),
    note: aiEnabled()
      ? "AI was busy — applied a basic tidy-up. Try again for a full optimisation."
      : "AI credits aren't switched on yet — applied a basic tidy-up. Enable AI for full optimisation.",
    ai: false,
  };
}

function parseOptimize(raw: string, fields: OptimizeFieldSpec[]): { fields: Record<string, unknown>; priceSuggestion: number | null } | null {
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  let obj: Record<string, unknown>;
  try {
    obj = JSON.parse(raw.slice(start, end + 1));
  } catch {
    return null;
  }
  const out: Record<string, unknown> = {};
  for (const f of fields) {
    const v = obj[f.id];
    if (v == null) continue;
    if (f.type === "list") {
      const arr = (Array.isArray(v) ? v : [v]).map((x) => String(x).trim()).filter(Boolean);
      out[f.id] = f.max ? arr.slice(0, f.max) : arr;
    } else {
      const s = String(v).trim();
      out[f.id] = f.max ? s.slice(0, f.max) : s;
    }
  }
  const priceNum = Number(obj.priceSuggestion);
  return { fields: out, priceSuggestion: Number.isFinite(priceNum) && priceNum > 0 ? Math.round(priceNum * 100) / 100 : null };
}

function heuristicOptimize(input: OptimizeInput): { fields: Record<string, unknown>; priceSuggestion: number | null } {
  const out: Record<string, unknown> = {};
  const baseTitle = String(input.current.title ?? input.product.name ?? "").replace(/\s+/g, " ").trim();
  const baseDesc = String(input.current.description ?? input.product.description ?? input.product.name ?? "").trim();
  for (const f of input.fields) {
    if (f.id === "title") out.title = f.max ? baseTitle.slice(0, f.max) : baseTitle;
    else if (f.id === "description") out.description = f.max ? baseDesc.slice(0, f.max) : baseDesc;
    else if (f.type === "list") {
      const lines = baseDesc.split(/[.\n]/).map((s) => s.trim()).filter((s) => s.length > 8);
      out[f.id] = lines.slice(0, f.max ?? 5);
    } else if (f.id === "keywords") {
      out.keywords = [input.product.category, ...baseTitle.split(" ")].filter(Boolean).slice(0, 10).join(" ").slice(0, f.max ?? 250);
    }
  }
  return { fields: out, priceSuggestion: typeof input.product.price === "number" ? input.product.price : null };
}
