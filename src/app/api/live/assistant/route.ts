import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSetting, SETTING_KEYS } from "@/lib/platform-settings";

export const dynamic = "force-dynamic";

// The live "sales assistant": given the shopper's answers and the shelf of
// candidate products, pick the best 3 with a short pitch each. Uses the platform
// Anthropic key when available; otherwise a keyword + budget heuristic so the show
// always ends with 3 good picks (the CRM AI key can run out of credit).

type Answers = { who?: string; priority?: string; budget?: string; note?: string };
type Cand = { id: string; name: string; description: string | null; priceCents: number; inventory: number | null; imageUrl: string | null };

const BUDGET: Record<string, [number, number]> = {
  "under-25": [0, 2500],
  "25-75": [2500, 7500],
  "75-200": [7500, 20000],
  any: [0, Number.MAX_SAFE_INTEGER],
};
const STOP = new Set(["the", "and", "for", "with", "who", "what", "something", "someone", "myself", "gift", "home", "our", "any", "best", "good", "great", "shopping"]);

export async function POST(req: NextRequest) {
  let body: { locationId?: string; answers?: Answers; candidateIds?: string[] };
  try { body = await req.json(); } catch { return NextResponse.json({ error: "bad request" }, { status: 400 }); }

  const locationId = String(body.locationId ?? "");
  const answers = body.answers ?? {};
  const ids = Array.isArray(body.candidateIds) ? body.candidateIds.filter((x) => typeof x === "string").slice(0, 40) : [];
  if (!locationId || ids.length === 0) return NextResponse.json({ error: "locationId and candidateIds required" }, { status: 400 });

  const rows = await prisma.product.findMany({
    where: { id: { in: ids }, locationId, active: true },
    select: { id: true, name: true, description: true, priceCents: true, price: true, inventory: true, imageUrl: true },
  });
  const cands: Cand[] = rows.map((p) => ({
    id: p.id, name: p.name, description: p.description, inventory: p.inventory, imageUrl: p.imageUrl,
    priceCents: typeof p.priceCents === "number" && p.priceCents > 0 ? p.priceCents : Math.round((p.price ?? 0) * 100),
  }));
  if (cands.length === 0) return NextResponse.json({ picks: [] });

  const key = (await getSetting(SETTING_KEYS.anthropicApiKey)) || process.env.ANTHROPIC_API_KEY;
  if (key && cands.length > 3) {
    const ai = await aiPick(key, answers, cands);
    if (ai) return NextResponse.json({ picks: ai });
  }
  return NextResponse.json({ picks: heuristicPick(answers, cands) });
}

async function aiPick(key: string, answers: Answers, cands: Cand[]) {
  const list = cands
    .map((c, i) => `${i + 1}. ${c.name} — ${money(c.priceCents)}${c.description ? ` — ${c.description.slice(0, 120)}` : ""}`)
    .join("\n");
  const want = [
    answers.who ? `Shopping for: ${answers.who}` : "",
    answers.priority ? `Priority: ${answers.priority}` : "",
    answers.budget ? `Budget: ${answers.budget}` : "",
    answers.note ? `In their words: ${answers.note}` : "",
  ].filter(Boolean).join("\n");
  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "content-type": "application/json", "x-api-key": key, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 400,
        system:
          'You are a warm live-shopping sales assistant. From the numbered product list, choose the 3 products that best match the shopper\'s answers. Respect their budget. Return ONLY valid JSON, no prose: {"picks":[{"n":<list number>,"pitch":"<one warm sentence, max 16 words, why it suits them>"}]}. Exactly 3 distinct picks.',
        messages: [{ role: "user", content: `Shopper:\n${want || "(no preferences given)"}\n\nProducts:\n${list}` }],
      }),
    });
    if (!res.ok) return null;
    const j = (await res.json()) as { content?: { text?: string }[] };
    const text = j.content?.map((c) => c.text ?? "").join("").trim() ?? "";
    const m = text.match(/\{[\s\S]*\}/);
    if (!m) return null;
    const parsed = JSON.parse(m[0]) as { picks?: { n?: number; pitch?: string }[] };
    const picks = (parsed.picks ?? [])
      .map((p) => ({ c: cands[(p.n ?? 0) - 1], pitch: String(p.pitch ?? "").slice(0, 140) }))
      .filter((x) => x.c)
      .slice(0, 3)
      .map(({ c, pitch }) => ({ id: c.id, name: c.name, priceCents: c.priceCents, imageUrl: c.imageUrl, pitch: pitch || "A great match for you." }));
    return picks.length ? picks : null;
  } catch {
    return null;
  }
}

function heuristicPick(answers: Answers, cands: Cand[]) {
  const [lo, hi] = BUDGET[answers.budget ?? "any"] ?? BUDGET.any;
  const wants = [answers.who, answers.priority, answers.note].filter(Boolean).join(" ").toLowerCase();
  const words = Array.from(new Set(wants.split(/[^a-z0-9]+/).filter((w) => w.length >= 3 && !STOP.has(w))));
  const priceFocus = /price|cheap|budget|value|save/.test((answers.priority ?? "").toLowerCase());
  const qualityFocus = /quality|premium|best|top|durable/.test((answers.priority ?? "").toLowerCase());

  const scored = cands.map((c) => {
    const text = `${c.name} ${c.description ?? ""}`.toLowerCase();
    let s = 0;
    for (const w of words) if (text.includes(w)) s += 2;
    const inBudget = c.priceCents >= lo && c.priceCents <= hi;
    if (inBudget) s += 3; else if (c.priceCents > hi) s -= 4;
    if (priceFocus) s += Math.max(0, 2 - c.priceCents / 5000); // cheaper ranks higher
    if (qualityFocus && /pro|premium|deluxe|max|ultra|hd|stainless|genuine/.test(text)) s += 2;
    if (c.inventory == null || c.inventory > 0) s += 0.5;
    return { c, s, inBudget };
  });
  scored.sort((a, b) => b.s - a.s || a.c.priceCents - b.c.priceCents);

  return scored.slice(0, 3).map(({ c, inBudget }, i) => ({
    id: c.id, name: c.name, priceCents: c.priceCents, imageUrl: c.imageUrl,
    pitch: pitchFor(i, c, inBudget, priceFocus, qualityFocus, words),
  }));
}

function pitchFor(i: number, c: Cand, inBudget: boolean, price: boolean, quality: boolean, words: string[]): string {
  const matched = words.find((w) => `${c.name} ${c.description ?? ""}`.toLowerCase().includes(w));
  if (matched) return `Matches what you asked for — and it's ${money(c.priceCents)}.`;
  if (price && i === 0) return `Best value on the shelf at ${money(c.priceCents)}.`;
  if (quality) return `A premium pick — ${money(c.priceCents)}, built to last.`;
  if (inBudget) return `Right in your budget at ${money(c.priceCents)}.`;
  return `A top pick from this store — ${money(c.priceCents)}.`;
}

function money(cents: number): string {
  return cents === 0 ? "Free" : `$${(cents / 100).toLocaleString(undefined, { minimumFractionDigits: 2 })}`;
}
