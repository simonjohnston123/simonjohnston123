import { NextRequest, NextResponse } from "next/server";
import { getCatalogueItem } from "@/lib/commerce";
import { resolveStorefront, CORS } from "@/lib/commerce-location";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const to = (req.nextUrl.searchParams.get("to") || "").trim();
  if (!/^[A-Za-z]{2}$/.test(to)) {
    return NextResponse.json({ error: "A destination is required (?to=AU)." }, { status: 400, headers: CORS });
  }

  const store = await resolveStorefront(req.nextUrl.searchParams.get("store"));
  if (!store) return NextResponse.json({ error: "Storefront not found." }, { status: 404, headers: CORS });

  const item = await getCatalogueItem(store.id, params.id, to);
  if (!item) return NextResponse.json({ error: "Product not found." }, { status: 404, headers: CORS });

  // Live postage for the real destination, rather than a guess.
  const { quoteFreight } = await import("@/lib/freight");
  const freight = await quoteFreight({ locationId: store.id, productId: item.id, countryCode: to });

  return NextResponse.json(
    {
      store: store.slug,
      destination: to.toUpperCase(),
      product: item,
      postage: {
        cents: freight.cents,
        exact: freight.exact,
        note: freight.note,
        service: freight.service ?? null,
      },
    },
    { headers: CORS },
  );
}
