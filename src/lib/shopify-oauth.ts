import "server-only";
import crypto from "crypto";
import { getSetting, SETTING_KEYS } from "@/lib/platform-settings";
import { appUrl } from "@/lib/oauth-providers";

// Dedicated Shopify OAuth. Shopify's authorize + token endpoints are per-store
// (https://{shop}/admin/oauth/…), so it doesn't fit the fixed-URL generic OAuth
// map — hence its own connect/callback routes. The exchange returns a permanent
// offline access token, which we store in the SAME shape the apikey path used
// ({ shopDomain, adminToken }) so shopify-sync.ts works unchanged.

// Client ID is public (safe to ship). Env overrides the built-in default.
const SHOPIFY_CLIENT_ID_DEFAULT = "584cb9a18b2ba7c4c5dc2b8c76649751";
export const SHOPIFY_SCOPES = "read_orders,read_products,read_customers";

export function shopifyClientId(): string {
  return process.env.SHOPIFY_CLIENT_ID || SHOPIFY_CLIENT_ID_DEFAULT;
}

/** Secret from the admin settings store first, env as fallback. Never exposed to the client. */
export async function shopifyClientSecret(): Promise<string> {
  const fromSetting = await getSetting(SETTING_KEYS.shopifyClientSecret);
  return fromSetting || process.env.SHOPIFY_CLIENT_SECRET || "";
}

export async function shopifyConfigured(): Promise<boolean> {
  return Boolean(shopifyClientId() && (await shopifyClientSecret()));
}

/** "placiddeals.com" → null; "myshop", "https://myshop.myshopify.com/" → "myshop.myshopify.com". */
export function normalizeShop(input: string): string | null {
  let s = (input || "").trim().toLowerCase().replace(/^https?:\/\//, "").replace(/\/.*$/, "");
  if (!s) return null;
  if (!s.includes(".")) s = `${s}.myshopify.com`;
  return /^[a-z0-9][a-z0-9-]*\.myshopify\.com$/.test(s) ? s : null;
}

export function shopifyRedirectUri(): string {
  return `${appUrl()}/api/integrations/shopify/callback`;
}

export function buildShopifyAuthUrl(shop: string, state: string): string {
  const params = new URLSearchParams({
    client_id: shopifyClientId(),
    scope: SHOPIFY_SCOPES,
    redirect_uri: shopifyRedirectUri(),
    state,
  });
  return `https://${shop}/admin/oauth/authorize?${params.toString()}`;
}

/** Swap the authorization code for a permanent offline access token. */
export async function exchangeShopifyCode(shop: string, code: string): Promise<string | null> {
  const secret = await shopifyClientSecret();
  if (!secret) return null;
  try {
    const res = await fetch(`https://${shop}/admin/oauth/access_token`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ client_id: shopifyClientId(), client_secret: secret, code }),
    });
    if (!res.ok) return null;
    const json = (await res.json()) as { access_token?: string };
    return json.access_token || null;
  } catch {
    return null;
  }
}

/** Shopify signs every callback. Verify the hmac against the sorted params. */
export async function verifyShopifyHmac(params: URLSearchParams): Promise<boolean> {
  const secret = await shopifyClientSecret();
  if (!secret) return false;
  const hmac = params.get("hmac") || "";
  const entries: string[] = [];
  params.forEach((v, k) => {
    if (k !== "hmac" && k !== "signature") entries.push(`${k}=${v}`);
  });
  entries.sort();
  const digest = crypto.createHmac("sha256", secret).update(entries.join("&")).digest("hex");
  try {
    return crypto.timingSafeEqual(Buffer.from(digest), Buffer.from(hmac));
  } catch {
    return false;
  }
}
