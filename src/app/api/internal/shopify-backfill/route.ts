import { NextRequest, NextResponse } from "next/server";
import { backfillShippingBatch } from "@/lib/shopify-products";
import { registerShopifyWebhooks } from "@/lib/shopify-webhooks";

export const dynamic = "force-dynamic";

// Internal one-shot shipping backfill (populates warehouse/shipCountries on already
// imported products). Batched + resumable: pass ?sinceId= from the previous response.
// Protected by CRON_SECRET so it can be curled server-side without a browser session.
export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const token = sp.get("token") ?? "";
  const secret = process.env.CRON_SECRET || "";
  if (!secret || token !== secret) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });

  const locationId = sp.get("locationId") ?? "";
  if (!locationId) return NextResponse.json({ ok: false, error: "locationId required" }, { status: 400 });

  // action=register-webhooks subscribes the store to live product webhooks.
  if (sp.get("action") === "register-webhooks") {
    return NextResponse.json(await registerShopifyWebhooks(locationId));
  }

  const sinceId = Number(sp.get("sinceId") || 0) || 0;
  const r = await backfillShippingBatch(locationId, sinceId);
  return NextResponse.json(r);
}
