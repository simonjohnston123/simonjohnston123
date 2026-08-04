import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { importCjWarehouse, cjReady, LOCAL_WAREHOUSES } from "@/lib/cj";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

// Import a CJ warehouse into a location's catalogue.
//   /api/cron/cj-import?secret=…&country=AU&pages=5
//
// Deliberately one warehouse per call: CJ rate-limits catalogue reads to about
// one request a second, so importing the world in a single request would time
// out. Re-running is safe — rows are upserted on `<pid>:<COUNTRY>`.

function authorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  return req.headers.get("x-cron-secret") === secret || req.nextUrl.searchParams.get("secret") === secret;
}

async function handle(req: NextRequest) {
  if (!authorized(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!(await cjReady())) return NextResponse.json({ ok: false, reason: "CJ API key not set" });

  const country = (req.nextUrl.searchParams.get("country") || "AU").toUpperCase();
  const pages = Math.min(Number(req.nextUrl.searchParams.get("pages") ?? 5) || 5, 40);

  const locationId =
    req.nextUrl.searchParams.get("locationId") ??
    (
      await prisma.location.findFirst({
        where: { name: { contains: "Placid Deals", mode: "insensitive" } },
        select: { id: true },
      })
    )?.id;

  if (!locationId) return NextResponse.json({ ok: false, reason: "no locationId given and Placid Deals not found" });
  if (country !== "CN" && !LOCAL_WAREHOUSES.includes(country)) {
    return NextResponse.json({ ok: false, reason: `unknown warehouse ${country}` });
  }

  const r = await importCjWarehouse(locationId, country, { maxPages: pages });
  return NextResponse.json({ ...r, locationId });
}

export const GET = handle;
export const POST = handle;
