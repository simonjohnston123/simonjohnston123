import "server-only";
import crypto from "crypto";
import { prisma } from "@/lib/db";
import { encryptJson, decryptJson } from "@/lib/crypto";
import { getSetting, SETTING_KEYS } from "@/lib/platform-settings";

// Facebook Pages integration: connect a business's chosen Pages, subscribe them
// to webhooks, and drop their messages + comments into the CRM inbox.

const GRAPH = "https://graph.facebook.com/v21.0";
// App credentials come from the admin-managed settings first, then env.
async function appId(): Promise<string> {
  return (await getSetting(SETTING_KEYS.facebookAppId)) || process.env.FACEBOOK_APP_ID || "";
}
export async function getFbAppSecret(): Promise<string> {
  return (await getSetting(SETTING_KEYS.facebookAppSecret)) || process.env.FACEBOOK_APP_SECRET || "";
}
export const fbVerifyToken = () => process.env.FACEBOOK_VERIFY_TOKEN || "placid-fb-verify";

type FbSecret = { accessToken: string; pageTokens: Record<string, string> };
type FbMeta = { pageIds: string[]; pages: { id: string; name: string }[] };

/**
 * Turn a user OAuth token into connected Pages: exchange for a long-lived token,
 * pull the Pages the user granted, subscribe each to the messages + feed
 * webhooks, and persist page tokens (encrypted) + page ids (for routing).
 */
export async function setupFacebookConnection(
  locationId: string,
  userAccessToken: string,
): Promise<{ pages: { id: string; name: string }[]; label: string } | null> {
  // 1) exchange short-lived → long-lived user token (best-effort)
  let userTok = userAccessToken;
  try {
    const [id, secret] = await Promise.all([appId(), getFbAppSecret()]);
    const ex = await fetch(
      `${GRAPH}/oauth/access_token?grant_type=fb_exchange_token&client_id=${id}&client_secret=${secret}&fb_exchange_token=${encodeURIComponent(userAccessToken)}`,
    );
    if (ex.ok) {
      const j = (await ex.json()) as { access_token?: string };
      if (j.access_token) userTok = j.access_token;
    }
  } catch {
    /* keep short-lived token */
  }

  // 2) the Pages the user chose to grant. New Pages Experience often returns the
  // page id/name here WITHOUT an access_token, so we mint each page token in a
  // follow-up call rather than dropping token-less pages.
  const res = await fetch(`${GRAPH}/me/accounts?fields=id,name,access_token&limit=100&access_token=${encodeURIComponent(userTok)}`);
  const rawBody = await res.text();
  if (!res.ok) {
    console.error("[facebook] /me/accounts failed", res.status, rawBody.slice(0, 500));
    return null;
  }
  let data: { data?: Array<{ id: string; name: string; access_token?: string }> } = {};
  try {
    data = JSON.parse(rawBody);
  } catch {
    console.error("[facebook] /me/accounts unparseable", rawBody.slice(0, 500));
  }
  const listed = (data.data ?? []).filter((p) => p.id);
  console.error(`[facebook] /me/accounts returned ${listed.length} page(s):`, listed.map((p) => `${p.name}(${p.id}) token=${p.access_token ? "yes" : "no"}`).join("; "));

  // Ensure every listed page has a Page access token (fetch it if missing).
  const pages: Array<{ id: string; name: string; access_token: string }> = [];
  for (const p of listed) {
    let token = p.access_token;
    if (!token) {
      try {
        const tr = await fetch(`${GRAPH}/${p.id}?fields=access_token&access_token=${encodeURIComponent(userTok)}`);
        if (tr.ok) token = ((await tr.json()) as { access_token?: string }).access_token;
      } catch {
        /* leave token undefined */
      }
    }
    if (token) pages.push({ id: p.id, name: p.name, access_token: token });
    else console.error(`[facebook] no page token obtainable for ${p.name}(${p.id})`);
  }

  // 3) subscribe each Page to the webhook fields we care about
  for (const pg of pages) {
    try {
      await fetch(`${GRAPH}/${pg.id}/subscribed_apps`, {
        method: "POST",
        body: new URLSearchParams({ subscribed_fields: "messages,messaging_postbacks,feed", access_token: pg.access_token }),
      });
    } catch {
      /* non-fatal — can re-subscribe later */
    }
  }

  // 4) persist (page tokens encrypted; page ids in meta for webhook routing)
  const pageTokens: Record<string, string> = {};
  for (const pg of pages) pageTokens[pg.id] = pg.access_token;
  const secret = encryptJson({ accessToken: userTok, pageTokens } satisfies FbSecret);
  const meta: FbMeta = { pageIds: pages.map((p) => p.id), pages: pages.map((p) => ({ id: p.id, name: p.name })) };
  const names = pages.map((p) => p.name);
  const label = pages.length ? `${pages.length} page${pages.length > 1 ? "s" : ""}: ${names.slice(0, 2).join(", ")}${pages.length > 2 ? "…" : ""}` : "No pages granted";

  await prisma.connection.upsert({
    where: { locationId_provider: { locationId, provider: "FACEBOOK" } },
    create: { locationId, provider: "FACEBOOK", status: "CONNECTED", accountLabel: label, secretCipher: secret, meta: meta as object },
    update: { status: "CONNECTED", accountLabel: label, secretCipher: secret, meta: meta as object },
  });

  return { pages: pages.map((p) => ({ id: p.id, name: p.name })), label };
}

