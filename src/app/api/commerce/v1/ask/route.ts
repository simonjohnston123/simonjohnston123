import { NextRequest, NextResponse } from "next/server";
import { searchCatalogue, type CatalogueItem } from "@/lib/commerce";
import { resolveStorefront, CORS } from "@/lib/commerce-location";
import { getSetting, SETTING_KEYS } from "@/lib/platform-settings";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// ---------------------------------------------------------------------------
// Conversational shopping.
//
// "A quiet cordless vacuum under $200, delivered to Melbourne" instead of
// keyword roulette. The model's job is ONLY to turn language into a query —
// the catalogue answers, not the model. That matters: a model asked to
// recommend from memory will invent products we don't sell.
// ---------------------------------------------------------------------------

const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";
const MODEL = process.env.ANTHROPIC_MODEL || "claude-haiku-4-5-20251001";

const INTERPRET = `Turn a shopper's request into catalogue search filters.

Return ONLY the tool call. Rules:
- "search" should be the few words that would appear in a product title. Strip
  intent words ("I need", "looking for"), qualities the title won't contain
  ("quiet", "good", "reliable") and the destination.
- Convert money to integer cents. "under $200" -> maxCents 20000.
- Set inStockOnly true only if they stress urgency or immediate availability.
- If the request is vague, prefer a BROAD search over a narrow one; too few
  results is worse than too many.`;

const TOOL = {
  name: "search_catalogue",
  description: "Search the seller's catalogue.",
  input_schema: {
    type: "object",
    properties: {
      search: { type: "string", description: "keywords likely to appear in the product title" },
      minCents: { type: "number" },
      maxCents: { type: "number" },
      inStockOnly: { type: "boolean" },
      freeDeliveryOnly: { type: "boolean" },
      restated: { type: "string", description: "one sentence restating what the shopper is after" },
    },
    required: ["search", "restated"],
  },
};

type Filters = {
  search: string; restated: string;
  minCents?: number; maxCents?: number; inStockOnly?: boolean; freeDeliveryOnly?: boolean;
};

async function interpret(message: string, apiKey: string): Promise<Filters | null> {
  const res = await fetch(ANTHROPIC_URL, {
    method: "POST",
    headers: { "content-type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 400,
      system: INTERPRET,
      tools: [TOOL],
      tool_choice: { type: "tool", name: "search_catalogue" },
      messages: [{ role: "user", content: message }],
    }),
  });
  if (!res.ok) return null;
  const json = (await res.json()) as { content?: { type: string; name?: string; input?: Filters }[] };
  return json.content?.find((c) => c.type === "tool_use")?.input ?? null;
}

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as { to?: string; message?: string; store?: string };
  const to = (body.to || "").trim();
  const message = (body.message || "").trim();

  if (!/^[A-Za-z]{2}$/.test(to)) {
    return NextResponse.json({ error: "A destination is required (to: 'AU')." }, { status: 400, headers: CORS });
  }
  if (!message) {
    return NextResponse.json({ error: "Tell me what you're looking for." }, { status: 400, headers: CORS });
  }

  const store = await resolveStorefront(body.store);
  if (!store) return NextResponse.json({ error: "Storefront not found." }, { status: 404, headers: CORS });

  const apiKey = (await getSetting(SETTING_KEYS.anthropicApiKey)) || process.env.ANTHROPIC_API_KEY;
  const filters = apiKey ? await interpret(message, apiKey) : null;

  // Without the model we still answer — the raw message is a decent query.
  const search = filters?.search || message;

  let result = await searchCatalogue({
    locationId: store.id,
    destination: to,
    text: search,
    minCents: filters?.minCents,
    maxCents: filters?.maxCents,
    inStockOnly: filters?.inStockOnly,
    freeDeliveryOnly: filters?.freeDeliveryOnly,
    pageSize: 12,
  });

  // Narrow filters can strand a shopper on zero results. Widen by dropping the
  // last word at a time — "wireless charger iPhone watch" becomes "wireless
  // charger", which is still the thing they asked for. Keeping one arbitrary
  // word instead ("wireless") matches tyre inflators.
  let widened = false;
  if (result.total === 0) {
    const words = search.split(/\s+/).filter(Boolean);
    for (let take = words.length - 1; take >= 1; take--) {
      const shorter = words.slice(0, take).join(" ");
      if (shorter.length < 3) break;
      const retry = await searchCatalogue({ locationId: store.id, destination: to, text: shorter, pageSize: 12 });
      if (retry.total > 0) {
        widened = true;
        result = retry;
        break;
      }
    }
  }

  const summarise = (i: CatalogueItem) =>
    `${i.name}${i.priceCents ? ` — $${(i.priceCents / 100).toFixed(2)}` : ""}${i.delivery.freeToDestination ? ", free delivery" : ""}`;

  return NextResponse.json(
    {
      store: store.slug,
      destination: to.toUpperCase(),
      understood: filters?.restated ?? `Searching for "${search}"`,
      filters: {
        search,
        maxCents: filters?.maxCents ?? null,
        minCents: filters?.minCents ?? null,
        inStockOnly: filters?.inStockOnly ?? false,
      },
      widenedSearch: widened,
      total: result.total,
      items: result.items,
      // A plain-language line an assistant can read aloud.
      spoken:
        result.total === 0
          ? `I couldn't find anything matching that which we can deliver to ${to.toUpperCase()}.`
          : `I found ${result.total.toLocaleString()} option${result.total === 1 ? "" : "s"} we can deliver to ${to.toUpperCase()}. The closest ${Math.min(3, result.items.length)}: ${result.items.slice(0, 3).map(summarise).join("; ")}.`,
    },
    { headers: CORS },
  );
}
