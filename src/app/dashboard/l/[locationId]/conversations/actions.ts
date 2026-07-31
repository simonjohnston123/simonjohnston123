"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireLocationAccess } from "@/lib/auth";
import { deliverForLocation } from "@/lib/comms-location";

type ChannelValue = "SMS" | "EMAIL" | "WHATSAPP" | "WEBCHAT" | "NOTE";

/** Append a delivery-failure notice to the thread URL so the UI can show it. */
function threadUrl(locationId: string, conversationId: string, failDetail?: string): string {
  const base = `/dashboard/l/${locationId}/conversations?c=${conversationId}`;
  return failDetail ? `${base}&sendfail=${encodeURIComponent(failDetail)}` : base;
}

export async function startConversationAction(formData: FormData) {
  const locationId = String(formData.get("locationId") ?? "");
  const contactId = String(formData.get("contactId") ?? "");
  const channel = (String(formData.get("channel") ?? "SMS") as ChannelValue) || "SMS";
  const subject = String(formData.get("subject") ?? "").trim();
  const body = String(formData.get("body") ?? "").trim();
  await requireLocationAccess(locationId);
  if (!contactId) return;

  const [contact, location] = await Promise.all([
    prisma.contact.findFirst({ where: { id: contactId, locationId } }),
    prisma.location.findUnique({ where: { id: locationId }, select: { name: true, email: true } }),
  ]);

  const conversation = await prisma.conversation.create({
    data: {
      locationId,
      contactId,
      channel,
      subject: subject || null,
      lastMessageAt: new Date(),
      messages: body ? { create: { direction: "OUTBOUND", channel, body } } : undefined,
    },
  });

  let sendResult = { sent: true, detail: "" };
  if (body) {
    sendResult = await deliverForLocation(locationId, {
      channel,
      body,
      subject,
      contact: contact ? { email: contact.email, phone: contact.phone } : null,
      fromName: location?.name,
      replyTo: location?.email,
    });
  }

  revalidatePath(`/dashboard/l/${locationId}/conversations`);
  redirect(threadUrl(locationId, conversation.id, sendResult.sent ? undefined : sendResult.detail));
}

export async function sendMessageAction(formData: FormData) {
  const locationId = String(formData.get("locationId") ?? "");
  const conversationId = String(formData.get("conversationId") ?? "");
  const direction = String(formData.get("direction") ?? "OUTBOUND") as "INBOUND" | "OUTBOUND";
  const body = String(formData.get("body") ?? "").trim();
  await requireLocationAccess(locationId);
  if (!body) return;

  const convo = await prisma.conversation.findFirst({
    where: { id: conversationId, locationId },
    include: { contact: true, location: { select: { name: true, email: true } } },
  });
  if (!convo) return;

  await prisma.message.create({
    data: { conversationId, direction, channel: convo.channel, body },
  });
  await prisma.conversation.update({
    where: { id: conversationId },
    data: { lastMessageAt: new Date(), unread: direction === "INBOUND" },
  });

  let sendResult = { sent: true, detail: "" };
  if (direction === "OUTBOUND") {
    sendResult = await deliverForLocation(locationId, {
      channel: convo.channel as ChannelValue,
      body,
      subject: convo.subject,
      contact: convo.contact ? { email: convo.contact.email, phone: convo.contact.phone } : null,
      fromName: convo.location?.name,
      replyTo: convo.location?.email,
    });
  }

  revalidatePath(`/dashboard/l/${locationId}/conversations`);
  redirect(threadUrl(locationId, conversationId, sendResult.sent ? undefined : sendResult.detail));
}

/** Turn a conversation into a deal on a Success Track (first stage). */
export async function sendToTrackAction(formData: FormData) {
  const locationId = String(formData.get("locationId") ?? "");
  const conversationId = String(formData.get("conversationId") ?? "");
  const pipelineId = String(formData.get("pipelineId") ?? "");
  await requireLocationAccess(locationId);

  const [convo, pipeline] = await Promise.all([
    prisma.conversation.findFirst({ where: { id: conversationId, locationId }, include: { contact: true } }),
    prisma.pipeline.findFirst({ where: { id: pipelineId, locationId }, include: { stages: { orderBy: { position: "asc" }, take: 1 } } }),
  ]);
  if (!convo || !pipeline || pipeline.stages.length === 0) {
    redirect(`/dashboard/l/${locationId}/conversations?c=${conversationId}`);
  }

  const name = convo!.contact
    ? [convo!.contact.firstName, convo!.contact.lastName].filter(Boolean).join(" ") || convo!.contact.email || "New deal"
    : "New deal";
  await prisma.opportunity.create({
    data: {
      locationId,
      pipelineId: pipeline!.id,
      stageId: pipeline!.stages[0].id,
      contactId: convo!.contactId,
      title: convo!.subject?.replace(/^Subject:\s*/i, "").trim() || name,
      value: 0,
    },
  });

  revalidatePath(`/dashboard/l/${locationId}/pipelines`);
  redirect(`/dashboard/l/${locationId}/pipelines?pipeline=${pipeline!.id}`);
}

/** Toggle the star flag on a conversation. */
export async function toggleStarAction(formData: FormData) {
  const locationId = String(formData.get("locationId") ?? "");
  const conversationId = String(formData.get("conversationId") ?? "");
  const starred = String(formData.get("starred") ?? "") === "true";
  await requireLocationAccess(locationId);
  await prisma.conversation.updateMany({ where: { id: conversationId, locationId }, data: { starred: !starred } });
  revalidatePath(`/dashboard/l/${locationId}/conversations`);
}

/** Mark a conversation read/unread. */
export async function setUnreadAction(formData: FormData) {
  const locationId = String(formData.get("locationId") ?? "");
  const conversationId = String(formData.get("conversationId") ?? "");
  const unread = String(formData.get("unread") ?? "") === "true";
  await requireLocationAccess(locationId);
  await prisma.conversation.updateMany({ where: { id: conversationId, locationId }, data: { unread } });
  revalidatePath(`/dashboard/l/${locationId}/conversations`);
}

/** Delete a whole conversation (and its messages) from the Inbox. */
export async function deleteConversationAction(formData: FormData) {
  const locationId = String(formData.get("locationId") ?? "");
  const conversationId = String(formData.get("conversationId") ?? "");
  await requireLocationAccess(locationId);

  // Scope the delete to this location so one tenant can't touch another's inbox.
  await prisma.conversation.deleteMany({ where: { id: conversationId, locationId } });

  revalidatePath(`/dashboard/l/${locationId}/conversations`);
  redirect(`/dashboard/l/${locationId}/conversations`);
}
