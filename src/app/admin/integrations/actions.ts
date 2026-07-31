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
