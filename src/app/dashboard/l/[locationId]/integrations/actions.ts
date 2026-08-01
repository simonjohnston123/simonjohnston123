"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireLocationAccess } from "@/lib/auth";
import { encryptJson, decryptJson } from "@/lib/crypto";
import { providerDef, type ProviderKey } from "@/lib/integrations-catalog";
import type { ConnectionProvider } from "@prisma/client";

/** Re-run Facebook page enumeration using the token already stored on the
 *  connection — picks up Pages newly assigned to the system user without asking
 *  the user to paste the token again. */
export async function refreshFacebookPagesAction(_prev: unknown, formData: FormData) {
  const locationId = String(formData.get("locationId") ?? "");
  await requireLocationAccess(locationId);
  const conn = await prisma.connection.findUnique({
    where: { locationId_provider: { locationId, provider: "FACEBOOK" } },
  });
  if (!conn?.secretCipher) return { error: "Connect Facebook first." };
  let token = "";
  try {
    token = decryptJson<{ accessToken?: string }>(conn.secretCipher).accessToken ?? "";
  } catch {
    return { error: "Stored token couldn't be read — reconnect Facebook." };
  }
  if (!token) return { error: "No stored token — reconnect Facebook." };
  const { setupFacebookConnection } = await import("@/lib/facebook");
  const result = await setupFacebookConnection(locationId, token);
  if (!result) return { error: "Facebook rejected the stored token — reconnect Facebook." };
  revalidatePath(`/dashboard/l/${locationId}/integrations`);
  return { error: "", ok: true };
}

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
  if (provider === "SQUARE") {
    const token = creds.accessToken || "";
    if (!token) return "Enter your Square access token.";
    try {
      const res = await fetch("https://connect.squareup.com/v2/locations", {
        headers: { Authorization: `Bearer ${token}`, "Square-Version": "2024-06-04" },
      });
      if (!res.ok) return "Square rejected that token — check you copied the production access token correctly.";
    } catch {
      return "Couldn't reach Square to verify the token. Try again.";
    }
  }
  if (provider === "SHOPIFY") {
    const domain = (creds.shopDomain || "").replace(/^https?:\/\//, "").replace(/\/.*$/, "").trim();
    const token = creds.adminToken || "";
    if (!/\.myshopify\.com$/i.test(domain)) return "Store domain should look like your-store.myshopify.com.";
    if (!token) return "Enter your Shopify Admin API access token.";
    try {
      const res = await fetch(`https://${domain}/admin/api/2024-07/shop.json`, {
        headers: { "X-Shopify-Access-Token": token },
      });
      if (!res.ok) return "Shopify rejected those details — check the store domain and Admin API token.";
    } catch {
      return "Couldn't reach Shopify to verify the connection. Try again.";
    }
    creds.shopDomain = domain; // store normalised
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
  if (provider === "SQUARE") {
    const t = creds.accessToken || "";
    return `Square · ••••${t.slice(-4)}`;
  }
  if (provider === "SHOPIFY") return creds.shopDomain ?? null;
  return null;
}

export async function connectApiKeyAction(_prev: unknown, formData: FormData) {
  const locationId = String(formData.get("locationId") ?? "");
  const provider = String(formData.get("provider") ?? "") as ProviderKey;
  await requireLocationAccess(locationId);

  // Facebook: the manual path takes a System-User (or Page) access token and runs
  // it through the same page-enumeration + webhook-subscription as the OAuth flow.
  if (provider === "FACEBOOK") {
    const token = String(formData.get("pageToken") ?? "").trim();
    if (!token) return { error: "Paste your Page / System-User access token." };
    const { setupFacebookConnection } = await import("@/lib/facebook");
    const result = await setupFacebookConnection(locationId, token);
    if (!result) {
      return { error: "Facebook rejected that token. Check it's a valid System-User token with the Pages assigned." };
    }
    if (result.pages.length === 0) {
      return { error: "That token works but no Pages are assigned to it. In Business Settings → System users, assign your Pages to the system user, then regenerate the token." };
    }
    revalidatePath(`/dashboard/l/${locationId}/integrations`);
    return { error: "", ok: true };
  }

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

/** Save the integrations a business says it wants to use (onboarding chooser). */
export async function saveWantedIntegrationsAction(formData: FormData) {
  const locationId = String(formData.get("locationId") ?? "");
  await requireLocationAccess(locationId);
  const wanted = formData.getAll("wanted").map(String).filter(Boolean);
  await prisma.location.update({ where: { id: locationId }, data: { wantedIntegrations: wanted } });
  revalidatePath(`/dashboard/l/${locationId}/integrations`);
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
