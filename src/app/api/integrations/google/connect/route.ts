import { NextRequest, NextResponse } from "next/server";
import { requireLocationAccess } from "@/lib/auth";
import { googleAuthUrl, googleReady, GOOGLE_SERVICES, type GoogleServiceKey } from "@/lib/google";

export const dynamic = "force-dynamic";

// Start the Google connect flow for a business. ?services=gmail,calendar,…
// picks which scopes to request; omit for everything the CRM supports.
export async function GET(req: NextRequest) {
  const locationId = req.nextUrl.searchParams.get("locationId") ?? "";
  try { await requireLocationAccess(locationId); } catch { return NextResponse.json({ error: "unauthorized" }, { status: 401 }); }
  if (!googleReady()) return NextResponse.json({ error: "Google app not configured on the platform." }, { status: 400 });

  const all = GOOGLE_SERVICES.map((s) => s.key);
  const requested = (req.nextUrl.searchParams.get("services") ?? "")
    .split(",").map((s) => s.trim()).filter((s): s is GoogleServiceKey => (all as string[]).includes(s));
  const services = requested.length ? requested : all;

  return NextResponse.redirect(googleAuthUrl(locationId, services));
}