/** Verify Meta's X-Hub-Signature-256 over the raw request body. */
export function verifyFbSignature(rawBody: string, signature: string | null, secret: string): boolean {
  if (!signature || !secret) return false;
  const expected = "sha256=" + crypto.createHmac("sha256", secret).update(rawBody, "utf8").digest("hex");
  try {
    return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
  } catch {
    return false;
  }
}

/** Which location owns a given Page id, plus that Page's token. */
export async function connectionForPage(pageId: string): Promise<{ locationId: string; pageToken: string | null } | null> {
  const conns = await prisma.connection.findMany({ where: { provider: "FACEBOOK", status: "CONNECTED" } });
  for (const c of conns) {
    const meta = (c.meta ?? {}) as Partial<FbMeta>;
    if (Array.isArray(meta.pageIds) && meta.pageIds.includes(pageId)) {
      let pageToken: string | null = null;
      try {
        pageToken = c.secretCipher ? decryptJson<FbSecret>(c.secretCipher).pageTokens?.[pageId] ?? null : null;
      } catch {
        /* keep null */
      }
      return { locationId: c.locationId, pageToken };
    }
  }
  return null;
}

/** Look up a sender's display name via the Graph API (best-effort). */
export async function fbSenderName(pageToken: string | null, psid: string): Promise<string | null> {
  if (!pageToken) return null;
  try {
    const r = await fetch(`${GRAPH}/${psid}?fields=name&access_token=${encodeURIComponent(pageToken)}`);
    if (!r.ok) return null;
    const j = (await r.json()) as { name?: string };
    return j.name ?? null;
  } catch {
    return null;
  }
}

/** Find-or-create the contact + conversation and append an inbound message. */
export async function ingestFacebook(locationId: string, opts: { externalId: string; name: string | null; body: string }): Promise<void> {
  let contact = await prisma.contact.findFirst({ where: { locationId, externalId: opts.externalId } });
  if (!contact) {
    const parts = (opts.name ?? "Facebook User").trim().split(/\s+/);
    contact = await prisma.contact.create({
      data: { locationId, externalId: opts.externalId, firstName: parts[0] || "Facebook", lastName: parts.slice(1).join(" ") || null, source: "facebook" },
    });
  } else if (opts.name && !contact.firstName) {
    const parts = opts.name.trim().split(/\s+/);
    await prisma.contact.update({ where: { id: contact.id }, data: { firstName: parts[0], lastName: parts.slice(1).join(" ") || null } });
  }

  let convo = await prisma.conversation.findFirst({
    where: { locationId, contactId: contact.id, channel: "FACEBOOK" },
    orderBy: { lastMessageAt: "desc" },
  });
  if (!convo) {
    convo = await prisma.conversation.create({
      data: { locationId, contactId: contact.id, channel: "FACEBOOK", lastMessageAt: new Date(), unread: true, sourceLabel: "Facebook" },
    });
  }
  await prisma.message.create({ data: { conversationId: convo.id, direction: "INBOUND", channel: "FACEBOOK", body: opts.body, receivedAt: new Date() } });
  await prisma.conversation.update({ where: { id: convo.id }, data: { lastMessageAt: new Date(), unread: true } });
}
