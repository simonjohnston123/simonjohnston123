import "server-only";
import { prisma } from "@/lib/db";
import { getValidToken } from "@/lib/ebay-sync";
import { getSetting, SETTING_KEYS } from "@/lib/platform-settings";

// ---------------------------------------------------------------------------
// eBay buyer questions → CRM inbox, with an AI-drafted answer.
//
// We use the Trading API's GetMemberMessages, NOT GetMyMessages. GetMyMessages
// returns eBay's whole HTML email template with the buyer's question buried in
// it; GetMemberMessages returns the clean question body plus the listing it is
// about (item id, title, price, URL) and whether it's already been answered.
//
// Trading API auth: the OAuth access token goes in X-EBAY-API-IAF-TOKEN. No
// dev/cert headers are needed in that mode.
// ---------------------------------------------------------------------------

const TRADING_URL = "https://api.ebay.com/ws/api.dll";
const COMPAT_LEVEL = "1155";
/** eBay site id. 15 = Australia. */
const SITE_ID = process.env.EBAY_SITE_ID || "15";
const PAGE_SIZE = 100;
const MAX_PAGES = 10;

export type EbayThread = {
  itemId: string | null;
  title: string | null;
  priceText: string | null;
  viewUrl: string | null;
  sender: string | null;
  senderEmail: string | null;
  subject: string | null;
  body: string;
  messageId: string | null;
  answered: boolean;
  createdAt: Date | null;
};

// --- XML helpers -----------------------------------------------------------
// Small hand-rolled parsing: the Trading API responses we consume are shallow
// and adding an XML dependency for four tags isn't worth it.

