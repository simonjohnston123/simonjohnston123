"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireLocationAccess } from "@/lib/auth";
import { encryptJson } from "@/lib/crypto";
import { providerDef, type ProviderKey } from "@/lib/integrations-catalog";
import type { ConnectionProvider } from "@prisma/client";

/** Validate provider credentials where we can, before storing them. */
async function validate(provider: ProviderKey, creds: Record<string, string>): Promise<string | null> {
  if (provider === "TWILIO") {
    const { accountSid, authToken } = creds;
    if (!/^AC[0-9a-f]{32}$/i.test(accountSid || "")) return "That doesn't look like a Twilio Account SID (starts with AC…).";
    if (!authToken) return "Enter your Twilio Auth Token.";
    if (!creds.fromNumber) return "Enter a from number or sender ID.";
    try {
      const auth = Buffer.from(`${accountSid}:${authToken}`).toString("base64");
      const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${accountSid}.json`, {
        headers: { Authorization: `Basic ${auth}` },
      });
      if (!res.ok) return "Twilio rejected those credentials — double-check the SID and Auth Token.";
    } catch {
      return "Couldn't reach Twilio to verify the credentials. Try again.";
    }
  }
  if (provider === "SMTP") {
    if (!creds.host || !creds.username || !creds.password || !creds.fromEmail) {
      return "Fill in host, username, password and from address.";
    }
  }
  if (provider === "STRIPE") {
    const sk = creds.secretKey || "";
    if (!/^(sk|rk)_(live|test)_/.test(sk)) return "That doesn't look like a Stripe secret key (starts with sk_live_ or rk_live_).";
    try {
      const res = await fetch("https://api.stripe.com/v1/account", { headers: { Authorization: `Bearer ${sk}` } });
      if (!res.ok) return "Stripe rejected that key — double-check you copied the secret key correctly.";
    } catch {
      return "Couldn't reach Stripe to verify the key. Try again.";
    }
  }
  return null;
}

function labelFor(provider: ProviderKey, creds: Record<string, string>): string | null {
  if (provider === "TWILIO") return creds.fromNumber ?? null;
  if (provider === "SMTP") return creds.fromEmail ?? null;
  if (provider === "STRIPE") {
    const sk = creds.secretKey || "";
    const mode = sk.includes("_live_") ? "Live" : "Test";
    return `${mode} · ••••${sk.slice(-4)}`;
  }
  return null;
}

export async function connectApiKeyAction(_prev: unknown, formData: FormData) {
  const locationId = String(formData.get("locationId") ?? "");
  const provider = String(formData.get("provider") ?? "") as ProviderKey;
  await requireLocationAccess(locationId);

  const def = providerDef(provider);
  if (!def || def.connectType !== "apikey" || !def.fields) {
    return { error: "This integration can't be connected that way." };
  }

  const creds: Record<string, string> = {};
  for (const f of def.fields) creds[f.key] = String(formData.get(f.key) ?? "").trim();

  const missing = def.fields.find((f) => !creds[f.key]);
  if (missing) return { error: `${missing.label} is required.` };

  const err = await validate(provider, creds);
  if (err) return { error: err };

  await prisma.connection.upsert({
    where: { locationId_provider: { locationId, provider: provider as ConnectionProvider } },
    create: {
      locationId,
      provider: provider as ConnectionProvider,
      status: "CONNECTED",
      accountLabel: labelFor(provider, creds),
      secretCipher: encryptJson(creds),
    },
    update: {
      status: "CONNECTED",
      accountLabel: labelFor(provider, creds),
      secretCipher: encryptJson(creds),
    },
  });

  revalidatePath(`/dashboard/l/${locationId}/integrations`);
  return { error: "", ok: true };
}

export async function disconnectAction(formData: FormData) {
  const locationId = String(formData.get("locationId") ?? "");
  const provider = String(formData.get("provider") ?? "") as ProviderKey;
  await requireLocationAccess(locationId);

  await prisma.connection.deleteMany({
    where: { locationId, provider: provider as ConnectionProvider },
  });
  revalidatePath(`/dashboard/l/${locationId}/integrations`);
}
