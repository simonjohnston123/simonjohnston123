"use server";

import { revalidatePath } from "next/cache";
import { requireSuperAdmin } from "@/lib/auth";
import { setSetting, SETTING_KEYS } from "@/lib/platform-settings";

export type SaveState = { error: string; ok?: boolean };

/**
 * Save the platform Stripe keys + fee from the admin UI. The secret key is
 * verified against Stripe before it's stored (encrypted). Blank fields are left
 * unchanged, so you can update the fee without re-entering keys.
 */
export async function savePaymentSettingsAction(_prev: SaveState, formData: FormData): Promise<SaveState> {
  await requireSuperAdmin();

  const secretKey = String(formData.get("secretKey") ?? "").trim();
  const publishableKey = String(formData.get("publishableKey") ?? "").trim();
  const feePercent = String(formData.get("feePercent") ?? "").trim();

  if (secretKey) {
    if (!/^(sk|rk)_(live|test)_/.test(secretKey)) {
      return { error: "That doesn't look like a Stripe secret key (starts with sk_live_ or rk_live_)." };
    }
    try {
      const res = await fetch("https://api.stripe.com/v1/account", {
        headers: { Authorization: `Bearer ${secretKey}` },
      });
      if (!res.ok) return { error: "Stripe rejected that secret key — double-check you copied it correctly." };
    } catch {
      return { error: "Couldn't reach Stripe to verify the key. Try again." };
    }
    await setSetting(SETTING_KEYS.stripeSecretKey, secretKey);
  }

  if (publishableKey) {
    if (!/^pk_(live|test)_/.test(publishableKey)) {
      return { error: "That doesn't look like a Stripe publishable key (starts with pk_live_)." };
    }
    await setSetting(SETTING_KEYS.stripePublishableKey, publishableKey);
  }

  if (feePercent) {
    const v = Number(feePercent);
    if (!Number.isFinite(v) || v < 0 || v > 100) return { error: "Fee % must be a number between 0 and 100." };
    await setSetting(SETTING_KEYS.platformFeePercent, String(v));
  }

  revalidatePath("/admin/payments");
  return { error: "", ok: true };
}
