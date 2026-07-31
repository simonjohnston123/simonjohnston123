import "server-only";
import nodemailer from "nodemailer";
import { prisma } from "@/lib/db";
import { decryptJson } from "@/lib/crypto";
import type { ConnectionProvider } from "@prisma/client";
import {
  sendEmail as sendEmailGlobal,
  sendSms as sendSmsGlobal,
  emailConfigured,
  smsConfigured,
  type SendResult,
} from "@/lib/comms";

// ---------------------------------------------------------------------------
// Per-location outbound delivery. Each business sends through ITS OWN connected
// provider: email via its SMTP mailbox (so replies loop back into the Inbox),
// SMS via its own Twilio. Falls back to platform creds only if the business
// hasn't connected its own. Returns a result and NEVER throws — but the caller
// now surfaces "not sent" instead of hiding it.
// ---------------------------------------------------------------------------

export type ChannelValue = "SMS" | "EMAIL" | "WHATSAPP" | "WEBCHAT" | "NOTE";

async function locationCreds(locationId: string, provider: ConnectionProvider): Promise<Record<string, string> | null> {
  const conn = await prisma.connection.findFirst({ where: { locationId, provider, status: "CONNECTED" } });
  if (!conn?.secretCipher) return null;
  try {
    return decryptJson<Record<string, string>>(conn.secretCipher);
  } catch {
    return null;
  }
}

async function sendEmailViaSmtp(
  creds: Record<string, string>,
  args: { to: string; subject: string; text: string; fromName?: string | null; replyTo?: string | null },
): Promise<SendResult> {
  const port = Number(creds.port) || 587;
  const transport = nodemailer.createTransport({
    host: creds.host,
    port,
    secure: port === 465, // 465 = implicit TLS; 587 = STARTTLS
    auth: { user: creds.username, pass: creds.password },
    tls: { rejectUnauthorized: false },
  });
  const fromAddr = creds.fromEmail || creds.username;
  const from = args.fromName ? `"${args.fromName}" <${fromAddr}>` : fromAddr;
  await transport.sendMail({
    from,
    to: args.to,
    subject: args.subject || "(no subject)",
    text: args.text,
    replyTo: args.replyTo || undefined,
  });
  return { sent: true, detail: `email sent to ${args.to} from ${fromAddr}` };
}

async function sendSmsViaTwilio(creds: Record<string, string>, args: { to: string; body: string }): Promise<SendResult> {
  const sid = creds.accountSid;
  const token = creds.authToken;
  const from = creds.fromNumber;
  const auth = Buffer.from(`${sid}:${token}`).toString("base64");
  const form = new URLSearchParams({ To: args.to, From: from, Body: args.body });
  const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
    method: "POST",
    headers: { Authorization: `Basic ${auth}`, "Content-Type": "application/x-www-form-urlencoded" },
    body: form.toString(),
  });
  if (!res.ok) {
    const d = await res.text().catch(() => "");
    throw new Error(`Twilio ${res.status}: ${d.slice(0, 160)}`);
  }
  return { sent: true, detail: `SMS sent to ${args.to}` };
}

export type ChannelStatus = { canSend: boolean; via: "mailbox" | "twilio" | "platform" | null };

/** What this location can actually deliver on right now. */
export async function locationSendStatus(locationId: string): Promise<Record<"EMAIL" | "SMS", ChannelStatus>> {
  const [smtp, twilio] = await Promise.all([locationCreds(locationId, "SMTP"), locationCreds(locationId, "TWILIO")]);
  return {
    EMAIL: smtp
      ? { canSend: true, via: "mailbox" }
      : emailConfigured()
        ? { canSend: true, via: "platform" }
        : { canSend: false, via: null },
    SMS: twilio
      ? { canSend: true, via: "twilio" }
      : smsConfigured()
        ? { canSend: true, via: "platform" }
        : { canSend: false, via: null },
  };
}

export async function deliverForLocation(
  locationId: string,
  opts: {
    channel: ChannelValue;
    body: string;
    subject?: string | null;
    contact: { email: string | null; phone: string | null } | null;
    fromName?: string | null;
    replyTo?: string | null;
  },
): Promise<SendResult> {
  try {
    if (!opts.contact) return { sent: false, detail: "no contact on this conversation" };

    if (opts.channel === "EMAIL") {
      if (!opts.contact.email) return { sent: false, detail: "this contact has no email address" };
      const subject = opts.subject?.trim() || `Message from ${opts.fromName ?? "us"}`;
      const smtp = await locationCreds(locationId, "SMTP");
      if (smtp?.host && smtp?.username && smtp?.password) {
        return await sendEmailViaSmtp(smtp, { to: opts.contact.email, subject, text: opts.body, fromName: opts.fromName, replyTo: opts.replyTo });
      }
      if (emailConfigured()) {
        return await sendEmailGlobal({ to: opts.contact.email, subject, text: opts.body, fromName: opts.fromName ?? undefined, replyTo: opts.replyTo ?? undefined });
      }
      return { sent: false, detail: "no email account connected — connect email in Integrations" };
    }

    if (opts.channel === "SMS") {
      if (!opts.contact.phone) return { sent: false, detail: "this contact has no phone number" };
      const tw = await locationCreds(locationId, "TWILIO");
      if (tw?.accountSid && tw?.authToken && tw?.fromNumber) {
        return await sendSmsViaTwilio(tw, { to: opts.contact.phone, body: opts.body });
      }
      if (smsConfigured()) {
        return await sendSmsGlobal({ to: opts.contact.phone, body: opts.body });
      }
      return { sent: false, detail: "no SMS provider connected — connect Twilio in Integrations to send texts" };
    }

    // WEBCHAT / NOTE aren't outbound-deliverable; treat as stored-only.
    return { sent: true, detail: "stored" };
  } catch (e) {
    return { sent: false, detail: e instanceof Error ? e.message : "send failed" };
  }
}
