import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { rebuildCustomerProfiles } from "@/lib/customer-profile";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

// Rebuild customer profiles from order history.
//   */30 * * * * curl -fsS -H "x-cron-secret: $CRON_SECRET" \
//     https://placidcrm.com/api/cron/customer-profiles >/dev/null

function authorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  return req.headers.get("x-cron-secret") === secret || req.nextUrl.searchParams.get("secret") === secret;
}

async function handle(req: NextRequest) {
  if (!authorized(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const only = req.nextUrl.searchParams.get("locationId");
  const locations = only
    ? [{ id: only }]
    : await prisma.order.findMany({ distinct: ["locationId"], select: { locationId: true } })
        .then((rows) => rows.map((r) => ({ id: r.locationId })));

  const results = [];
  for (const l of locations) {
    results.push({ locationId: l.id, ...(await rebuildCustomerProfiles(l.id)) });
  }
  return NextResponse.json({ ok: true, results });
}

export const GET = handle;
export const POST = handle;
