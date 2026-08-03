import "server-only";
import { prisma } from "@/lib/db";
import { gapi, googleStatus } from "@/lib/google";

// Gmail → CRM inbox. Pulls recent mail for a connected Google account into
// Conversations (channel EMAIL), matching or creating the Contact. Threads are
// deduped on the Gmail message id, so syncing repeatedly is safe.

const API = "https://gmail.googleapis.com/gmail/v1/users/me";

type GmailHeader = { name: string; value: string };
type GmailPayload = { headers?: GmailHeader[]; mimeType?: string; body?: { data?: string }; parts?: GmailPayload[] };
type GmailMessage = { id: string; threadId: string; snippet?: string; internalDate?: string; labelIds?: string[]; payload?: GmailPayload };

const header = (p: GmailPayload | undefined, name: string): string =>
  p?.headers?.find((h) => h.name.toLowerCase() === name.toLowerCase())?.value ?? "";

/** Prefer text/plain; fall back to stripped HTML. */
function extractBody(p: GmailPayload | undefined): string {
  if (!p) return "";
  const decode = (d?: string) => (d ? Buffer.from(d.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8") : "");
  if (p.mimeType === "text/plain" && p.body?.data) return decode(p.body.data);
  if (p.parts?.length) {
    const plain = p.parts.find((x) => x.mimeType === "text/plain");
    if (plain?.body?.data) return decode(plain.body.data);
    const html = p.parts.find((x) => x.mimeType === "text/html");
    if (html?.body?.data) return decode(html.body.data).replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
    for (const part of p.parts) { const nested = extractBody(part); if (nested) return nested; }
  }
  if (p.body?.data) return decode(p.body.data).replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  return "";
}

function parseAddress(raw: string): { email: string; name?: string } {
  const m = raw.match(/^(.*?)<([^>]+)>$/);
  const name = m ? m[1].trim().replace(/^["']|["']$/g, "") : undefined;
  return { email: (m ? m[2] : raw).trim().toLowerCase(), name: name || undefined };
}

/** Sync one business's Gmail into the inbox. Returns how many arrived. */
export async function syncGmailForLocation(locationId: string, max = 25): Promise<{ imported: number; error?: string }> {
  const status = await googleStatus(locationId);
  if (!status.connected) return { imported: 0, error: "Google not connected." };

  const listRes = await gapi(locationId, `${API}/messages?maxResults=${max}&q=${encodeURIComponent("in:inbox newer_than:30d")}`);
  if (!listRes) return { imported: 0, error: "Google session expired — reconnect." };
  if (!listRes.ok) {
    const detail = (await listRes.text()).slice(0, 160);
    return { imported: 0, error: listRes.status === 403 ? "Gmail access not granted — reconnect and tick Gmail." : `Gmail error ${listRes.status}: ${detail}` };
  }
  const list = (await listRes.json()) as { messages?: { id: string }[] };
  const ids = (list.messages ?? []).map((m) => m.id);
  if (!ids.length) return { imported: 0 };

  const myEmail = (status.email ?? "").toLowerCase();
  let imported = 0;

  for (const id of ids) {
    // Skip anything already filed.
    const seen = await prisma.message.findFirst({ where: { messageId: `gmail:${id}` }, select: { id: true } });
    if (seen) continue;

    const msgRes = await gapi(locationId, `${API}/messages/${id}?format=full`);
    if (!msgRes?.ok) continue;
    const msg = (await msgRes.json()) as GmailMessage;

    const from = parseAddress(header(msg.payload, "From"));
    const to = parseAddress(header(msg.payload, "To"));
    const subject = header(msg.payload, "Subject") || "(no subject)";
    const outbound = from.email === myEmail;
    const other = outbound ? to : from;
    if (!other.email || other.email === myEmail) continue;

    const body = (extractBody(msg.payload) || msg.snippet || "").slice(0, 8000);
    const receivedAt = msg.internalDate ? new Date(Number(msg.internalDate)) : new Date();

    // Contact: match on the counterparty's address, else create a lead.
    let contact = await prisma.contact.findFirst({ where: { locationId, email: other.email }, select: { id: true } });
    if (!contact) {
      const [first, ...rest] = (other.name ?? "").split(/\s+/).filter(Boolean);
      contact = await prisma.contact.create({
        data: {
          locationId,
          firstName: first || other.email.split("@")[0],
          lastName: rest.join(" ") || null,
          email: other.email,
          source: "Gmail",
        },
        select: { id: true },
      });
    }

    // One conversation per Gmail thread.
    const existing = await prisma.conversation.findFirst({
      where: { locationId, contactId: contact.id, channel: "EMAIL", subject },
      select: { id: true },
    });
    const conversationId = existing?.id ?? (await prisma.conversation.create({
      data: {
        locationId, contactId: contact.id, channel: "EMAIL", subject,
        sourceLabel: status.email ? `Gmail · ${status.email}` : "Gmail",
        unread: !outbound, lastMessageAt: receivedAt,
      },
      select: { id: true },
    })).id;

    await prisma.message.create({
      data: {
        conversationId,
        direction: outbound ? "OUTBOUND" : "INBOUND",
        channel: "EMAIL",
        body: body || "(empty message)",
        messageId: `gmail:${id}`,
        receivedAt,
      },
    });
    await prisma.conversation.update({
      where: { id: conversationId },
      data: { lastMessageAt: receivedAt, ...(outbound ? {} : { unread: true }) },
    });
    imported++;
  }

  return { imported };
}

/** Send an email as the connected Google account (RFC822 → Gmail send). */
export async function sendGmail(locationId: string, to: string, subject: string, body: string): Promise<{ ok: boolean; error?: string }> {
  const status = await googleStatus(locationId);
  if (!status.connected) return { ok: false, error: "Google not connected." };
  const raw = [
    `To: ${to}`,
    `From: ${status.email ?? ""}`,
    `Subject: ${subject}`,
    "Content-Type: text/plain; charset=UTF-8",
    "",
    body,
  ].join("\r\n");
  const encoded = Buffer.from(raw, "utf8").toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  const res = await gapi(locationId, `${API}/messages/send`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ raw: encoded }),
  });
  if (!res) return { ok: false, error: "Google session expired — reconnect." };
  if (!res.ok) return { ok: false, error: `Gmail send failed (${res.status}).` };
  return { ok: true };
}

/** Cron entry point: sync every business with Google connected. */
export async function syncAllGmail(): Promise<{ locations: number; imported: number }> {
  const conns = await prisma.connection.findMany({
    where: { provider: "GOOGLE", status: "CONNECTED" },
    select: { locationId: true },
  });
  let imported = 0;
  for (const c of conns) {
    const r = await syncGmailForLocation(c.locationId).catch(() => ({ imported: 0 }));
    imported += r.imported;
  }
  return { locations: conns.length, imported };
}
