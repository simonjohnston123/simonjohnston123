"use server";

import { revalidatePath } from "next/cache";
import { requireSuperAdmin } from "@/lib/auth";
import { setSetting, SETTING_KEYS } from "@/lib/platform-settings";

export type SaveState = { error: string; ok?: boolean };

export async function saveEbayCertAction(_prev: SaveState, formData: FormData): Promise<SaveState> {
  await requireSuperAdmin();
  const cert = String(formData.get("certId") ?? "").trim();
  if (!cert) return { error: "Paste your eBay Cert ID (Client Secret)." };
  if (!/^(PRD|SBX)-/.test(cert)) {
    return { error: "That doesn't look like an eBay Cert ID (starts with PRD- for production or SBX- for sandbox)." };
  }
  await setSetting(SETTING_KEYS.ebayClientSecret, cert);
  revalidatePath("/admin/integrations");
  return { error: "", ok: true };
}

export async function saveCjCredsAction(_prev: SaveState, formData: FormData): Promise<SaveState> {
  await requireSuperAdmin();
  const email = String(formData.get("cjEmail") ?? "").trim();
  const apiKey = String(formData.get("cjApiKey") ?? "").trim();
  if (!email && !apiKey) return { error: "Enter the CJ account email and API key." };
  if (email && !email.includes("@")) return { error: "That doesn't look like the CJ account email." };
  if (apiKey && apiKey.length < 20) {
    return { error: "That doesn't look like a CJ API key — get it from CJ → My CJ → Authorization → API." };
  }
  if (email) await setSetting(SETTING_KEYS.cjEmail, email);
  if (apiKey) await setSetting(SETTING_KEYS.cjApiKey, apiKey);
  revalidatePath("/admin/integrations");
  return { error: "", ok: true };
}

export async function saveFacebookCredsAction(_prev: SaveState, formData: FormData): Promise<SaveState> {
  await requireSuperAdmin();
  const appId = String(formData.get("appId") ?? "").trim();
  const appSecret = String(formData.get("appSecret") ?? "").trim();
  if (!appId && !appSecret) return { error: "Enter your Facebook App ID and App Secret." };
  if (appId && !/^\d{10,20}$/.test(appId)) return { error: "The App ID should be the long number from App settings → Basic." };
  if (appSecret && appSecret.length < 20) return { error: "That doesn't look like an App Secret (a long hex string; click Show on App settings → Basic)." };
  if (appId) await setSetting(SETTING_KEYS.facebookAppId, appId);
  if (appSecret) await setSetting(SETTING_KEYS.facebookAppSecret, appSecret);
  revalidatePath("/admin/integrations");
  return { error: "", ok: true };
}

export async function saveShopifySecretAction(_prev: SaveState, formData: FormData): Promise<SaveState> {
  await requireSuperAdmin();
  const secret = String(formData.get("clientSecret") ?? "").trim();
  if (!secret) return { error: "Paste your Shopify app Client Secret." };
  if (secret.length < 20) {
    return { error: "That doesn't look like a Shopify Client Secret (it's a long hex string from the app's Settings → Credentials)." };
  }
  await setSetting(SETTING_KEYS.shopifyClientSecret, secret);
  revalidatePath("/admin/integrations");
  return { error: "", ok: true };
}
