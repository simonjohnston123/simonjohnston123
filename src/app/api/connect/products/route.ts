import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { connectAuthed, CONNECT_MERCHANT_LOCATION_ID } from "@/lib/connect-api";

export const dynamic = "force-dynamic";

// GET /api/connect/products — catalogue feed for Placid Connect to import.
// Cursor is the id of the last product on the previous page (id-based, stable,
// efficient at 60k+ rows). limit default 100, max 200. updatedSince = ISO-8601.
export async function GET(req: NextRequest) {
  if (!(await connectAuthed(req.headers.get("authorization")))) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const sp = req.nextUrl.searchParams;
  const limit = Math.min(Math.max(Number(sp.get("limit")) || 100, 1), 200);

  const where: {
    locationId: string;
    id?: { gt: string };
    updatedAt?: { gte: Date };
  } = { locationId: CONNECT_MERCHANT_LOCATION_ID };

  const cursor = sp.get("cursor");
  if (cursor) {
    try {
      const decoded = JSON.parse(Buffer.from(cursor, "base64").toString("utf8"));
      if (decoded?.lastId) where.id = { gt: String(decoded.lastId) };
    } catch {
      return NextResponse.json({ error: "invalid cursor" }, { status: 400 });
    }
  }

  const updatedSince = sp.get("updatedSince");
  if (updatedSince) {
    const d = new Date(updatedSince);
    if (isNaN(d.getTime())) return NextResponse.json({ error: "invalid updatedSince" }, { status: 400 });
    where.updatedAt = { gte: d };
  }

  const rows = await prisma.product.findMany({
    where,
    orderBy: { id: "asc" },
    take: limit + 1,
    select: {
      id: true,
      name: true,
      description: true,
      priceCents: true,
      price: true,
      imageUrl: true,
      category: true,
      inventory: true,
      active: true,
      sku: true,
      updatedAt: true,
    },
  });

  const hasMore = rows.length > limit;
  const page = hasMore ? rows.slice(0, limit) : rows;

  const products = page.map((p) => {
    // images: absolute https only, first = cover
    const images = (p.imageUrl ? [p.imageUrl] : []).filter((u) => /^https:\/\//i.test(u));

    const priceCents =
      typeof p.priceCents === "number" && p.priceCents > 0
        ? p.priceCents
        : Math.round((p.price ?? 0) * 100);

    return {
      id: p.id,
      title: p.name,
      description: p.description ?? "",
      priceCents,
      currency: "AUD",
      images,
      category: p.category ?? "Other",
      stock: typeof p.inventory === "number" ? p.inventory : null,
      active: p.active ?? true,
      sku: p.sku ?? undefined,
      shipsAnywhere: true,
      updatedAt: p.updatedAt.toISOString(),
    };
  });

  const nextCursor = hasMore
    ? Buffer.from(JSON.stringify({ lastId: page[page.length - 1].id })).toString("base64")
    : null;

  return NextResponse.json({ products, nextCursor });
}