function tag(xml: string, name: string): string | null {
  const m = xml.match(new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)</${name}>`));
  return m ? m[1] : null;
}

/** eBay double-encodes bodies, so "'" arrives as &amp;apos; — decode twice. */
export function decodeEntities(s: string): string {
  const once = (v: string) =>
    v
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .replace(/&apos;/g, "'")
      .replace(/&#(\d+);/g, (_, d) => String.fromCharCode(Number(d)))
      .replace(/&nbsp;/g, " ")
      .replace(/&amp;/g, "&");
  return once(once(s)).trim();
}

function escapeXml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

async function trading(token: string, callName: string, inner: string): Promise<string> {
  const res = await fetch(TRADING_URL, {
    method: "POST",
    headers: {
      "X-EBAY-API-COMPATIBILITY-LEVEL": COMPAT_LEVEL,
      "X-EBAY-API-CALL-NAME": callName,
      "X-EBAY-API-SITEID": SITE_ID,
      "X-EBAY-API-IAF-TOKEN": token,
      "Content-Type": "text/xml",
    },
    body:
      `<?xml version="1.0" encoding="utf-8"?>\n` +
      `<${callName}Request xmlns="urn:ebay:apis:eBLBaseComponents">${inner}</${callName}Request>`,
  });
  return await res.text();
}

function ackFailed(xml: string): string | null {
  const ack = tag(xml, "Ack");
  if (ack === "Success" || ack === "Warning") return null;
  return tag(xml, "LongMessage") || tag(xml, "ShortMessage") || `eBay returned Ack=${ack ?? "?"}`;
}

// --- Reading ---------------------------------------------------------------

/** Fetch buyer↔seller message threads from the last `days`. */
export async function fetchEbayThreads(locationId: string, days = 30): Promise<{ threads: EbayThread[]; error?: string }> {
  const token = await getValidToken(locationId);
  if (!token) return { threads: [], error: "eBay isn't connected (or the token expired) — reconnect eBay." };

  const end = new Date();
  const start = new Date(Date.now() - days * 24 * 3600 * 1000);
  const threads: EbayThread[] = [];

  for (let page = 1; page <= MAX_PAGES; page++) {
    const xml = await trading(
      token,
      "GetMemberMessages",
      `<MailMessageType>All</MailMessageType>` +
        `<StartCreationTime>${start.toISOString()}</StartCreationTime>` +
        `<EndCreationTime>${end.toISOString()}</EndCreationTime>` +
        `<Pagination><EntriesPerPage>${PAGE_SIZE}</EntriesPerPage><PageNumber>${page}</PageNumber></Pagination>`,
    );
    const err = ackFailed(xml);
    if (err) return { threads, error: err };

    const blocks = [...xml.matchAll(/<MemberMessageExchange>([\s\S]*?)<\/MemberMessageExchange>/g)].map((m) => m[1]);
    if (!blocks.length) break;

    for (const b of blocks) {
      const q = tag(b, "Question") ?? "";
      const body = decodeEntities(tag(q, "Body") ?? "");
      if (!body) continue;
      const created = tag(b, "CreationDate") || tag(q, "CreationDate");
      threads.push({
        itemId: tag(b, "ItemID"),
        title: decodeEntities(tag(b, "Title") ?? "") || null,
        priceText: tag(b, "CurrentPrice"),
        viewUrl: tag(b, "ViewItemURL"),
        sender: tag(q, "SenderID"),
        senderEmail: tag(q, "SenderEmail"),
        subject: decodeEntities(tag(q, "Subject") ?? "") || null,
        body,
        messageId: tag(q, "MessageID") || tag(q, "ExternalMessageID"),
        answered: (tag(b, "MessageStatus") ?? "") === "Answered",
        createdAt: created ? new Date(created) : null,
      });
    }

    const total = Number(tag(xml, "TotalNumberOfPages") ?? "1");
    if (page >= total) break;
  }

  return { threads };
}

// --- Import into the inbox -------------------------------------------------

export type EbayMessageSync = { ok: boolean; error?: string; imported: number; skipped: number };

/**
 * Pull buyer questions into Conversations. Deduped on the eBay message id, so
 * it is safe to run on a schedule.
 */
export async function syncEbayMessages(locationId: string, days = 30): Promise<EbayMessageSync> {
  const { threads, error } = await fetchEbayThreads(locationId, days);
  if (error && !threads.length) return { ok: false, error, imported: 0, skipped: 0 };

  let imported = 0;
  let skipped = 0;

  // Import oldest first: messages are displayed in insertion order, so a
  // newest-first page from eBay would show a conversation back to front.
  const ordered = [...threads].sort((a, b) => (a.createdAt?.getTime() ?? 0) - (b.createdAt?.getTime() ?? 0));

  for (const t of ordered) {
    if (!t.messageId || !t.sender) continue;
    const messageId = `ebay:${t.messageId}`;

    const seen = await prisma.message.findFirst({ where: { messageId }, select: { id: true } });
    if (seen) {
      skipped++;
      continue;
    }

    // eBay masks the buyer's real address, so the username is the stable key.
    let contact = await prisma.contact.findFirst({
      where: { locationId, externalId: `ebay:${t.sender}` },
      select: { id: true },
    });
    if (!contact) {
      contact = await prisma.contact.create({
        data: {
          locationId,
          firstName: t.sender,
          email: t.senderEmail ?? null,
          externalId: `ebay:${t.sender}`,
          source: "eBay message",
        },
        select: { id: true },
      });
    }

    const when = t.createdAt ?? new Date();

    // One thread per buyer per listing. eBay sends each reply as its own
    // message, so without this a single back-and-forth becomes several
    // separate inbox rows — and the AI loses the context of what was already
    // asked and answered.
    const existing = t.itemId
      ? await prisma.conversation.findFirst({
          where: { locationId, channel: "EBAY", externalUser: t.sender, externalId: t.itemId },
          select: { id: true, lastMessageAt: true },
        })
      : null;

    if (existing) {
      await prisma.message.create({
        data: { conversationId: existing.id, direction: "INBOUND", channel: "EBAY", body: t.body, messageId, receivedAt: when },
      });
      await prisma.conversation.update({
        where: { id: existing.id },
        data: {
          unread: !t.answered,
          // A newly arrived question invalidates any draft written for the
          // previous one.
          draftReply: null,
          ...(when > existing.lastMessageAt ? { lastMessageAt: when } : {}),
        },
      });
    } else {
      await prisma.conversation.create({
        data: {
          locationId,
          contactId: contact.id,
          channel: "EBAY",
          subject: t.title ? `${t.title}` : (t.subject ?? "eBay message"),
          sourceLabel: "eBay",
          externalId: t.itemId,
          externalUser: t.sender,
          unread: !t.answered,
          lastMessageAt: when,
          messages: {
            create: { direction: "INBOUND", channel: "EBAY", body: t.body, messageId, receivedAt: when },
          },
        },
      });
    }
    imported++;
  }

  return { ok: true, error, imported, skipped };
}

/** Sync every location that has eBay connected (for the cron). */
export async function syncAllEbayMessages(): Promise<{ locations: number; imported: number }> {
  const conns = await prisma.connection.findMany({
    where: { provider: "EBAY", status: "CONNECTED" },
    select: { locationId: true },
  });
  let imported = 0;
  for (const c of conns) {
    try {
      const r = await syncEbayMessages(c.locationId, 7);
      imported += r.imported;
    } catch {
      // One bad location shouldn't stop the rest.
    }
  }
  return { locations: conns.length, imported };
}

// --- AI answer -------------------------------------------------------------

const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";
const MODEL = process.env.ANTHROPIC_MODEL || "claude-haiku-4-5-20251001";

type ProductFacts = {
  name: string;
  priceCents: number | null;
  price: number | null;
  description: string | null;
  inventory: number | null;
  freightCents: number | null;
  colour: string | null;
  supplier: string | null;
  warehouse: string | null;
  shipCountries: unknown;
  category: string | null;
};

function money(cents: number | null | undefined, dollars?: number | null): string | null {
  if (typeof cents === "number") return `A$${(cents / 100).toFixed(2)}`;
  if (typeof dollars === "number") return `A$${dollars.toFixed(2)}`;
  return null;
}

/** Distinctive lower-cased words from a listing title. */
function significantWords(title: string): string[] {
  return [
    ...new Set(
      title
        .toLowerCase()
        .replace(/[^\w\s]/g, " ")
        .split(/\s+/)
        .filter((w) => w.length > 3),
    ),
  ];
}

/** The SKU eBay holds against a listing — the reliable link to our catalogue. */
async function skuForItem(locationId: string, itemId: string): Promise<string | null> {
  const token = await getValidToken(locationId);
  if (!token) return null;
  try {
    const xml = await trading(
      token,
      "GetItem",
      `<ItemID>${escapeXml(itemId)}</ItemID><DetailLevel>ReturnAll</DetailLevel><OutputSelector>Item.SKU</OutputSelector>`,
    );
    if (ackFailed(xml)) return null;
    return tag(xml, "SKU");
  } catch {
    return null;
  }
}

/**
 * Match an eBay listing to a catalogue product.
 *
 * Preferred path is the listing's SKU: eBay reports the same supplier SKU we
 * store on the product, so it's an exact link. Title matching is only the
 * fallback — eBay truncates titles to 80 characters and sellers keyword-stuff
 * them, so an exact title match lands barely 40% of the time. That fallback
 * scores candidates on how much of the title they cover and REFUSES a weak
 * match: giving the AI no facts (so it offers to confirm) is far safer than
 * facts from a different product, which becomes a wrong answer to a customer.
 */
async function matchProduct(locationId: string, title: string | null, itemId?: string | null): Promise<ProductFacts | null> {
  const select = {
    name: true, priceCents: true, price: true, description: true, inventory: true,
    freightCents: true, colour: true, supplier: true, warehouse: true, shipCountries: true, category: true,
  } as const;

  if (itemId) {
    const sku = await skuForItem(locationId, itemId);
    if (sku) {
      const bySku = await prisma.product.findFirst({ where: { locationId, sku }, select });
      if (bySku) return bySku;
    }
  }

  if (!title) return null;
  const exact = await prisma.product.findFirst({ where: { locationId, name: title }, select });
  if (exact) return exact;

  const words = significantWords(title);
  if (words.length < 2) return null;

  // Narrow with the two longest (most distinctive) words, then score.
  const anchors = [...words].sort((a, b) => b.length - a.length).slice(0, 2);
  const candidates = await prisma.product.findMany({
    where: { locationId, AND: anchors.map((w) => ({ name: { contains: w, mode: "insensitive" as const } })) },
    take: 40,
    select,
  });

  let best: ProductFacts | null = null;
  let bestScore = 0;
  for (const c of candidates) {
    const name = c.name.toLowerCase();
    const score = words.filter((w) => name.includes(w)).length / words.length;
    if (score > bestScore) {
      bestScore = score;
      best = c;
    }
  }
  return bestScore >= 0.6 ? best : null;
}

/** A few alternatives from the same category, so the AI can offer options. */
async function alternatives(locationId: string, product: ProductFacts | null): Promise<ProductFacts[]> {
  if (!product?.category) return [];
  return prisma.product.findMany({
    where: {
      locationId, active: true, category: product.category,
      name: { not: product.name },
      inventory: { gt: 0 },
    },
    orderBy: { priceCents: "desc" },
    take: 4,
    select: {
      name: true, priceCents: true, price: true, description: true, inventory: true,
      freightCents: true, colour: true, supplier: true, warehouse: true, shipCountries: true, category: true,
    },
  });
}

function factSheet(p: ProductFacts): string {
  const bits = [
    `Name: ${p.name}`,
    money(p.priceCents, p.price) ? `Our price: ${money(p.priceCents, p.price)}` : null,
    typeof p.inventory === "number" ? `Stock on hand: ${p.inventory}` : null,
    p.colour ? `Colour: ${p.colour}` : null,
    p.warehouse ? `Ships from: ${p.warehouse}` : null,
    Array.isArray(p.shipCountries) && p.shipCountries.length ? `Ships to: ${(p.shipCountries as string[]).join(", ")}` : null,
    typeof p.freightCents === "number" ? `Freight cost to us: ${money(p.freightCents)}` : null,
    p.description ? `Description: ${p.description.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").slice(0, 1200)}` : null,
  ].filter(Boolean);
  return bits.join("\n");
}

