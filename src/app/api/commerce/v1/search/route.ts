import { NextRequest, NextResponse } from "next/server";
import { searchCatalogue } from "@/lib/commerce";
import { resolveStorefront, CORS } from "@/lib/commerce-location";

export const dynamic = "force-dynamic";

const cents = (v: string | null) => {
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? Math.round(n) : undefined;
};

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const to = (sp.get("to") || "").trim();

  // Refusing rather than defaulting: a silent default destination would return
  // products the customer can't receive, which is the one thing this API must
  // never do.
  if (!/^[A-Za-z]{2}$/.test(to)) {
    return NextResponse.json(
      { error: "A destination is required.", hint: "Pass ?to=AU (ISO-3166-1 alpha-2). See /api/commerce/v1/destinations." },
      { status: 400, headers: CORS },
    );
  }

  const store = await resolveStorefront(sp.get("store"));
  if (!store) return NextResponse.json({ error: "Storefront not found." }, { status: 404, headers: CORS });

  const result = await searchCatalogue({
    locationId: store.id,
    destination: to,
    text: sp.get("q") || undefined,
    minCents: cents(sp.get("min")),
    maxCents: cents(sp.get("max")),
    inStockOnly: sp.get("inStock") === "true",
    freeDeliveryOnly: sp.get("freeDelivery") === "true",
    page: Number(sp.get("page")) || 1,
    pageSize: Number(sp.get("pageSize")) || 24,
  });

  return NextResponse.json({ store: store.slug, ...result }, { headers: CORS });
}
