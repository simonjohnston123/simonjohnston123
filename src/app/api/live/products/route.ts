import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

// Public feed for the on-site live shopping experience: a location's own products
// as channels (by department) + the product reel. Used by the site-builder
// "Live Shop" block on the business's website.
export async function GET(req: NextRequest) {
  const locationId = req.nextUrl.searchParams.get("locationId") ?? "";
  if (!locationId) return NextResponse.json({ error: "locationId required" }, { status: 400 });

  const where = { locationId, active: true, imageUrl: { not: null } };

  const [rows, reel] = await Promise.all([
    prisma.product.findMany({ where, select: { category: true }, take: 20000 }),
    prisma.product.findMany({
      where,
      orderBy: { position: "asc" },
      take: 300,
      select: { id: true, name: true, priceCents: true, price: true, imageUrl: true, description: true, category: true, inventory: true },
    }),
  ]);

  // Channels = top-level departments derived from category, most-stocked first.
  const counts = new Map<string, number>();
  for (const r of rows) {
    const ch = channelOf(r.category);
    counts.set(ch.slug, (counts.get(ch.slug) ?? 0) + 1);
  }
  const channels = [...counts.entries()]
    .map(([slug, count]) => ({ slug, label: labelOf(slug), count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 16);

  const products = reel.map((p) => ({
    id: p.id,
    name: p.name,
    priceCents: typeof p.priceCents === "number" && p.priceCents > 0 ? p.priceCents : Math.round((p.price ?? 0) * 100),
    imageUrl: p.imageUrl,
    description: p.description,
    channel: channelOf(p.category).slug,
    stock: p.inventory,
  }));

  return NextResponse.json({ channels, products });
}

function firstSegment(category: string | null): string {
  const s = (category ?? "").split(/>|\/|,/)[0]?.trim();
  return s || "Everything Else";
}
function slugify(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "other";
}
const LABELS = new Map<string, string>();
function channelOf(category: string | null): { slug: string; label: string } {
  const label = firstSegment(category);
  const slug = slugify(label);
  if (!LABELS.has(slug)) LABELS.set(slug, label);
  return { slug, label };
}
function labelOf(slug: string): string {
  return LABELS.get(slug) ?? slug;
}