const SYSTEM = `You are answering a question from a buyer on eBay, writing as the seller.

SEARCH OUR STOCK BEFORE YOU ANSWER.
Whenever the buyer asks whether we have something — a different size, colour,
length, shelf count, capacity, model, or simply "do you stock X" — call
search_stock. Our catalogue is far bigger than what is listed on eBay, so
"we don't have one" is usually WRONG until you have searched. Search more than
once with different wording if the first attempt finds nothing.

RULES — these matter more than being helpful:
- Only state facts returned by search_stock or given in PRODUCT FACTS. Never
  invent specifications, measurements, materials, compatibility, certifications
  or compliance claims. A wrong spec becomes a return or a defect.
- If the answer isn't in those facts, say plainly that you'll confirm and come
  back to them. Do not guess.
- NEVER send the buyer off eBay. No website links, no email addresses, no phone
  numbers, no "visit our store". eBay forbids it and it risks the account.
  Refer to products by NAME and, when it is listed, by its eBay item number.
- If a product we stock is NOT yet listed on eBay (listed_on_ebay: false), say
  we do have it and that you're putting it up on eBay now and will send them the
  item number shortly. Never give them any other way to buy it.
- Never promise a delivery date. You may say where it ships from, and give a
  general timeframe only if the facts support it.
- On electrical safety, medical or compliance approval: if the facts don't cover
  it, say you'll confirm before they buy.
- Discount requests: be warm, don't commit to a number, say you'll take a look.
- Out of stock or unsuitable: offer the closest thing search_stock found.

STYLE: plain Australian English, warm and direct. 2-5 sentences. No greeting
line beyond "Hi <name>," and no sign-off block — just the message body. Never
mention that you are an AI.`;

