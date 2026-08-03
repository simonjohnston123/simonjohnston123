import "server-only";
import { prisma } from "@/lib/db";
import { getSetting, SETTING_KEYS } from "@/lib/platform-settings";

// Reel Studio script generation. Produces the video factory's queue.json shape
// (overlay_title, rrp_line, now_line, ticker, images[], chunks[]) following the
// factory's LOCKED sales formula: HOOK(who) → PAIN → DREAM → feature→benefit→
// emotion → TRUST → PRICE DRAMA → SCARCITY+CTA. Chunks ≤35s spoken. No "G'day".

export type ReelScript = {
  overlay_title: string;
  rrp_line: string;
  now_line: string;
  ticker: string;
  images: string[];
  chunks: string[];
};

const money = (cents: number) => `$${(cents / 100).toFixed(2)}`;

export async function generateReelScript(locationId: string, productId: string): Promise<{ script: ReelScript; productName: string } | null> {
  const p = await prisma.product.findFirst({
    where: { id: productId, locationId, active: true },
    select: { name: true, description: true, priceCents: true, price: true, imageUrl: true, images: true, inventory: true },
  });
  if (!p) return null;

  const priceCents = p.priceCents && p.priceCents > 0 ? p.priceCents : Math.round((p.price ?? 0) * 100);
  const rrp = Math.round(priceCents * 1.35); // display compare-at
  const gallery = [p.imageUrl, ...((Array.isArray(p.images) ? p.images : []) as string[])].filter((x): x is string => !!x).slice(0, 4);

  const fallback: ReelScript = {
    overlay_title: p.name.slice(0, 48),
    rrp_line: `RRP ${money(rrp)}`,
    now_line: `NOW ${money(priceCents)}`,
    ticker: `${p.name.slice(0, 60)}  •  FAST AU SHIPPING  •  WHILE STOCKS LAST`,
    images: gallery,
    chunks: [
      `If you've been hunting for a ${p.name.split(" ").slice(0, 4).join(" ").toLowerCase()}, stop scrolling — this one's for you. Tired of overpaying and waiting weeks for delivery? Same.`,
      `This ships fast from Australia, does exactly what it promises, and right now it's down from ${money(rrp)} to just ${money(priceCents)}. Stock's moving — grab yours at Placid Deals before it's gone.`,
    ],
  };

  const key = (await getSetting(SETTING_KEYS.anthropicApiKey)) || process.env.ANTHROPIC_API_KEY;
  if (!key) return { script: fallback, productName: p.name };

  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "content-type": "application/json", "x-api-key": key, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({
        model: process.env.ANTHROPIC_MODEL || "claude-haiku-4-5-20251001",
        max_tokens: 700,
        system:
          `You write 30-second spoken sales scripts for a photoreal AI presenter on a vertical shopping video. Follow EXACTLY this formula across 2 chunks (each spoken ≤30 seconds, conversational Australian English, NEVER say "G'day", no emoji, no stage directions): chunk 1 = HOOK naming who it's for → their PAIN → the DREAM outcome. chunk 2 = one feature→benefit→emotion beat → TRUST line (fast AU shipping, easy returns) → PRICE DRAMA (was/now) → SCARCITY + call to action "at Placid Deals". Respond ONLY with JSON: {"overlay_title":"<max 42 chars punchy>","ticker":"<max 70 chars scrolling ticker, ALL CAPS segments separated by  •  >","chunks":["...","..."]}`,
        messages: [{ role: "user", content: `Product: ${p.name}\nPrice now: ${money(priceCents)} (was ${money(rrp)})\nDescription: ${(p.description ?? "").slice(0, 500) || "(none)"}\nStock: ${p.inventory ?? "plenty"}` }],
      }),
    });
    if (res.ok) {
      const j = (await res.json()) as { content?: { text?: string }[] };
      const text = j.content?.map((c) => c.text ?? "").join("") ?? "";
      const m = text.match(/\{[\s\S]*\}/);
      if (m) {
        const parsed = JSON.parse(m[0]) as Partial<ReelScript> & { chunks?: string[] };
        if (parsed.chunks?.length) {
          return {
            productName: p.name,
            script: {
              overlay_title: (parsed.overlay_title || fallback.overlay_title).slice(0, 48),
              rrp_line: fallback.rrp_line,
              now_line: fallback.now_line,
              ticker: (parsed.ticker || fallback.ticker).slice(0, 80),
              images: gallery,
              chunks: parsed.chunks.slice(0, 3).map((c) => String(c).slice(0, 600)),
            },
          };
        }
      }
    }
  } catch { /* fallback below */ }
  return { script: fallback, productName: p.name };
}
