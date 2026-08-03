import "server-only";
import crypto from "crypto";
import { prisma } from "@/lib/db";
import { getSetting, SETTING_KEYS } from "@/lib/platform-settings";

// ---------------------------------------------------------------------------
// AI receptionist engine. v1 uses Twilio's speech-gather loop: caller speaks,
// Claude decides {say, action}, Twilio speaks it back with a neural voice.
// Latency ~2-3s per turn; the architecture leaves room for a streaming
// upgrade without changing the data model or webhooks.
// ---------------------------------------------------------------------------

export type Turn = { role: "caller" | "ai"; text: string; at: string };
export type AiDecision = { say: string; action: "continue" | "transfer" | "end"; note?: string };

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/* ------------------------------ TwiML ------------------------------ */

export function xml(body: string): Response {
  return new Response(`<?xml version="1.0" encoding="UTF-8"?><Response>${body}</Response>`, {
    headers: { "content-type": "text/xml" },
  });
}

export function sayGather(voiceName: string, text: string, gatherUrl: string): string {
  return (
    `<Say voice="${esc(voiceName)}">${esc(text)}</Say>` +
    `<Gather input="speech" language="en-AU" speechTimeout="auto" action="${esc(gatherUrl)}" method="POST"/>` +
    // Caller stayed silent — one gentle nudge, then a polite goodbye.
    `<Say voice="${esc(voiceName)}">Are you still there?</Say>` +
    `<Gather input="speech" language="en-AU" speechTimeout="auto" action="${esc(gatherUrl)}" method="POST"/>` +
    `<Say voice="${esc(voiceName)}">No worries — call back any time. Bye for now.</Say><Hangup/>`
  );
}

export function sayTransfer(voiceName: string, text: string, to: string): string {
  return `<Say voice="${esc(voiceName)}">${esc(text)}</Say><Dial timeout="25">${esc(to)}</Dial>` +
    `<Say voice="${esc(voiceName)}">Sorry, I couldn't reach them. I've taken a note and someone will call you back. Bye for now.</Say><Hangup/>`;
}

export function sayBye(voiceName: string, text: string): string {
  return `<Say voice="${esc(voiceName)}">${esc(text)}</Say><Hangup/>`;
}

/* --------------------------- Twilio security --------------------------- */

/** Validate X-Twilio-Signature (HMAC-SHA1 of url + sorted form params). */
export function validTwilioSignature(url: string, params: Record<string, string>, signature: string | null): boolean {
  const token = process.env.TWILIO_AUTH_TOKEN;
  if (!token) return true; // not configured yet — allow (dev/bootstrap)
  if (!signature) return false;
  const data = url + Object.keys(params).sort().map((k) => k + params[k]).join("");
  const expected = crypto.createHmac("sha1", token).update(Buffer.from(data, "utf8")).digest("base64");
  try { return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature)); } catch { return false; }
}

export async function formParams(req: Request): Promise<Record<string, string>> {
  const fd = await req.formData().catch(() => null);
  const out: Record<string, string> = {};
  if (fd) for (const [k, v] of fd.entries()) if (typeof v === "string") out[k] = v;
  return out;
}

/* ----------------------------- business brain ----------------------------- */

async function businessContext(locationId: string): Promise<string> {
  const [location, agent, calendars, products] = await Promise.all([
    prisma.location.findUnique({ where: { id: locationId }, select: { name: true, phone: true, timezone: true } }),
    prisma.voiceAgent.findUnique({ where: { locationId } }),
    prisma.calendar.findMany({ where: { locationId }, take: 6, select: { name: true, durationMinutes: true, price: true } }),
    prisma.product.findMany({ where: { locationId, active: true }, orderBy: { position: "asc" }, take: 8, select: { name: true, price: true, priceCents: true } }),
  ]);
  const lines = [
    `Business: ${location?.name ?? "this business"}`,
    agent?.hours ? `Opening hours: ${agent.hours}` : "",
    calendars.length ? `Bookable services: ${calendars.map((c) => `${c.name} (${c.durationMinutes}min${c.price ? `, $${c.price}` : ""})`).join("; ")}` : "",
    products.length ? `Products/services: ${products.map((p) => `${p.name}${p.priceCents ? ` $${(p.priceCents / 100).toFixed(2)}` : p.price ? ` $${p.price}` : ""}`).join("; ")}` : "",
    agent?.knowledge ? `Notes from the owner:\n${agent.knowledge}` : "",
    agent?.transferTo ? "A live transfer to the owner IS available." : "No live transfer available — take a message instead.",
  ];
  return lines.filter(Boolean).join("\n");
}