const TOOLS = [
  {
    name: "search_stock",
    description:
      "Search the seller's full product catalogue (much larger than what is listed on eBay). Returns name, price, stock on hand, a description extract, and whether each product is already listed on eBay with its item number. Use this for any question about what we stock, alternatives, other sizes/colours/variants, or replacements.",
    input_schema: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "Keywords describing the product, e.g. 'liquor bottle display 3 shelves' or 'cat neck brace small'",
        },
      },
      required: ["query"],
    },
  },
];

export type StockHit = {
  id: string;
  name: string;
  sku: string | null;
  price: string | null;
  inventory: number | null;
  listedOnEbay: boolean;
  ebayItemId: string | null;
  extract: string | null;
};

/**
 * Keyword search over the catalogue, ranked by how many of the query's words a
 * product name contains. Narrows in SQL on the two most distinctive words so we
 * never scan all 60k rows, then ranks the shortlist in memory.
 */
export async function searchStock(locationId: string, query: string, limit = 8): Promise<StockHit[]> {
  const words = significantWords(query);
  if (!words.length) return [];
  const anchors = [...words].sort((a, b) => b.length - a.length).slice(0, 2);

  const select = {
    id: true, name: true, sku: true, priceCents: true, price: true, inventory: true,
    description: true, channels: true, ebayItemId: true,
  } as const;

  // Try the two most distinctive words together, then fall back to the single
  // best word so a slightly-off phrasing still finds something.
  let rows = await prisma.product.findMany({
    where: {
      locationId, active: true,
      AND: anchors.map((w) => ({ name: { contains: w, mode: "insensitive" as const } })),
    },
    take: 80,
    select,
  });
  if (!rows.length && anchors[0]) {
    rows = await prisma.product.findMany({
      where: { locationId, active: true, name: { contains: anchors[0], mode: "insensitive" } },
      take: 80,
      select,
    });
  }

  return rows
    .map((r) => {
      const name = r.name.toLowerCase();
      return { r, score: words.filter((w) => name.includes(w)).length };
    })
    .sort((a, b) => b.score - a.score || (b.r.inventory ?? 0) - (a.r.inventory ?? 0))
    .slice(0, limit)
    .map(({ r }) => ({
      id: r.id,
      name: r.name,
      sku: r.sku,
      price: money(r.priceCents, r.price),
      inventory: r.inventory,
      listedOnEbay: Array.isArray(r.channels) ? (r.channels as string[]).includes("ebay") : false,
      ebayItemId: r.ebayItemId,
      extract: r.description ? r.description.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").slice(0, 700) : null,
    }));
}

