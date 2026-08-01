import "server-only";
import { prisma } from "@/lib/db";
import { encryptJson, decryptJson } from "@/lib/crypto";

// Encrypted platform-wide key/value settings. Lets the super-admin manage
// secrets (e.g. the platform Stripe keys) from the admin UI — stored encrypted
// at rest, same mechanism as integration credentials.

export const SETTING_KEYS = {
  stripeSecretKey: "stripe_secret_key",
  stripePublishableKey: "stripe_publishable_key",
  platformFeePercent: "platform_fee_percent",
  anthropicApiKey: "anthropic_api_key",
  ebayClientSecret: "ebay_client_secret",
  shopifyClientSecret: "shopify_client_secret",
  facebookAppId: "facebook_app_id",
  facebookAppSecret: "facebook_app_secret",
} as const;

export async function getSetting(key: string): Promise<string | null> {
  const row = await prisma.setting.findUnique({ where: { key } });
  if (!row?.valueCipher) return null;
  try {
    return decryptJson<{ v: string }>(row.valueCipher).v || null;
  } catch {
    return null;
  }
}

export async function setSetting(key: string, value: string | null): Promise<void> {
  const valueCipher = value ? encryptJson({ v: value }) : null;
  await prisma.setting.upsert({
    where: { key },
    create: { key, valueCipher },
    update: { valueCipher },
  });
}