/** Live catalogue lookup: when the caller names a product, search the REAL
 *  inventory instead of trusting the tiny context sample (the "air fryer"
 *  lesson — never deny stocking something without checking). */
async function productLookup(locationId: string, callerText: string): Promise<string> {
  const STOP = new Set(["the", "and", "you", "your", "how", "much", "many", "have", "has", "are", "was", "sell", "sale", "sales", "stock", "got", "does", "do", "what", "price", "cost", "they", "them", "there", "for", "can", "with", "any", "some", "get", "buy", "want", "need", "looking", "about", "please", "hello", "thanks", "that", "this", "just"]);
  const raw = callerText.toLowerCase().split(/[^a-z0-9]+/).filter((w) => w.length >= 3 && !STOP.has(w));
  if (!raw.length) return "";
  const depl = (w: string) => w.replace(/s$/, "");

  const select = { name: true, priceCents: true, price: true, inventory: true };
  // 1) Phrases first: adjacent word pairs ("air fryers" → "air fryer") are far
  //    more precise than single words and win when they hit anything.
  const bigrams: string[] = [];
  for (let i = 0; i < raw.length - 1; i++) bigrams.push(`${depl(raw[i])} ${depl(raw[i + 1])}`);
  let hits: { name: string; priceCents: number | null; price: number | null; inventory: number | null }[] = [];
  if (bigrams.length) {
    hits = await prisma.product.findMany({
      where: { locationId, active: true, OR: bigrams.map((b) => ({ name: { contains: b, mode: "insensitive" as const } })) },
      orderBy: { inventory: "desc" }, take: 5, select,
    });
  }
  // 2) Fall back to the most specific single words (longest first).
  if (!hits.length) {
    const words = Array.from(new Set(raw.flatMap((w) => [depl(w), w]))).filter((w) => w.length >= 4).sort((a, b) => b.length - a.length).slice(0, 4);
    if (!words.length) return "";
    hits = await prisma.product.findMany({
      where: { locationId, active: true, OR: words.map((w) => ({ name: { contains: w, mode: "insensitive" as const } })) },
      orderBy: { inventory: "desc" }, take: 5, select,
    });
  }
  if (!hits.length) return "";
  return (
    "Live catalogue matches for what the caller mentioned (these ARE in stock unless qty 0):\n" +
    hits.map((p) => `- ${p.name} — $${p.priceCents ? (p.priceCents / 100).toFixed(2) : p.price ?? "?"}${p.inventory != null ? ` (${p.inventory} in stock)` : ""}`).join("\n")
  );
}

