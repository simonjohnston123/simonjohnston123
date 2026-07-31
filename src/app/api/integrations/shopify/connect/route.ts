import { NextRequest, NextResponse } from "next/server";
import { requireLocationAccess } from "@/lib/auth";
import { signState, appUrl } from "@/lib/oauth-providers";
import { normalizeShop, buildShopifyAuthUrl, shopifyConfigured } from "@/lib/shopify-oauth";

export const dynamic = "force-dynamic";

// Kicks off Shopify OAuth: business clicks "Connect with Shopify", we redirect
// to their store's own consent screen. Redirects are built from the public
// origin (appUrl), never req.url (which is the internal container host).
export async function GET(req: NextRequest) {
  const locationId = req.nextUrl.searchParams.get("locationId") ?? "";
  const shopRaw = req.nextUrl.searchParams.get("shop") ?? "";
  if (!locationId) return NextResponse.redirect(`${appUrl()}/dashboard`);

  await requireLocationAccess(locationId);
  const back = (q: string) =>
    NextResponse.redirect(`${appUrl()}/dashboard/l/${locationId}/integrations?${q}`);

  if (!(await shopifyConfigured())) return back("error=not_configured");
  const shop = normalizeShop(shopRaw);
  if (!shop) return back("error=bad_shop");

  const state = signState({ locationId, provider: "SHOPIFY", shop, t: String(Date.now()) });
  return NextResponse.redirect(buildShopifyAuthUrl(shop, state));
}
