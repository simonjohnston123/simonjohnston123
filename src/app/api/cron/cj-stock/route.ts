import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { refreshCjStock, cjReady } from "@/lib/cj";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

// Live stock feed: re-checks CJ warehouse levels for imported products, oldest
// first so it cycles through the catalogue.
//   */15 * * * * curl -fsS -H "x-cron-secret: $CRON_SECRET" \
//     https://placidcrm.com/api/cron/cj-stock >/dev/null
//
// CJ rate-limits to ~1 request/second, so each run deliberately handles a
// slice rather than the whole catalogue.

function authorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  return req.headers.get("x-cron-secret") === secret || req.nextUrl.searchParams.get("secret") === secret;
}

async function handle(req: NextRequest) {
  if (!authorized(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!(await cjReady())) return NextResponse.json({ ok: false, reason: "CJ API key not set" });

  const locations = await prisma.product.findMany({
    where: { source: "CJ Dropshipping" },
    distinct: ["locationId"],
    select: { locationId: true },
  });

  let checked = 0;
  for (const l of locations) {
    const r = await refreshCjStock(l.locationId, 120);
    checked += r.checked;
  }
  return NextResponse.json({ ok: true, locations: locations.length, checked });
}

export const GET = handle;
export const POST = handle;
