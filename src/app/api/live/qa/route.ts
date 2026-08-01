import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSetting, SETTING_KEYS } from "@/lib/platform-settings";

export const dynamic = "force-dynamic";

// AI product Q&A for the on-site live shopping block. Uses the platform Anthropic
// key when set; otherwise a data-driven fallback so it's always useful.
export async function POST(req: NextRequest) {
  let body: { productId?: string; question?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "bad request" }, { status: 400 });
  }
  const question = String(body.question ?? "").trim().slice(0, 500);
  const productId = String(body.productId ?? "");
  if (!question) return NextResponse.json({ answer: "Ask me anything about this product!" });

  const p = productId
    ? await prisma.product.findUnique({
        where: { id: productId },
        select: { name: true, description: true, priceCents: true, price: true, inventory: true },
      })
    : null;

  const price = p ? money(typeof p.priceCents === "number" && p.priceCents > 0 ? p.priceCents : Math.round((p.price ?? 0) * 100)) : "";
  const ctx = p
    ? `Product: ${p.name}\nPrice: ${price}\nStock: ${p.inventory == null ? "in stock" : p.inventory > 0 ? `${p.inventory} available` : "out of stock"}\nDescription: ${p.description ?? "(none provided)"}`
    : "No product selected.";

  const key = (await getSetting(SETTING_KEYS.anthropicApiKey)) || process.env.ANTHROPIC_API_KEY;
  if (key) {
    try {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "content-type": "application/json", "x-api-key": key, "anthropic-version": "2023-06-01" },
        body: JSON.stringify({
          model: "claude-haiku-4-5-20251001",
          max_tokens: 300,
          system:
            "You are a friendly live-shopping host assistant. Answer the shopper's question about the product using ONLY the product info provided. Be concise (1-3 sentences), warm and helpful. If the info doesn't cover it, say what you can and suggest they add it to cart, without inventing specifics.",
          messages: [{ role: "user", content: `${ctx}\n\nShopper question: ${question}` }],
        }),
      });
      if (res.ok) {
        const j = (await res.json()) as { content?: { text?: string }[] };
        const text = j.content?.map((c) => c.text ?? "").join("").trim();
        if (text) return NextResponse.json({ answer: text });
      }
    } catch {
      /* fall through */
    }
  }

  return NextResponse.json({ answer: heuristic(question, p, price) });
}

function money(cents: number): string {
  return cents === 0 ? "Free" : `$${(cents / 100).toLocaleString(undefined, { minimumFractionDigits: 2 })}`;
}
function heuristic(q: string, p: { name: string; description: string | null; inventory: number | null } | null, price: string): string {
  const s = q.toLowerCase();
  if (!p) return "Pick a product on the channel and I'll help.";
  if (/(price|cost|how much|cheap|expensive)/.test(s)) return `${p.name} is ${price}.`;
  if (/(ship|deliver|postage|freight|arrive)/.test(s)) return "It ships Australia-wide — shipping is worked out at checkout.";
  if (/(stock|available|in stock|left|sold out)/.test(s))
    return p.inventory == null ? "It's in stock and ready to order." : p.inventory > 0 ? `Yes — ${p.inventory} in stock.` : "Sorry, out of stock right now.";
  if (/(return|refund|warranty|guarantee)/.test(s)) return "Returns and warranty are covered — details come with your order confirmation.";
  if (p.description) return `${p.description.split(/(?<=\.)\s/).slice(0, 2).join(" ").slice(0, 320)} — want it in your cart?`;
  return `Great pick! ${p.name} is ${price}. Add it to your cart to grab it — anything specific you'd like to know?`;
}
