import "server-only";

// ---------------------------------------------------------------------------
// Comms layer — real email (Resend) + SMS (Twilio) via their REST APIs.
// No SDKs, so the Docker build needs no new dependencies. Secrets come from
// env; when a provider isn't configured we fall back to "logged" (no send),
// so automations keep working end-to-end before keys are added.
// ---------------------------------------------------------------------------

export function emailConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY && process.env.EMAIL_FROM);
}

export function smsConfigured(): boolean {
  return Boolean(
    process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_FROM,
  );
}

export type SendResult = { sent: boolean; detail: string };

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/** Extract the bare address from an "Name <addr@x>" or "addr@x" env value. */
function addressOnly(from: string): string {
  const m = from.match(/<([^>]+)>/);
  return (m ? m[1] : from).trim();
}

export async function sendEmail(args: {
  to: string;
  subject: string;
  text: string;
  fromName?: string;
  replyTo?: string;
}): Promise<SendResult> {
  if (!emailConfigured()) {
    return { sent: false, detail: "logged — email provider not connected" };
  }
  const envFrom = process.env.EMAIL_FROM as string;
  const from = args.fromName ? `${args.fromName} <${addressOnly(envFrom)}>` : envFrom;
  const html = `<div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;font-size:15px;line-height:1.6;color:#0f172a">${escapeHtml(
    args.text,
  ).replace(/\n/g, "<br>")}</div>`;

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: [args.to],
      subject: args.subject || "(no subject)",
      html,
      text: args.text,
      ...(args.replyTo ? { reply_to: args.replyTo } : {}),
    }),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`Resend ${res.status}: ${detail.slice(0, 140)}`);
  }
  return { sent: true, detail: `email sent to ${args.to}` };
}

export async function sendSms(args: { to: string; body: string }): Promise<SendResult> {
  if (!smsConfigured()) {
    return { sent: false, detail: "logged — SMS provider not connected" };
  }
  const sid = process.env.TWILIO_ACCOUNT_SID as string;
  const token = process.env.TWILIO_AUTH_TOKEN as string;
  const from = process.env.TWILIO_FROM as string;
  const auth = Buffer.from(`${sid}:${token}`).toString("base64");

  const form = new URLSearchParams({ To: args.to, From: from, Body: args.body });
  const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${auth}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: form.toString(),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`Twilio ${res.status}: ${detail.slice(0, 140)}`);
  }
  return { sent: true, detail: `SMS sent to ${args.to}` };
}