/** One conversational turn: caller said something → what do we say/do? */
export async function decide(locationId: string, transcript: Turn[]): Promise<AiDecision> {
  const key = (await getSetting(SETTING_KEYS.anthropicApiKey)) || process.env.ANTHROPIC_API_KEY;
  const lastCaller = transcript.filter((t) => t.role === "caller").pop()?.text ?? "";
  const [ctxBase, products] = await Promise.all([businessContext(locationId), productLookup(locationId, lastCaller)]);
  const ctx = products ? `${ctxBase}\n\n${products}` : ctxBase;
  const history = transcript.slice(-12).map((t) => `${t.role === "caller" ? "Caller" : "You"}: ${t.text}`).join("\n");

  if (key) {
    try {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "content-type": "application/json", "x-api-key": key, "anthropic-version": "2023-06-01" },
        body: JSON.stringify({
          model: "claude-haiku-4-5-20251001",
          max_tokens: 250,
          system:
            `You are the warm, efficient Australian phone receptionist for the business below. Speak naturally and BRIEFLY (1-2 short sentences — this is a phone call). Answer questions from the business info only; never invent details. Always try to capture the caller's name and what they need. Offer to take a message, or a live transfer if available and the caller needs a human. When you have taken a message or finished helping, wrap up politely.\n\n${ctx}\n\nRespond ONLY with JSON: {"say":"<what you say next>","action":"continue|transfer|end","note":"<if a message/lead was captured: name, number if given, and what they want — else omit>"}`,
          messages: [{ role: "user", content: `Call so far:\n${history}\n\nWhat do you say next?` }],
        }),
      });
      if (res.ok) {
        const j = (await res.json()) as { content?: { text?: string }[] };
        const text = j.content?.map((c) => c.text ?? "").join("").trim() ?? "";
        const m = text.match(/\{[\s\S]*\}/);
        if (m) {
          const p = JSON.parse(m[0]) as Partial<AiDecision>;
          if (p.say) return { say: String(p.say).slice(0, 600), action: p.action === "transfer" || p.action === "end" ? p.action : "continue", note: p.note ? String(p.note).slice(0, 500) : undefined };
        }
      }
    } catch { /* fall through to heuristic */ }
  }

  // Heuristic fallback — still useful when the AI key is unavailable.
  const last = transcript.filter((t) => t.role === "caller").pop()?.text.toLowerCase() ?? "";
  if (/(speak|talk).*(someone|human|person|owner)|manager/.test(last)) return { say: "Of course — connecting you now.", action: "transfer" };
  if (/(open|hour|close|when)/.test(last)) return { say: "I'll have someone confirm our exact hours with you. Could I grab your name and number so we can call you back?", action: "continue" };
  if (/(bye|thank|that's all|no thanks)/.test(last)) return { say: "Thanks for calling — have a great day!", action: "end" };
  return { say: "I can take a message for the team. Could I get your name, your number, and what it's regarding?", action: "continue", note: last ? `Caller said: ${last}` : undefined };
}

/* ----------------------------- call wrap-up ----------------------------- */

/** On call completion: file the transcript into the inbox + create the lead. */
export async function finalizeCall(callSid: string, durationSec: number | null): Promise<void> {
  const call = await prisma.callLog.findUnique({ where: { callSid } });
  if (!call || call.status === "filed") return;
  const transcript = (call.transcript as Turn[]) ?? [];

  // Contact: match by phone or create a new lead.
  let contactId = call.contactId;
  if (!contactId && call.fromNumber && call.fromNumber !== "anonymous") {
    const existing = await prisma.contact.findFirst({ where: { locationId: call.locationId, phone: call.fromNumber } });
    const contact = existing ?? (await prisma.contact.create({
      data: { locationId: call.locationId, firstName: "Caller", lastName: call.fromNumber.slice(-4), phone: call.fromNumber, source: "AI receptionist" },
    }));
    contactId = contact.id;
  }

  const body = transcript.length
    ? transcript.map((t) => `${t.role === "caller" ? "📞 Caller" : "🤖 Receptionist"}: ${t.text}`).join("\n")
    : "(no speech captured)";

  const convo = await prisma.conversation.create({
    data: {
      locationId: call.locationId,
      contactId,
      channel: "PHONE",
      subject: `Call from ${call.fromNumber}${durationSec ? ` · ${Math.round(durationSec / 60)}m${durationSec % 60}s` : ""}`,
      sourceLabel: "AI Receptionist",
      unread: true,
      messages: { create: { direction: "INBOUND", channel: "PHONE", body } },
    },
  });

  // If the AI captured a message/lead note, surface it as a task.
  const notes = transcript.length ? await lastNote(call.id) : null;
  if (notes) {
    await prisma.task.create({
      data: { locationId: call.locationId, contactId: contactId ?? undefined, title: `📞 Call back: ${notes.slice(0, 90)}`, dueAt: new Date(Date.now() + 4 * 3600_000) },
    }).catch(() => {});
  }

  await prisma.callLog.update({ where: { callSid }, data: { status: "filed", durationSec: durationSec ?? undefined, contactId, summary: notes ?? undefined } });

  // Meter the call: billed per started minute at the platform retail rate.
  // This ledger row is what the monthly Stripe rollup charges the business.
  if (durationSec && durationSec > 0) {
    const minutes = Math.max(1, Math.ceil(durationSec / 60));
    const unitCents = parseInt(process.env.VOICE_RATE_CENTS ?? "", 10) || 25; // default $0.25/min retail
    await prisma.usageEvent.create({
      data: { locationId: call.locationId, kind: "voice_min", qty: minutes, unitCents, totalCents: minutes * unitCents, ref: callSid },
    }).catch(() => {});
  }
  void convo;
}

async function lastNote(callLogId: string): Promise<string | null> {
  const call = await prisma.callLog.findUnique({ where: { id: callLogId } });
  const t = (call?.transcript as (Turn & { note?: string })[]) ?? [];
  const withNote = [...t].reverse().find((x) => x.note);
  return withNote?.note ?? null;
}
