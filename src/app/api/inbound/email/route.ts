import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

// ---------------------------------------------------------------------------
// Inbound email webhook. Resend (or any inbound-email provider) POSTs incoming
// mail here; we route it to the right sub-account and drop it into that
// business's Conversations as an INBOUND message — the CRM's shared inbox.
//
// Activation (once placid.group is verified in Resend):
//   1. Add an MX record on inbox.placid.group pointing to Resend inbound.
//   2. Point Resend's inbound webhook at https://placidcrm.com/api/inbound/email
//   3. Set RESEND_WEBHOOK_SECRET (whsec_...) so signatures are verified.
// Until then this endpoint is live but simply receives nothing.
// ---------------------------------------------------------------------------

/** Verify a Svix-style signed webhook (Resend uses Svix). */
function verifySignature(secret: string, req: NextRequest, rawBody: string): boolean {
  try {
    const id = req.headers.get("svix-id");
    const timestamp = req.headers.get("svix-timestamp");
    const signature = req.headers.get("svix-signature");
    if (!id || !timestamp || !signature) return false;

    const key = Buffer.from(secret.replace(/^whsec_/, ""), "base64");
    const signedContent = `${id}.${timestamp}.${rawBody}`;
    const expected = crypto.createHmac("sha256", key).update(signedContent).digest("base64");

    // svix-signature is a space-separated list of "v1,<sig>"
    return signature.split(" ").some((part) => {
      const sig = part.split(",")[1] ?? part;
      try {
        return crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected));
      } catch {
        return false;
      }
    });
  } catch {
    return false;
  }
}

function addressOf(raw: unknown): string {
  const s = String(raw ?? "");
  const m = s.match(/<([^>]+)>/);
  return (m ? m[1] : s).trim().toLowerCase();
}

function nameOf(raw: unknown): string | null {
  const s = String(raw ?? "").trim();
  const m = s.match(/^\s*"?([^"<]+?)"?\s*</);
  return m ? m[1].trim() : null;
}

function stripHtml(html: unknown): string {
  return String(html ?? "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const INBOUND_DOMAIN = process.env.INBOUND_DOMAIN || "inbox.placid.group";

export async function POST(req: NextRequest) {
  const raw = await req.text();

  const secret = process.env.RESEND_WEBHOOK_SECRET;
  if (secret && !verifySignature(secret, req, raw)) {
    return NextResponse.json({ error: "invalid signature" }, { status: 401 });
  }

  let evt: Record<string, unknown>;
  try {
    evt = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }

  const data = (evt.data ?? evt) as Record<string, unknown>;
  const from = addressOf(data.from);
  const toRaw = Array.isArray(data.to) ? data.to[0] : data.to;
  const to = addressOf(toRaw);
  const subject = String(data.subject ?? "").trim();
  const text = (String(data.text ?? "").trim() || stripHtml(data.html)).slice(0, 20000);

  if (!from) return NextResponse.json({ ok: true, skipped: "no sender" });

  // Route to a sub-account. Convention: the local-part of the recipient matches
  // the location slug (e.g. placid-storage-solutions@inbox.placid.group). If
  // there's only one business, everything lands there.
  const localpart = to.split("@")[0]?.toLowerCase();
  let location = localpart
    ? await prisma.location.findFirst({ where: { slug: localpart } })
    : null;
  if (!location) {
    const count = await prisma.location.count();
    if (count === 1) location = await prisma.location.findFirst();
  }
  if (!location) {
    return NextResponse.json({ ok: true, skipped: `no location for ${to}` });
  }

  // Match or create the contact by sender email.
  let contact = await prisma.contact.findFirst({
    where: { locationId: location.id, email: from },
  });
  if (!contact) {
    const nm = nameOf(data.from);
    const parts = (nm ?? "").split(" ");
    contact = await prisma.contact.create({
      data: {
        locationId: location.id,
        email: from,
        firstName: parts[0] || null,
        lastName: parts.slice(1).join(" ") || null,
        source: "Email",
      },
    });
  }

  // Reuse the latest email thread for this contact, else open one.
  let convo = await prisma.conversation.findFirst({
    where: { locationId: location.id, contactId: contact.id, channel: "EMAIL" },
    orderBy: { lastMessageAt: "desc" },
  });
  if (!convo) {
    convo = await prisma.conversation.create({
      data: { locationId: location.id, contactId: contact.id, channel: "EMAIL", subject: subject || null },
    });
  }

  await prisma.message.create({
    data: {
      conversationId: convo.id,
      direction: "INBOUND",
      channel: "EMAIL",
      body: subject ? `Subject: ${subject}\n\n${text}` : text,
    },
  });
  await prisma.conversation.update({
    where: { id: convo.id },
    data: { lastMessageAt: new Date(), unread: true },
  });

  return NextResponse.json({ ok: true, locationId: location.id, contactId: contact.id });
}

// Lets you sanity-check the endpoint is deployed.
export async function GET() {
  return NextResponse.json({ ok: true, inboundDomain: INBOUND_DOMAIN });
}
