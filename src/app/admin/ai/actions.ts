"use server";

import { revalidatePath } from "next/cache";
import { requireSuperAdmin } from "@/lib/auth";
import { setSetting, SETTING_KEYS } from "@/lib/platform-settings";

export type SaveState = { error: string; ok?: boolean };

export async function saveAiKeyAction(_prev: SaveState, formData: FormData): Promise<SaveState> {
  await requireSuperAdmin();
  const key = String(formData.get("apiKey") ?? "").trim();
  if (!key) return { error: "Paste your Anthropic API key." };
  if (!key.startsWith("sk-ant-")) return { error: "That doesn't look like an Anthropic key (starts with sk-ant-)." };

  // Light validation: a tiny request. Non-fatal if the account is out of credit —
  // we still save the key (it's the credit, not the key, that's the issue).
  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "content-type": "application/json", "x-api-key": key, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({ model: "claude-haiku-4-5-20251001", max_tokens: 1, messages: [{ role: "user", content: "hi" }] }),
    });
    if (res.status === 401) return { error: "Anthropic rejected that key (401) — double-check you copied it correctly." };
  } catch {
    /* network hiccup — save anyway */
  }

  await setSetting(SETTING_KEYS.anthropicApiKey, key);
  revalidatePath("/admin/ai");
  return { error: "", ok: true };
}
