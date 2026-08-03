import { NextRequest, NextResponse } from "next/server";
import { saveGoogleConnection, type GoogleServiceKey } from "@/lib/google";

export const dynamic = "force-dynamic";

// Google OAuth callback — stores the business's refresh token (encrypted) and
// which services they granted, then returns them to the Google settings page.
export async function GET(req: NextRequest) {
  const base = process.env.APP_URL || "https://placidcrm.com";
  const state = req.nextUrl.searchParams.get("state") ?? "";
  const [locationId, serviceList] = state.split("|");
  const code = req.nextUrl.searchParams.get("code");
  const back = `${base}/dashboard/l/${locationId}/google`;

  if (req.nextUrl.searchParams.get("error")) return NextResponse.redirect(`${back}?g=denied`);
  if (!code || !locationId) return NextResponse.redirect(`${back}?g=denied`);

  const services = (serviceList ?? "").split(",").filter(Boolean) as GoogleServiceKey[];
  const saved = await saveGoogleConnection(code, locationId, services).catch(() => null);
  return NextResponse.redirect(`${back}?g=${saved ? "connected" : "failed"}`);
}
