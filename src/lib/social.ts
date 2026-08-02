import "server-only";
import { readFile } from "fs/promises";
import { prisma } from "@/lib/db";
import { decryptJson } from "@/lib/crypto";

// ---------------------------------------------------------------------------
// Social poster engine. One composed post fans out to the selected networks —
// immediately ("Post now") or via the minute cron (/api/cron/social-publish).
//
// Live today:   facebook (Pages), instagram (IG Business via the Page token),
//               youtube (once a channel is connected via Google OAuth).
// Honest stubs: tiktok / snapchat / google_business — each needs its own
//               platform app approval before the API will accept posts.
// ---------------------------------------------------------------------------

const GRAPH = "https://graph.facebook.com/v21.0";

export type SocialNetworkKey = "facebook" | "instagram" | "youtube" | "tiktok" | "snapchat" | "google_business";
export type NetResult = { ok: boolean; id?: string; error?: string; at: string };

type FbSecret = { accessToken: string; pageTokens: Record<string, string> };
type FbMeta = { pageIds?: string[]; pages?: { id: string; name: string }[] };

/* ------------------------------ helpers ------------------------------ */

function firstLine(text: string, max = 95): string {
  const l = text.split(/\r?\n/).find((x) => x.trim()) ?? "";
  return (l.trim() || "New post").slice(0, max);
}

async function graph(method: "GET" | "POST", path: string, params: Record<string, string>): Promise<Record<string, unknown>> {
  const qs = new URLSearchParams(params);
  const url = method === "GET" ? `${GRAPH}/${path}?${qs}` : `${GRAPH}/${path}`;
  const res = await fetch(url, method === "GET" ? {} : { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body: qs });
  const j = (await res.json().catch(() => ({}))) as Record<string, unknown> & { error?: { message?: string } };
  if (!res.ok || j.error) throw new Error(j.error?.message || `Graph ${path} → ${res.status}`);
  return j;
}

/** Connected Facebook Pages (id, name, page token) for a location. */
export async function facebookPages(locationId: string): Promise<{ id: string; name: string; token: string }[]> {
  const conn = await prisma.connection.findUnique({ where: { locationId_provider: { locationId, provider: "FACEBOOK" } } });
  if (!conn?.secretCipher || conn.status !== "CONNECTED") return [];
  try {
    const secret = decryptJson<FbSecret>(conn.secretCipher);
    const meta = (conn.meta ?? {}) as FbMeta;
    const names = new Map((meta.pages ?? []).map((p) => [p.id, p.name]));
    return Object.entries(secret.pageTokens ?? {}).map(([id, token]) => ({ id, token, name: names.get(id) ?? id }));
  } catch { return []; }
}

/** IG Business account linked to the first connected Page that has one. */
export async function instagramAccount(locationId: string): Promise<{ igId: string; username: string; pageToken: string } | null> {
  for (const page of await facebookPages(locationId)) {
    try {
      const j = (await graph("GET", page.id, { fields: "instagram_business_account{id,username}", access_token: page.token })) as {
        instagram_business_account?: { id: string; username?: string };
      };
      const ig = j.instagram_business_account;
      if (ig?.id) return { igId: ig.id, username: ig.username ?? "", pageToken: page.token };
    } catch { /* try next page */ }
  }
  return null;
}

/* ------------------------------ adapters ------------------------------ */

