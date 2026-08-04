import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { dzReady, dzFactsForSkus } from "@/lib/dropshipzone";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

// Backfill supplier cost + stock onto Dropshipzone products.
//   */5 * * * * curl -fsS -H "x-cron-secret: $CRON_SECRET" \
//     https://placidcrm.com/api/cron/dz-costs >/dev/null
//
// Products with no cost come first (that's the gap that makes margin
// invisible), then the least-recently-checked, so it keeps stock fresh once the
// backfill is done. DZ allows 60 requests/min, so each run takes a slice.

const BATCH = 50;
const BATCHES_PER_RUN = 8;

function authorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  return req.headers.get("x-cron-secret") === secret || req.nextUrl.searchParams.get("secret") === secret;
}

async function handle(req: NextRequest) {
  if (!authorized(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!dzReady()) return NextResponse.json({ ok: false, reason: "Dropshipzone credentials not set" });

  let updated = 0;
  let checked = 0;
  let missing = 0;

  for (let round = 0; round < BATCHES_PER_RUN; round++) {
    const rows = await prisma.product.findMany({
      where: { supplier: "Dropshipzone", sku: { not: null } },
      // Nulls first: fill the gap before refreshing what we already know.
      orderBy: [{ costCents: { sort: "asc", nulls: "first" } }, { updatedAt: "asc" }],
      take: BATCH,
      select: { id: true, sku: true, costCents: true, priceCents: true },
    });
    if (!rows.length) break;

    const facts = await dzFactsForSkus(rows.map((r) => r.sku!).filter(Boolean));
    checked += rows.length;

    for (const r of rows) {
      const f = r.sku ? facts.get(r.sku) : undefined;
      if (!f) {
        // Touch it so a SKU the supplier no longer lists doesn't jam the queue.
        await prisma.product.update({ where: { id: r.id }, data: { updatedAt: new Date() } });
        missing++;
        continue;
      }
      await prisma.product.update({
        where: { id: r.id },
        data: {
          costCents: f.costCents ?? r.costCents,
          inventory: f.stock ?? undefined,
          // Only set a price where there isn't one — never overwrite pricing
          // that has been set deliberately.
          priceCents: r.priceCents ?? (f.costCents ? Math.round(f.costCents * 1.7) : undefined),
        },
      });
      updated++;
    }
  }

  return NextResponse.json({ ok: true, checked, updated, missing });
}

export const GET = handle;
export const POST = handle;
