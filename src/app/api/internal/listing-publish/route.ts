import { NextRequest, NextResponse } from "next/server";
import { publishBatchCore } from "@/app/dashboard/l/[locationId]/listings/actions";

export const dynamic = "force-dynamic";

// TEMPORARY: verify the Listing Tool publish adapter without the (flaky) browser.
// Guarded by CRON_SECRET. Remove after verification.
export async function GET(req: NextRequest) {
  const secret = req.nextUrl.searchParams.get("secret");
  if (!secret || secret !== process.env.CRON_SECRET) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const locationId = req.nextUrl.searchParams.get("locationId") || "";
  const batchId = req.nextUrl.searchParams.get("batchId") || "";
  const result = await publishBatchCore(locationId, batchId);
  return NextResponse.json(result);
}
