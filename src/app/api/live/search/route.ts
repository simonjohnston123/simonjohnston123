import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

// Intent search over the whole catalogue — "earbuds", "air fryer", "dog bed" —
// returns a de-duped live channel of matching products to play.
export async function GET(req: NextRequest) {
  const locationId = req.nextUrl.searchParams.get("locationId") ?? "";
  const q = (req.nextUrl.searchParams.get("q") ?? "").trim().slice(0, 80);
  if (!locationId) return NextResponse.json({ error: "locationId required" }, { status: 400 });
  if (q.length < 2) return NextResponse.json({ products: [] });

  // Match singular/plural + each word so "pets" finds "Pet Care", "earphones"
  // finds "earphone", etc. Any term matching any field counts.
  const base = Array.from(new Set([q, q.replace(/s$/i, ""), q.endsWith("s") ? q : q + "s"]));
  const words = q.split(/\s+/).filter((w) => w.length >= 3);
  const terms = Array.from(new Set([...base, ...words].map((t) => t.trim()).filter((t) => t.length >= 2)));
  const OR = terms.flatMap((t) => [
    { name: { contains: t, mode: "insensitive" as const } },
    { category: { contains: t, mode: "insensitive" as const } },
    { description: { contains: t, mode: "insensitive" as const } },
  ]);

  const rows = await prisma.product.findMany({
    where: { locationId, active: true, imageUrl: { not: null }, OR },
    orderBy: { inventory: "desc" },
    take: 400,
    select: { id: true, name: true, priceCents: true, price: true, imageUrl: true, description: true, category: true, inventory: true },
  });

  const seenName = new Set<string>();
  const seenImg = new Set<string>();
  const products: { id: string; name: string; priceCents: number; imageUrl: string | null; description: string | null; channel: string; stock: number | null }[] = [];
  for (const p of rows) {
    const nameKey = p.name.trim().toLowerCase().replace(/\s+/g, " ");
    const imgKey = (p.imageUrl ?? "").split("?")[0];
    if (seenName.has(nameKey) || (imgKey && seenImg.has(imgKey))) continue;
    seenName.add(nameKey);
    if (imgKey) seenImg.add(imgKey);
    products.push({
      id: p.id,
      name: p.name,
      priceCents: typeof p.priceCents === "number" && p.priceCents > 0 ? p.priceCents : Math.round((p.price ?? 0) * 100),
      imageUrl: p.imageUrl,
      description: (p.description ?? "").slice(0, 240) || null,
      channel: slugify((p.category ?? "").split(/>|\/|,/)[0]?.trim() || "other"),
      stock: p.inventory,
    });
    if (products.length >= 120) break;
  }

  return NextResponse.json({ products });
}

function slugify(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "other";
}
