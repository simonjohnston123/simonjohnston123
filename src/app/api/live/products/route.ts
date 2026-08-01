import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { classify } from "@/lib/live-categories";

export const dynamic = "force-dynamic";

// Public feed for the live shopping experience. Products are classified into
// clean, safe channels by keyword (not the messy supplier department), adult
// items are excluded, and the reel is de-duped so nothing repeats.
export async function GET(req: NextRequest) {
  const locationId = req.nextUrl.searchParams.get("locationId") ?? "";
  if (!locationId) return NextResponse.json({ error: "locationId required" }, { status: 400 });

  const rows = await prisma.product.findMany({
    where: { locationId, active: true, imageUrl: { not: null } },
    orderBy: { updatedAt: "desc" },
    take: 5000,
    select: { id: true, name: true, priceCents: true, price: true, imageUrl: true, description: true, category: true, inventory: true },
  });

  const seenName = new Set<string>();
  const seenImg = new Set<string>();
  const channelMeta = new Map<string, { label: string; icon: string; count: number }>();
  const products: { id: string; name: string; priceCents: number; imageUrl: string | null; description: string | null; channel: string; stock: number | null }[] = [];

  for (const p of rows) {
    const ch = classify(p.name, p.category);
    if (!ch) continue; // excluded (adult, etc.)

    const nameKey = p.name.trim().toLowerCase().replace(/\s+/g, " ");
    const imgKey = (p.imageUrl ?? "").split("?")[0];
    if (seenName.has(nameKey) || (imgKey && seenImg.has(imgKey))) continue;
    seenName.add(nameKey);
    if (imgKey) seenImg.add(imgKey);

    const m = channelMeta.get(ch.slug);
    if (m) m.count++;
    else channelMeta.set(ch.slug, { label: ch.label, icon: ch.icon, count: 1 });

    products.push({
      id: p.id,
      name: p.name,
      priceCents: typeof p.priceCents === "number" && p.priceCents > 0 ? p.priceCents : Math.round((p.price ?? 0) * 100),
      imageUrl: p.imageUrl,
      description: (p.description ?? "").slice(0, 240) || null,
      channel: ch.slug,
      stock: p.inventory,
    });
    if (products.length >= 1200) break;
  }

  const channels = [...channelMeta.entries()]
    .map(([slug, m]) => ({ slug, label: m.label, icon: m.icon, count: m.count }))
    .sort((a, b) => b.count - a.count);

  return NextResponse.json({ channels, products });
}