async function publishFacebook(locationId: string, body: string, mediaUrls: string[], mediaKind: string | null, pageIds: string[]): Promise<NetResult> {
  let pages = await facebookPages(locationId);
  if (!pages.length) return { ok: false, error: "No Facebook Pages granted on this business's connection — reconnect in Integrations → Facebook, or post from the business that owns the Pages.", at: new Date().toISOString() };
  // Only ever post to the explicitly chosen Pages — never blast every connected
  // brand. With multiple Pages and no choice made, refuse rather than guess.
  if (pageIds.length) pages = pages.filter((p) => pageIds.includes(p.id));
  else if (pages.length > 1) return { ok: false, error: "This connection has multiple Pages — tick which Page(s) to post to.", at: new Date().toISOString() };
  if (!pages.length) return { ok: false, error: "Chosen Page not found on this connection.", at: new Date().toISOString() };

  const ids: string[] = [];
  for (const page of pages) {
    if (mediaKind === "video" && mediaUrls[0]) {
      const j = await graph("POST", `${page.id}/videos`, { file_url: mediaUrls[0], description: body, access_token: page.token });
      ids.push(`${page.name}:${String(j.id ?? "")}`);
    } else if (mediaKind === "image" && mediaUrls.length > 1) {
      const attached: { media_fbid: string }[] = [];
      for (const url of mediaUrls.slice(0, 10)) {
        const p = await graph("POST", `${page.id}/photos`, { url, published: "false", access_token: page.token });
        attached.push({ media_fbid: String(p.id) });
      }
      const j = await graph("POST", `${page.id}/feed`, { message: body, attached_media: JSON.stringify(attached), access_token: page.token });
      ids.push(`${page.name}:${String(j.id ?? "")}`);
    } else if (mediaKind === "image" && mediaUrls[0]) {
      const j = await graph("POST", `${page.id}/photos`, { url: mediaUrls[0], caption: body, access_token: page.token });
      ids.push(`${page.name}:${String(j.post_id ?? j.id ?? "")}`);
    } else {
      if (!body.trim()) throw new Error("Text-only post needs some text.");
      const j = await graph("POST", `${page.id}/feed`, { message: body, access_token: page.token });
      ids.push(`${page.name}:${String(j.id ?? "")}`);
    }
  }
  return { ok: true, id: ids.join(", "), at: new Date().toISOString() };
}

async function publishInstagram(locationId: string, body: string, mediaUrls: string[], mediaKind: string | null): Promise<NetResult> {
  const ig = await instagramAccount(locationId);
  if (!ig) return { ok: false, error: "No Instagram Business account is linked to your connected Facebook Page.", at: new Date().toISOString() };
  if (!mediaUrls[0]) return { ok: false, error: "Instagram needs an image or video.", at: new Date().toISOString() };

  let creationId: string;
  if (mediaKind === "video") {
    const c = await graph("POST", `${ig.igId}/media`, { media_type: "REELS", video_url: mediaUrls[0], caption: body, share_to_feed: "true", access_token: ig.pageToken });
    creationId = String(c.id);
    // Video containers process async — poll until ready (max ~100s).
    for (let i = 0; i < 20; i++) {
      await new Promise((r) => setTimeout(r, 5000));
      const s = (await graph("GET", creationId, { fields: "status_code", access_token: ig.pageToken })) as { status_code?: string };
      if (s.status_code === "FINISHED") break;
      if (s.status_code === "ERROR") throw new Error("Instagram could not process the video (check format/length).");
      if (i === 19) throw new Error("Instagram video is still processing — try Retry in a minute.");
    }
  } else {
    const c = await graph("POST", `${ig.igId}/media`, { image_url: mediaUrls[0], caption: body, access_token: ig.pageToken });
    creationId = String(c.id);
  }
  const pub = await graph("POST", `${ig.igId}/media_publish`, { creation_id: creationId, access_token: ig.pageToken });
  const extra = mediaUrls.length > 1 ? " (first media only — carousels coming)" : "";
  return { ok: true, id: `@${ig.username || "instagram"}:${String(pub.id ?? "")}${extra}`, at: new Date().toISOString() };
}

/** Exchange the stored refresh token for a YouTube access token. */
async function youtubeAccessToken(locationId: string): Promise<{ token: string; label: string } | null> {
  const conn = await prisma.connection.findUnique({ where: { locationId_provider: { locationId, provider: "YOUTUBE" } } });
  if (!conn?.secretCipher || conn.status !== "CONNECTED") return null;
  const { refreshToken } = decryptJson<{ refreshToken: string }>(conn.secretCipher);
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID || "",
      client_secret: process.env.GOOGLE_CLIENT_SECRET || "",
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });
  const j = (await res.json().catch(() => ({}))) as { access_token?: string };
  if (!j.access_token) return null;
  return { token: j.access_token, label: conn.accountLabel ?? "YouTube" };
}

