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
