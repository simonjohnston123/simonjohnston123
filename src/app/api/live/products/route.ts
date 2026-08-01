import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

// Public feed for the on-site live shopping experience. Channels are derived from
// the SAME products we return (so every pill has products), and products are
// de-duplicated by name so the reel doesn't show the same item repeatedly.
export async function GET(req: NextRequest) {
  const locationId = req.nextUrl.searchParams.get("locationId") ?? "";
  if (!locationId) return NextResponse.json({ error: "locationId required" }, { status: 400 });

  const rows = await prisma.product.findMany({
    where: { locationId, active: true, imageUrl: { not: null } },
    orderBy: { updatedAt: "desc" },
    take: 3000,
    select: { id: true, name: true, priceCents: true, price: true, imageUrl: true, description: true, category: true, inventory: true },
  });

  const seenName = new Set<string>();
  const seenImg = new Set<string>();
  const labels = new Map<string, string>();
  const counts = new Map<string, number>();
  const products: { id: string; name: string; priceCents: number; imageUrl: string | null; description: string | null; channel: string; stock: number | null }[] = [];

  for (const p of rows) {
    // De-dupe: one product per distinct name AND per distinct image.
    const nameKey = p.name.trim().toLowerCase().replace(/\s+/g, " ");
    const imgKey = (p.imageUrl ?? "").split("?")[0];
    if (seenName.has(nameKey) || (imgKey && seenImg.has(imgKey))) continue;
    seenName.add(nameKey);
    if (imgKey) seenImg.add(imgKey);

    const label = firstSegment(p.category);
    const slug = slugify(label);
    if (!labels.has(slug)) labels.set(slug, label);
    counts.set(slug, (counts.get(slug) ?? 0) + 1);

    products.push({
      id: p.id,
      name: p.name,
      priceCents: typeof p.priceCents === "number" && p.priceCents > 0 ? p.priceCents : Math.round((p.price ?? 0) * 100),
      imageUrl: p.imageUrl,
      description: (p.description ?? "").slice(0, 240) || null,
      channel: slug,
      stock: p.inventory,
    });
    if (products.length >= 900) break;
  }

  const channels = [...counts.entries()]
    .map(([slug, count]) => ({ slug, label: labels.get(slug) ?? slug, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 16);

  return NextResponse.json({ channels, products });
}

function firstSegment(category: string | null): string {
  const s = (category ?? "").split(/>|\/|,/)[0]?.trim();
  return s || "Everything Else";
}
function slugify(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "other";
}
