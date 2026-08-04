import { NextRequest, NextResponse } from "next/server";
import { availableDestinations } from "@/lib/commerce";
import { resolveStorefront, CORS } from "@/lib/commerce-location";

export const dynamic = "force-dynamic";

// Where we genuinely hold stock. An agent starts here so it never asks for a
// country we can't serve.
export async function GET(req: NextRequest) {
  const store = await resolveStorefront(req.nextUrl.searchParams.get("store"));
  if (!store) return NextResponse.json({ error: "Storefront not found." }, { status: 404, headers: CORS });

  const destinations = await availableDestinations(store.id);
  return NextResponse.json({ store: store.slug, destinations }, { headers: CORS });
}