async function publishYouTube(locationId: string, body: string, mediaUrls: string[], mediaKind: string | null): Promise<NetResult> {
  if (mediaKind !== "video" || !mediaUrls[0]) return { ok: false, error: "YouTube needs a video.", at: new Date().toISOString() };
  const auth = await youtubeAccessToken(locationId);
  if (!auth) return { ok: false, error: "YouTube channel not connected (or Google app credentials missing).", at: new Date().toISOString() };

  // Load the bytes: from the uploads volume when it's our media URL, else fetch.
  let bytes: Buffer;
  let mime = "video/mp4";
  const mediaId = mediaUrls[0].match(/\/api\/media\/f\/([a-z0-9]+)/i)?.[1];
  const asset = mediaId ? await prisma.mediaAsset.findUnique({ where: { id: mediaId } }) : null;
  if (asset?.path) { bytes = await readFile(asset.path); mime = asset.mime; }
  else {
    const res = await fetch(mediaUrls[0]);
    if (!res.ok) throw new Error("Could not fetch the video file.");
    bytes = Buffer.from(await res.arrayBuffer());
    mime = res.headers.get("content-type") || mime;
  }

  const init = await fetch("https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status", {
    method: "POST",
    headers: {
      authorization: `Bearer ${auth.token}`,
      "content-type": "application/json",
      "x-upload-content-type": mime,
      "x-upload-content-length": String(bytes.length),
    },
    body: JSON.stringify({
      snippet: { title: firstLine(body), description: body },
      status: { privacyStatus: "public", selfDeclaredMadeForKids: false },
    }),
  });
  if (!init.ok) throw new Error(`YouTube rejected the upload (${init.status}): ${(await init.text()).slice(0, 160)}`);
  const uploadUrl = init.headers.get("location");
  if (!uploadUrl) throw new Error("YouTube did not return an upload session.");

  const up = await fetch(uploadUrl, { method: "PUT", headers: { "content-type": mime, "content-length": String(bytes.length) }, body: new Uint8Array(bytes) });
  const j = (await up.json().catch(() => ({}))) as { id?: string };
  if (!up.ok || !j.id) throw new Error(`YouTube upload failed (${up.status}).`);
  return { ok: true, id: `youtu.be/${j.id}`, at: new Date().toISOString() };
}

function stub(reason: string): NetResult {
  return { ok: false, error: reason, at: new Date().toISOString() };
}

/* ------------------------------ engine ------------------------------ */

export async function publishPost(postId: string): Promise<void> {
  const post = await prisma.socialPost.findUnique({ where: { id: postId } });
  if (!post || post.status === "PUBLISHING") return;
  await prisma.socialPost.update({ where: { id: postId }, data: { status: "PUBLISHING" } });

  const networks = (Array.isArray(post.networks) ? post.networks : []) as SocialNetworkKey[];
  const mediaUrls = (Array.isArray(post.mediaUrls) ? post.mediaUrls : []) as string[];
  const options = (post.options ?? {}) as { facebookPageIds?: string[] };
  const prev = (post.results ?? {}) as Record<string, NetResult>;
  const results: Record<string, NetResult> = { ...prev };

  for (const net of networks) {
    if (results[net]?.ok) continue; // retry only what failed
    try {
      if (net === "facebook") results[net] = await publishFacebook(post.locationId, post.body, mediaUrls, post.mediaKind, options.facebookPageIds ?? []);
      else if (net === "instagram") results[net] = await publishInstagram(post.locationId, post.body, mediaUrls, post.mediaKind);
      else if (net === "youtube") results[net] = await publishYouTube(post.locationId, post.body, mediaUrls, post.mediaKind);
      else if (net === "tiktok") results[net] = stub("TikTok posting needs our TikTok developer app approved first.");
      else if (net === "snapchat") results[net] = stub("Snapchat has no organic posting API — ads only, coming with the ads phase.");
      else if (net === "google_business") results[net] = stub("Google Business Profile posting needs the Google OAuth app verified first.");
      else results[net] = stub("Unknown network.");
    } catch (e) {
      results[net] = { ok: false, error: String(e instanceof Error ? e.message : e).slice(0, 300), at: new Date().toISOString() };
    }
  }

  const oks = networks.filter((n) => results[n]?.ok).length;
  const status = oks === networks.length && networks.length > 0 ? "PUBLISHED" : oks > 0 ? "PARTIAL" : "FAILED";
  await prisma.socialPost.update({ where: { id: postId }, data: { results, status } });
}

/** Cron tick: publish everything due. Returns a small summary for the log. */
export async function runDueSocialPosts(): Promise<{ published: number }> {
  const due = await prisma.socialPost.findMany({
    where: { status: "SCHEDULED", scheduledAt: { lte: new Date() } },
    orderBy: { scheduledAt: "asc" },
    take: 5, // keep each tick fast; the next minute picks up the rest
    select: { id: true },
  });
  for (const p of due) await publishPost(p.id);
  return { published: due.length };
}
