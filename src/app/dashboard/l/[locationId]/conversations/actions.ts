"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireLocationAccess } from "@/lib/auth";
import { sendEmail, sendSms } from "@/lib/comms";

type ChannelValue = "SMS" | "EMAIL" | "WHATSAPP" | "WEBCHAT" | "NOTE";

/**
 * Actually deliver an outbound message on its channel (email via Resend, SMS via
 * Twilio). Never throws — delivery problems are swallowed so the message still
 * logs in the thread.
 */
async function deliver(opts: {
  channel: ChannelValue;
  body: string;
  subject?: string | null;
  contact: { email: string | null; phone: string | null } | null;
  fromName?: string | null;
  replyTo?: string | null;
}): Promise<void> {
  try {
    if (!opts.contact) return;
    if (opts.channel === "EMAIL" && opts.contact.email) {
      await sendEmail({
        to: opts.contact.email,
        subject: opts.subject?.trim() || `Message from ${opts.fromName ?? "us"}`,
        text: opts.body,
        fromName: opts.fromName ?? undefined,
        replyTo: opts.replyTo ?? undefined,
      });
    } else if (opts.channel === "SMS" && opts.contact.phone) {
      await sendSms({ to: opts.contact.phone, body: opts.body });
    }
  } catch {
    /* keep the message logged even if the provider send failed */
  }
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

  if (body) {
    await deliver({
      channel,
      body,
      subject,
      contact: contact ? { email: contact.email, phone: contact.phone } : null,
      fromName: location?.name,
      replyTo: location?.email,
    });
  }

  revalidatePath(`/dashboard/l/${locationId}/conversations`);
  redirect(`/dashboard/l/${locationId}/conversations?c=${conversation.id}`);
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

  if (direction === "OUTBOUND") {
    await deliver({
      channel: convo.channel as ChannelValue,
      body,
      subject: convo.subject,
      contact: convo.contact ? { email: convo.contact.email, phone: convo.contact.phone } : null,
      fromName: convo.location?.name,
      replyTo: convo.location?.email,
    });
  }

  revalidatePath(`/dashboard/l/${locationId}/conversations`);
  redirect(`/dashboard/l/${locationId}/conversations?c=${conversationId}`);
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