/** eBay bans pushing buyers off-platform — strip anything that would. */
function stripOffPlatform(text: string): string {
  return text
    .replace(/https?:\/\/\S+/gi, "")
    .replace(/\bwww\.\S+/gi, "")
    .replace(/[\w.+-]+@[\w-]+\.[\w.]+/g, "")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

export type DraftResult = {
  ok: boolean;
  draft?: string;
  error?: string;
  /** Products the AI found that aren't on eBay yet — offer to list them. */
  toList?: StockHit[];
};

/**
 * Draft an answer to an eBay buyer question.
 *
 * Claude runs a small tool loop with search_stock so it can answer "do you have
 * a shorter one?" from the whole catalogue, not just the listing being asked
 * about. Anything it finds that isn't on eBay yet comes back in `toList` so the
 * seller can publish it and give the buyer an item number — buyers must never
 * be sent off eBay.
 */
export async function draftEbayAnswer(conversationId: string): Promise<DraftResult> {
  const convo = await prisma.conversation.findUnique({
    where: { id: conversationId },
    select: {
      id: true, locationId: true, subject: true, externalUser: true, externalId: true,
      messages: { orderBy: { createdAt: "asc" }, take: 12, select: { direction: true, body: true } },
    },
  });
  if (!convo) return { ok: false, error: "Conversation not found." };

  const apiKey = (await getSetting(SETTING_KEYS.anthropicApiKey)) || process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return { ok: false, error: "No Anthropic API key set (Admin → Integrations)." };

  const product = await matchProduct(convo.locationId, convo.subject, convo.externalId);
  const alts = await alternatives(convo.locationId, product);

  const context = [
    `LISTING: ${convo.subject ?? "(unknown)"}`,
    product ? `PRODUCT FACTS:\n${factSheet(product)}` : `PRODUCT FACTS: none — this listing isn't matched to a catalogue product, so you have NO verified specifications. Answer accordingly.`,
    alts.length ? `ALTERNATIVES:\n${alts.map((a) => `- ${a.name}${money(a.priceCents, a.price) ? ` (${money(a.priceCents, a.price)})` : ""}`).join("\n")}` : "",
    `BUYER USERNAME: ${convo.externalUser ?? "buyer"}`,
  ]
    .filter(Boolean)
    .join("\n\n");

  const transcript = convo.messages
    .map((m) => `${m.direction === "INBOUND" ? "Buyer" : "Seller"}: ${m.body}`)
    .join("\n\n");

  type Block =
    | { type: "text"; text?: string }
    | { type: "tool_use"; id: string; name: string; input: Record<string, unknown> };

  const messages: { role: "user" | "assistant"; content: unknown }[] = [
    { role: "user", content: `${context}\n\nCONVERSATION SO FAR:\n${transcript}\n\nWrite the seller's reply.` },
  ];
  const found = new Map<string, StockHit>();

  try {
    // A few rounds is plenty: search, maybe re-search with different wording,
    // then answer.
    for (let round = 0; round < 4; round++) {
      const res = await fetch(ANTHROPIC_URL, {
        method: "POST",
        headers: { "content-type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
        body: JSON.stringify({ model: MODEL, max_tokens: 900, system: SYSTEM, tools: TOOLS, messages }),
      });
      if (!res.ok) return { ok: false, error: `AI error ${res.status}: ${(await res.text()).slice(0, 160)}` };

      const json = (await res.json()) as { content?: Block[]; stop_reason?: string };
      const blocks = json.content ?? [];

      const calls = blocks.filter((b): b is Extract<Block, { type: "tool_use" }> => b.type === "tool_use");
      if (json.stop_reason === "tool_use" && calls.length) {
        messages.push({ role: "assistant", content: blocks });
        const results = [];
        for (const call of calls) {
          const query = typeof call.input?.query === "string" ? call.input.query : "";
          const hits = call.name === "search_stock" ? await searchStock(convo.locationId, query) : [];
          for (const h of hits) found.set(h.id, h);
          results.push({
            type: "tool_result",
            tool_use_id: call.id,
            content: hits.length
              ? JSON.stringify(hits.map(({ id: _id, ...rest }) => ({ ...rest, listed_on_ebay: rest.listedOnEbay })))
              : "No products matched that search.",
          });
        }
        messages.push({ role: "user", content: results });
        continue;
      }

      const raw = blocks.filter((b) => b.type === "text").map((b) => ("text" in b ? b.text ?? "" : "")).join("").trim();
      if (!raw) return { ok: false, error: "The AI returned an empty reply." };
      const draft = stripOffPlatform(raw);

      await prisma.conversation.update({ where: { id: conversationId }, data: { draftReply: draft } });
      return {
        ok: true,
        draft,
        toList: [...found.values()].filter((h) => !h.listedOnEbay),
      };
    }
    return { ok: false, error: "The AI kept searching without answering — try again." };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "AI request failed." };
  }
}

// --- Listing on demand -----------------------------------------------------

export type ListNowResult = { ok: boolean; itemId?: string; name?: string; error?: string };

/**
 * Publish a catalogue product to eBay so we can give the buyer an item number.
 *
 * This is the "we do have one, it just isn't up yet" path: the seller can't
 * point the buyer anywhere off eBay, so the only legitimate move is to list it
 * and reply with the item number.
 */
export async function listProductForBuyer(locationId: string, productId: string): Promise<ListNowResult> {
  const product = await prisma.product.findFirst({
    where: { id: productId, locationId },
    select: {
      id: true, externalId: true, name: true, description: true, imageUrl: true,
      priceCents: true, inventory: true, sku: true, category: true, shipCountries: true, ebayItemId: true,
    },
  });
  if (!product) return { ok: false, error: "Product not found." };
  if (product.ebayItemId) return { ok: true, itemId: product.ebayItemId, name: product.name };

  const { resolveListingContext, pushProductToEbay } = await import("@/lib/ebay-listing");
  const token = await getValidToken(locationId);
  if (!token) return { ok: false, error: "eBay isn't connected — reconnect eBay." };

  const resolved = await resolveListingContext(token);
  if (!resolved.ok || !resolved.ctx) return { ok: false, error: resolved.reason ?? "Couldn't read your eBay business policies." };

  const r = await pushProductToEbay(locationId, product, resolved.ctx, token);
  if (!r.ok) return { ok: false, error: r.reason ?? "eBay rejected the listing." };

  await prisma.product.update({
    where: { id: product.id },
    data: { ebayItemId: r.listingId ?? null },
  });
  await prisma.$executeRaw`UPDATE "Product" SET channels = (CASE WHEN channels @> '"ebay"'::jsonb THEN channels ELSE channels || '"ebay"'::jsonb END) WHERE id = ${product.id}`;

  return { ok: true, itemId: r.listingId, name: product.name };
}

// --- Sending ---------------------------------------------------------------

export type SendResult = { ok: boolean; error?: string };

/**
 * Send a reply back to the buyer on eBay (AddMemberMessageRTQ = "respond to
 * question"), and record it on the conversation.
 */
export async function sendEbayReply(conversationId: string, body: string): Promise<SendResult> {
  const convo = await prisma.conversation.findUnique({
    where: { id: conversationId },
    select: {
      id: true, locationId: true, externalId: true, externalUser: true,
      messages: {
        where: { direction: "INBOUND" },
        orderBy: { createdAt: "desc" },
        take: 1,
        select: { messageId: true },
      },
    },
  });
  if (!convo) return { ok: false, error: "Conversation not found." };
  if (!convo.externalId || !convo.externalUser) return { ok: false, error: "This thread isn't linked to an eBay listing." };

  const parent = convo.messages[0]?.messageId?.replace(/^ebay:/, "");
  if (!parent) return { ok: false, error: "No original eBay message to reply to." };

  const token = await getValidToken(convo.locationId);
  if (!token) return { ok: false, error: "eBay isn't connected — reconnect eBay." };

  const xml = await trading(
    token,
    "AddMemberMessageRTQ",
    `<ItemID>${escapeXml(convo.externalId)}</ItemID>` +
      `<MemberMessage>` +
      `<Body>${escapeXml(body)}</Body>` +
      `<ParentMessageID>${escapeXml(parent)}</ParentMessageID>` +
      `<RecipientID>${escapeXml(convo.externalUser)}</RecipientID>` +
      `<DisplayToPublic>false</DisplayToPublic>` +
      `</MemberMessage>`,
  );
  const err = ackFailed(xml);
  if (err) return { ok: false, error: err };

  await prisma.message.create({
    data: { conversationId, direction: "OUTBOUND", channel: "EBAY", body },
  });
  await prisma.conversation.update({
    where: { id: conversationId },
    data: { unread: false, draftReply: null, lastMessageAt: new Date() },
  });

  return { ok: true };
}
