import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

// ---------------------------------------------------------------------------
// Inbound email webhook. Incoming mail is dropped into the right sub-account's
// Conversations as an INBOUND message — the CRM's shared inbox.
//
// Three delivery shapes are accepted, so any mail stack can feed it:
//   • Mailcow / Postfix / Dovecot — pipe the RAW rfc822 message, or run a small
//     bridge that POSTs JSON. Auth with ?token=INBOUND_TOKEN.
//   • SendGrid Inbound Parse — multipart form post (?token=INBOUND_TOKEN).
//   • Resend — Svix-signed JSON (RESEND_WEBHOOK_SECRET).
//
// Routing: the recipient local-part is matched to a Location slug
// (support@… or safety-cert-seq@…). With a single business, everything lands
// there. Until mail is pointed here the endpoint is live but receives nothing.
//
// Mailcow bridge (simplest — a Sieve/procmail pipe of the raw message):
//   curl -s -X POST -H "Content-Type: message/rfc822" --data-binary @- \
//     "https://placidcrm.com/api/inbound/email?token=$INBOUND_TOKEN"
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

type Parsed = { from: string; fromRaw: unknown; to: string; subject: string; text: string };

// --- Raw RFC822 parsing (for a Mailcow/Postfix pipe of the raw message) -------

function decodeBody(s: string, enc?: string): string {
  const e = (enc || "").toLowerCase();
  if (e === "base64") {
    try {
      return Buffer.from(s.replace(/\s+/g, ""), "base64").toString("utf8");
    } catch {
      return s;
    }
  }
  if (e === "quoted-printable") {
    // Collect raw bytes then decode as UTF-8 so multi-byte chars (–, £, é…) survive.
    const src = s.replace(/=\r?\n/g, "");
    const bytes: number[] = [];
    for (let i = 0; i < src.length; i++) {
      const ch = src[i];
      if (ch === "=" && /^[0-9A-Fa-f]{2}$/.test(src.substr(i + 1, 2))) {
        bytes.push(parseInt(src.substr(i + 1, 2), 16));
        i += 2;
      } else {
        for (const b of Buffer.from(ch, "utf8")) bytes.push(b);
      }
    }
    return Buffer.from(bytes).toString("utf8");
  }
  return s;
}

// Decode MIME "encoded-words" in a header (=?utf-8?B?…?= / =?utf-8?Q?…?=).
function decodeMimeWords(s: string): string {
  return s.replace(/=\?[^?]+\?([bBqQ])\?([^?]*)\?=/g, (_, enc, data) => {
    try {
      if (enc.toLowerCase() === "b") return Buffer.from(data, "base64").toString("utf8");
      return decodeBody(data.replace(/_/g, " "), "quoted-printable");
    } catch {
      return data;
    }
  });
}

function parseRfc822(raw: string): Parsed {
  const sepIdx = raw.search(/\r?\n\r?\n/);
  const headerBlock = sepIdx >= 0 ? raw.slice(0, sepIdx) : raw;
  let body = sepIdx >= 0 ? raw.slice(sepIdx).replace(/^\r?\n\r?\n/, "") : "";

  // Unfold folded header lines, then index the first occurrence of each header.
  const unfolded = headerBlock.replace(/\r?\n[ \t]+/g, " ");
  const headers: Record<string, string> = {};
  for (const line of unfolded.split(/\r?\n/)) {
    const i = line.indexOf(":");
    if (i > 0) {
      const k = line.slice(0, i).trim().toLowerCase();
      if (!(k in headers)) headers[k] = line.slice(i + 1).trim();
    }
  }

  const ctype = headers["content-type"] || "";
  const boundary = ctype.match(/boundary="?([^";]+)"?/i)?.[1];
  if (/multipart\//i.test(ctype) && boundary) {
    const marker = `--${boundary.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`;
    let plain = "";
    let html = "";
    for (const part of body.split(new RegExp(marker))) {
      const ps = part.search(/\r?\n\r?\n/);
      if (ps < 0) continue;
      const ph = part.slice(0, ps).toLowerCase();
      const pb = part.slice(ps).replace(/^\r?\n\r?\n/, "");
      const penc = ph.match(/content-transfer-encoding:\s*([^\r\n;]+)/)?.[1]?.trim();
      if (ph.includes("text/plain") && !plain) plain = decodeBody(pb, penc);
      else if (ph.includes("text/html") && !html) html = stripHtml(decodeBody(pb, penc));
    }
    body = plain || html || "";
  } else {
    body = decodeBody(body, headers["content-transfer-encoding"]);
    if (/text\/html/i.test(ctype)) body = stripHtml(body);
  }

  return {
    from: addressOf(headers["from"]),
    fromRaw: decodeMimeWords(headers["from"] || ""),
    to: addressOf((headers["to"] || "").split(",")[0]),
    subject: decodeMimeWords(headers["subject"] || "").trim(),
    text: body.trim().slice(0, 20000),
  };
}

export async function POST(req: NextRequest) {
  const ct = (req.headers.get("content-type") || "").toLowerCase();
  const token = process.env.INBOUND_TOKEN;
  const tokenOk = Boolean(token) && req.nextUrl.searchParams.get("token") === token;
  let parsed: Parsed;

  if (ct.includes("message/rfc822") || ct.includes("text/plain")) {
    // Raw email piped from a mail server (Mailcow/Postfix/Dovecot/procmail).
    if (token && !tokenOk) {
      return NextResponse.json({ error: "invalid token" }, { status: 401 });
    }
    parsed = parseRfc822(await req.text());
  } else if (ct.includes("multipart/form-data") || ct.includes("application/x-www-form-urlencoded")) {
    // SendGrid Inbound Parse (or any form-post provider). Secure with a shared
    // token in the webhook URL: /api/inbound/email?token=INBOUND_TOKEN
    if (token && !tokenOk) {
      return NextResponse.json({ error: "invalid token" }, { status: 401 });
    }
    const form = await req.formData();
    const toRaw = String(form.get("to") ?? "").split(",")[0];
    parsed = {
      from: addressOf(form.get("from")),
      fromRaw: form.get("from"),
      to: addressOf(toRaw),
      subject: String(form.get("subject") ?? "").trim(),
      text: (String(form.get("text") ?? "").trim() || stripHtml(form.get("html"))).slice(0, 20000),
    };
  } else {
    // JSON: a token-authenticated bridge ({from,to,subject,text}) or Resend
    // (Svix-signed). Accept if the token matches, else require a valid signature.
    const raw = await req.text();
    const secret = process.env.RESEND_WEBHOOK_SECRET;
    if (!tokenOk) {
      if (secret) {
        if (!verifySignature(secret, req, raw)) {
          return NextResponse.json({ error: "invalid signature" }, { status: 401 });
        }
      } else if (token) {
        return NextResponse.json({ error: "invalid token" }, { status: 401 });
      }
    }
    let evt: Record<string, unknown>;
    try {
      evt = JSON.parse(raw);
    } catch {
      return NextResponse.json({ error: "invalid json" }, { status: 400 });
    }
    const data = (evt.data ?? evt) as Record<string, unknown>;
    const toRaw = Array.isArray(data.to) ? data.to[0] : data.to;
    parsed = {
      from: addressOf(data.from),
      fromRaw: data.from,
      to: addressOf(toRaw),
      subject: String(data.subject ?? "").trim(),
      text: (String(data.text ?? "").trim() || stripHtml(data.html)).slice(0, 20000),
    };
  }

  const { from, to, subject, text, fromRaw } = parsed;
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
    const nm = nameOf(fromRaw);
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
