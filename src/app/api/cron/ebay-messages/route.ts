import { NextRequest, NextResponse } from "next/server";
import { syncAllEbayMessages } from "@/lib/ebay-messages";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

// Pulls eBay buyer questions into every connected business's inbox.
//   */10 * * * * curl -fsS -H "x-cron-secret: $CRON_SECRET" \
//     https://placidcrm.com/api/cron/ebay-messages >/dev/null
//
// Deliberately does NOT draft or send anything — replies go out only when a
// human clicks send in the inbox.

function authorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  return req.headers.get("x-cron-secret") === secret || req.nextUrl.searchParams.get("secret") === secret;
}

async function handle(req: NextRequest) {
  if (!authorized(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const summary = await syncAllEbayMessages();
  return NextResponse.json({ ok: true, ...summary });
}

export const GET = handle;
export const POST = handle;
