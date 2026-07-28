"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireLocationAccess } from "@/lib/auth";

type ChannelValue = "SMS" | "EMAIL" | "WHATSAPP" | "WEBCHAT" | "NOTE";

export async function startConversationAction(formData: FormData) {
  const locationId = String(formData.get("locationId") ?? "");
  const contactId = String(formData.get("contactId") ?? "");
  const channel = (String(formData.get("channel") ?? "SMS") as ChannelValue) || "SMS";
  const body = String(formData.get("body") ?? "").trim();
  await requireLocationAccess(locationId);
  if (!contactId) return;

  const conversation = await prisma.conversation.create({
    data: {
      locationId,
      contactId,
      channel,
      lastMessageAt: new Date(),
      messages: body
        ? { create: { direction: "OUTBOUND", channel, body } }
        : undefined,
    },
  });
  revalidatePath(`/dashboard/l/${locationId}/conversations`);
  redirect(`/dashboard/l/${locationId}/conversations?c=${conversation.id}`);
}

export async function sendMessageAction(formData: FormData) {
  const locationId = String(formData.get("locationId") ?? "");
  const conversationId = String(formData.get("conversationId") ?? "");
  const direction = (String(formData.get("direction") ?? "OUTBOUND") as "INBOUND" | "OUTBOUND");
  const body = String(formData.get("body") ?? "").trim();
  await requireLocationAccess(locationId);
  if (!body) return;

  const convo = await prisma.conversation.findFirst({ where: { id: conversationId, locationId } });
  if (!convo) return;

  await prisma.message.create({
    data: { conversationId, direction, channel: convo.channel, body },
  });
  await prisma.conversation.update({
    where: { id: conversationId },
    data: { lastMessageAt: new Date(), unread: direction === "INBOUND" },
  });
  revalidatePath(`/dashboard/l/${locationId}/conversations`);
  redirect(`/dashboard/l/${locationId}/conversations?c=${conversationId}`);
}
