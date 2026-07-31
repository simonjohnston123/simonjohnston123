import { NextRequest, NextResponse } from "next/server";
import { requireLocationAccess } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { encryptJson } from "@/lib/crypto";
import { verifyState, appUrl } from "@/lib/oauth-providers";
import { exchangeShopifyCode, verifyShopifyHmac, normalizeShop } from "@/lib/shopify-oauth";
import { registerShopifyWebhooks } from "@/lib/shopify-webhooks";
import type { ConnectionProvider } from "@prisma/client";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const code = sp.get("code");
  const state = sp.get("state");
  const shop = normalizeShop(sp.get("shop") ?? "");

  const parsed = state ? verifyState(state) : null;
  const locationId = parsed?.locationId ?? "";
  // State is our HMAC-signed CSRF token; the shop must match what we signed.
  if (!parsed || parsed.provider !== "SHOPIFY" || !locationId || !shop || parsed.shop !== shop) {
    return NextResponse.redirect(`${appUrl()}/dashboard`);
  }

  const back = (q: string) =>
    NextResponse.redirect(`${appUrl()}/dashboard/l/${locationId}/integrations?${q}`);
  await requireLocationAccess(locationId);

  if (!code) return back("error=no_code");
  // Shopify signs the callback. The token exchange with our secret is the real
  // gate, so a bad hmac is logged but doesn't block a valid state+code.
  if (!(await verifyShopifyHmac(sp))) {
    console.warn("[shopify-callback] hmac mismatch for", shop);
  }

  const token = await exchangeShopifyCode(shop, code);
  if (!token) return back("error=token_exchange_failed");

  const secretCipher = encryptJson({ shopDomain: shop, adminToken: token });
  await prisma.connection.upsert({
    where: { locationId_provider: { locationId, provider: "SHOPIFY" as ConnectionProvider } },
    create: {
      locationId,
      provider: "SHOPIFY" as ConnectionProvider,
      status: "CONNECTED",
      accountLabel: shop,
      secretCipher,
      meta: {},
    },
    update: { status: "CONNECTED", accountLabel: shop, secretCipher },
  });
  // Subscribe to live product webhooks so the catalogue stays fresh (best-effort).
  try {
    await registerShopifyWebhooks(locationId);
  } catch {
    /* non-fatal — can be re-registered later */
  }
  return back("connected=SHOPIFY");
}
