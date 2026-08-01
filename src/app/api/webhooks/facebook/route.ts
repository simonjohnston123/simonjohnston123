import { NextRequest, NextResponse } from "next/server";
import { verifyFbSignature, connectionForPage, fbSenderName, ingestFacebook, fbVerifyToken, getFbAppSecret } from "@/lib/facebook";

export const dynamic = "force-dynamic";

// Meta webhook verification handshake.
export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  if (sp.get("hub.mode") === "subscribe" && sp.get("hub.verify_token") === fbVerifyToken()) {
    return new NextResponse(sp.get("hub.challenge") ?? "", { status: 200 });
  }
  return new NextResponse("forbidden", { status: 403 });
}

// Incoming Page events → CRM inbox.
export async function POST(req: NextRequest) {
  const raw = await req.text();
  const secret = await getFbAppSecret();
  if (!verifyFbSignature(raw, req.headers.get("x-hub-signature-256"), secret)) {
    return new NextResponse("bad signature", { status: 401 });
  }

  let body: { object?: string; entry?: Array<{ id?: string; messaging?: unknown[]; changes?: unknown[] }> };
  try {
    body = JSON.parse(raw);
  } catch {
    return NextResponse.json({ ok: true });
  }
  if (body.object !== "page") return NextResponse.json({ ok: true });

  for (const entry of body.entry ?? []) {
    const pageId = String(entry.id ?? "");
    if (!pageId) continue;
    const conn = await connectionForPage(pageId);
    if (!conn) continue;

    // Direct messages (Messenger)
    for (const raw of entry.messaging ?? []) {
      const m = raw as { sender?: { id?: string }; message?: { text?: string; is_echo?: boolean; attachments?: unknown[] }; postback?: { title?: string } };
      if (m.message?.is_echo) continue; // our own outgoing message echoed back
      const psid = m.sender?.id;
      if (!psid || psid === pageId) continue;
      const text = m.message?.text ?? (m.postback?.title ? `[button] ${m.postback.title}` : m.message?.attachments?.length ? "[attachment]" : "");
      if (!text) continue;
      const name = await fbSenderName(conn.pageToken, psid);
      await ingestFacebook(conn.locationId, { externalId: psid, name, body: text });
    }

    // Page post comments (feed)
    for (const raw of entry.changes ?? []) {
      const ch = raw as { field?: string; value?: { item?: string; verb?: string; message?: string; from?: { id?: string; name?: string } } };
      if (ch.field !== "feed") continue;
      const v = ch.value ?? {};
      if (v.item !== "comment" || v.verb !== "add") continue;
      const fromId = v.from?.id;
      if (!fromId || fromId === pageId) continue; // skip the Page's own comments
      if (!v.message) continue;
      await ingestFacebook(conn.locationId, { externalId: fromId, name: v.from?.name ?? null, body: `💬 Comment: ${v.message}` });
    }
  }

  return NextResponse.json({ ok: true });
}
