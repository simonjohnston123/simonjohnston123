"use server";

import { revalidatePath } from "next/cache";
import { requireLocationAccess } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { syncEbayMessages, draftEbayAnswer, sendEbayReply, listProductForBuyer, type StockHit } from "@/lib/ebay-messages";

export type EbayActionResult = { ok: boolean; message: string; draft?: string; toList?: StockHit[] };

/** "Pull eBay questions" — import buyer messages into the inbox. */
export async function syncEbayMessagesAction(locationId: string, days = 30): Promise<EbayActionResult> {
  await requireLocationAccess(locationId);
  const r = await syncEbayMessages(locationId, days);
  revalidatePath(`/dashboard/l/${locationId}/conversations`);

  if (!r.ok) return { ok: false, message: r.error ?? "eBay sync failed." };
  if (!r.imported && !r.skipped) return { ok: true, message: "No buyer questions in that period." };
  const bits = [`${r.imported} new`];
  if (r.skipped) bits.push(`${r.skipped} already in inbox`);
  return { ok: true, message: `eBay synced — ${bits.join(", ")}.` };
}

/** Ask the AI for a reply. Saved as a draft; nothing is sent to the buyer. */
export async function draftEbayReplyAction(locationId: string, conversationId: string): Promise<EbayActionResult> {
  await requireLocationAccess(locationId);
  const convo = await prisma.conversation.findFirst({ where: { id: conversationId, locationId }, select: { id: true } });
  if (!convo) return { ok: false, message: "Conversation not found." };

  const r = await draftEbayAnswer(conversationId);
  revalidatePath(`/dashboard/l/${locationId}/conversations`);
  return r.ok
    ? { ok: true, message: "Draft ready — read it before sending.", draft: r.draft, toList: r.toList }
    : { ok: false, message: r.error ?? "Couldn't draft a reply." };
}

/**
 * List a product on eBay so the buyer can be given an item number. Buyers can't
 * be sent anywhere off eBay, so this is the only way to sell them something
 * that wasn't already listed.
 */
export async function listAndOfferAction(
  locationId: string,
  conversationId: string,
  productId: string,
): Promise<EbayActionResult & { itemId?: string; sentence?: string }> {
  await requireLocationAccess(locationId);
  const r = await listProductForBuyer(locationId, productId);
  if (!r.ok) return { ok: false, message: r.error ?? "Couldn't list it on eBay." };

  const sentence = `I've just listed it on eBay — item number ${r.itemId}. Search that number and it'll come straight up.`;
  revalidatePath(`/dashboard/l/${locationId}/conversations`);
  return { ok: true, message: `Listed — item ${r.itemId}.`, itemId: r.itemId, sentence };
}

/** Send the (possibly edited) reply to the buyer on eBay. */
export async function sendEbayReplyAction(locationId: string, conversationId: string, body: string): Promise<EbayActionResult> {
  await requireLocationAccess(locationId);
  const text = body.trim();
  if (!text) return { ok: false, message: "Write a reply first." };

  const convo = await prisma.conversation.findFirst({ where: { id: conversationId, locationId }, select: { id: true } });
  if (!convo) return { ok: false, message: "Conversation not found." };

  const r = await sendEbayReply(conversationId, text);
  revalidatePath(`/dashboard/l/${locationId}/conversations`);
  return r.ok ? { ok: true, message: "Sent to the buyer on eBay." } : { ok: false, message: r.error ?? "eBay rejected the reply." };
}

/** Draft answers for every unanswered eBay question in one go. */
export async function draftAllEbayRepliesAction(locationId: string): Promise<EbayActionResult> {
  await requireLocationAccess(locationId);
  const open = await prisma.conversation.findMany({
    where: { locationId, channel: "EBAY", unread: true, draftReply: null },
    orderBy: { lastMessageAt: "desc" },
    take: 25, // keep one click well inside the request budget
    select: { id: true },
  });
  if (!open.length) return { ok: true, message: "Nothing waiting on a draft." };

  let done = 0;
  let failed = 0;
  for (const c of open) {
    const r = await draftEbayAnswer(c.id);
    if (r.ok) done++;
    else failed++;
  }
  revalidatePath(`/dashboard/l/${locationId}/conversations`);
  return {
    ok: done > 0,
    message: failed
      ? `Drafted ${done}; ${failed} failed. Read each before sending.`
      : `Drafted ${done} ${done === 1 ? "reply" : "replies"} — read each before sending.`,
  };
}
