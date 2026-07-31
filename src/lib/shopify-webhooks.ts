import "server-only";
import crypto from "crypto";
import { prisma } from "@/lib/db";
import { decryptJson } from "@/lib/crypto";
import { shopifyClientSecret } from "@/lib/shopify-oauth";
import { appUrl } from "@/lib/oauth-providers";

// Live product sync: subscribe each connected store to product webhooks so the CRM
// catalogue stays current automatically (no manual re-import).

const API_VERSION = "2024-07";
const TOPICS = ["products/create", "products/update", "products/delete"];

async function creds(locationId: string): Promise<{ shopDomain: string; adminToken: string } | null> {
  const conn = await prisma.connection.findUnique({ where: { locationId_provider: { locationId, provider: "SHOPIFY" } } });
  if (!conn?.secretCipher || conn.status !== "CONNECTED") return null;
  try {
    const c = decryptJson<{ shopDomain?: string; adminToken?: string }>(conn.secretCipher);
    if (!c.shopDomain || !c.adminToken) return null;
    return { shopDomain: c.shopDomain, adminToken: c.adminToken };
  } catch {
    return null;
  }
}

/** Shopify signs webhooks with the app secret (base64 HMAC over the raw body). */
export async function verifyWebhookHmac(rawBody: string, hmacHeader: string): Promise<boolean> {
  const secret = await shopifyClientSecret();
  if (!secret || !hmacHeader) return false;
  const digest = crypto.createHmac("sha256", secret).update(rawBody, "utf8").digest("base64");
  try {
    return crypto.timingSafeEqual(Buffer.from(digest), Buffer.from(hmacHeader));
  } catch {
    return false;
  }
}

/** Which sub-account owns a given myshopify domain. */
export async function locationForShop(shopDomain: string): Promise<string | null> {
  const conn = await prisma.connection.findFirst({
    where: { provider: "SHOPIFY", accountLabel: shopDomain, status: "CONNECTED" },
    select: { locationId: true },
  });
  return conn?.locationId ?? null;
}

/** Subscribe this store to product create/update/delete webhooks (idempotent — a
 *  422 "already exists" is treated as success). */
export async function registerShopifyWebhooks(locationId: string): Promise<{ ok: boolean; subscribed: number; reason?: string }> {
  const c = await creds(locationId);
  if (!c) return { ok: false, subscribed: 0, reason: "Shopify isn't connected" };
  const address = `${appUrl()}/api/webhooks/shopify/products`;
  let subscribed = 0;
  for (const topic of TOPICS) {
    try {
      const res = await fetch(`https://${c.shopDomain}/admin/api/${API_VERSION}/webhooks.json`, {
        method: "POST",
        headers: { "X-Shopify-Access-Token": c.adminToken, "content-type": "application/json" },
        body: JSON.stringify({ webhook: { topic, address, format: "json" } }),
      });
      if (res.ok || res.status === 422) subscribed++; // 422 = already subscribed
    } catch {
      /* keep going */
    }
  }
  return { ok: true, subscribed };
}
