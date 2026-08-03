import "server-only";
import { prisma } from "@/lib/db";
import { gapi, googleStatus } from "@/lib/google";

// Google Business Profile: pull reviews into the CRM inbox (so they're answered
// like any other message) and publish posts to the business listing.
//
// The Business Profile APIs are split across hosts: account/location listing
// lives on mybusinessaccountmanagement + mybusinessbusinessinformation, while
// reviews/posts still sit on the legacy mybusiness v4 host.
const ACCOUNTS = "https://mybusinessaccountmanagement.googleapis.com/v1";
const INFO = "https://mybusinessbusinessinformation.googleapis.com/v1";
const V4 = "https://mybusiness.googleapis.com/v4";

type GbAccount = { name: string; accountName?: string };
type GbLocation = { name: string; title?: string };
type GbReview = {
  reviewId: string; comment?: string; starRating?: string; createTime?: string;
  reviewer?: { displayName?: string };
  reviewReply?: { comment?: string };
};

const STARS: Record<string, number> = { ONE: 1, TWO: 2, THREE: 3, FOUR: 4, FIVE: 5 };

/** First Business Profile account + location this Google login can manage. */
export async function findBusinessLocation(locationId: string): Promise<{ account: string; location: string; title?: string } | null> {
  const accRes = await gapi(locationId, `${ACCOUNTS}/accounts`);
  if (!accRes?.ok) return null;
  const accounts = ((await accRes.json()) as { accounts?: GbAccount[] }).accounts ?? [];
  for (const acc of accounts) {
    const locRes = await gapi(locationId, `${INFO}/${acc.name}/locations?readMask=name,title&pageSize=10`);
    if (!locRes?.ok) continue;
    const locs = ((await locRes.json()) as { locations?: GbLocation[] }).locations ?? [];
    if (locs[0]?.name) return { account: acc.name, location: locs[0].name, title: locs[0].title };
  }
  return null;
}

/** Pull reviews into Conversations so the team can reply from the inbox. */
export async function syncReviews(locationId: string): Promise<{ imported: number; error?: string }> {
  const status = await googleStatus(locationId);
  if (!status.connected || !status.services.includes("business")) return { imported: 0, error: "Business Profile not connected." };

  const target = await findBusinessLocation(locationId);
  if (!target) return { imported: 0, error: "No Business Profile listing found on this Google account." };

  // v4 shape: accounts/{id}/locations/{id}/reviews
  const res = await gapi(locationId, `${V4}/${target.account}/${target.location}/reviews`);
  if (!res) return { imported: 0, error: "Google session expired — reconnect." };
  if (!res.ok) return { imported: 0, error: `Business Profile error ${res.status}` };

  const reviews = ((await res.json()) as { reviews?: GbReview[] }).reviews ?? [];
  let imported = 0;

  for (const r of reviews) {
    if (!r.reviewId) continue;
    const messageId = `gbp-review:${r.reviewId}`;
    const seen = await prisma.message.findFirst({ where: { messageId }, select: { id: true } });
    if (seen) continue;

    const stars = STARS[r.starRating ?? ""] ?? 0;
    const who = r.reviewer?.displayName?.trim() || "Google reviewer";
    const when = r.createTime ? new Date(r.createTime) : new Date();
    const body = `${"⭐".repeat(stars) || "(no rating)"}\n\n${r.comment?.trim() || "(no comment left)"}`;

    const [first, ...rest] = who.split(/\s+/);
    let contact = await prisma.contact.findFirst({ where: { locationId, firstName: first, lastName: rest.join(" ") || null }, select: { id: true } });
    if (!contact) {
      contact = await prisma.contact.create({
        data: { locationId, firstName: first || "Google", lastName: rest.join(" ") || null, source: "Google review" },
        select: { id: true },
      });
    }

    const convo = await prisma.conversation.create({
      data: {
        locationId, contactId: contact.id, channel: "WEBCHAT",
        subject: `${stars}★ Google review from ${who}`,
        sourceLabel: "Google reviews", unread: !r.reviewReply, lastMessageAt: when,
        messages: { create: { direction: "INBOUND", channel: "WEBCHAT", body, messageId, receivedAt: when } },
      },
      select: { id: true },
    });

    // A reply already left on Google shows in the thread as our outbound message.
    if (r.reviewReply?.comment) {
      await prisma.message.create({
        data: { conversationId: convo.id, direction: "OUTBOUND", channel: "WEBCHAT", body: r.reviewReply.comment, messageId: `${messageId}:reply` },
      }).catch(() => {});
    }

    // Low ratings deserve a human — raise a task.
    if (stars > 0 && stars <= 3) {
      await prisma.task.create({
        data: { locationId, contactId: contact.id, title: `⭐ Reply to ${stars}-star Google review from ${who}`, dueAt: new Date(Date.now() + 24 * 3600_000) },
      }).catch(() => {});
    }
    imported++;
  }

  return { imported };
}

/** Publish a post ("What's new") to the Business Profile listing. */
export async function postToBusinessProfile(locationId: string, summary: string, imageUrl?: string, ctaUrl?: string): Promise<{ ok: boolean; error?: string }> {
  const target = await findBusinessLocation(locationId);
  if (!target) return { ok: false, error: "No Business Profile listing found." };

  const body: Record<string, unknown> = {
    languageCode: "en-AU",
    summary: summary.slice(0, 1500),
    topicType: "STANDARD",
  };
  if (imageUrl) body.media = [{ mediaFormat: "PHOTO", sourceUrl: imageUrl }];
  if (ctaUrl) body.callToAction = { actionType: "LEARN_MORE", url: ctaUrl };

  const res = await gapi(locationId, `${V4}/${target.account}/${target.location}/localPosts`, {
    method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body),
  });
  if (!res) return { ok: false, error: "Google session expired — reconnect." };
  if (!res.ok) return { ok: false, error: `Business Profile error ${res.status}: ${(await res.text()).slice(0, 140)}` };
  return { ok: true };
}
