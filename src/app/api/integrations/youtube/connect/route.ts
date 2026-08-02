import { NextRequest, NextResponse } from "next/server";
import { requireLocationAccess } from "@/lib/auth";

export const dynamic = "force-dynamic";

// Kick off Google OAuth for YouTube uploads. Requires GOOGLE_CLIENT_ID /
// GOOGLE_CLIENT_SECRET (a Google Cloud OAuth client with the YouTube Data API
// enabled and redirect URI <APP_URL>/api/integrations/youtube/callback).
export async function GET(req: NextRequest) {
  const locationId = req.nextUrl.searchParams.get("locationId") ?? "";
  try { await requireLocationAccess(locationId); } catch { return NextResponse.json({ error: "unauthorized" }, { status: 401 }); }

  const clientId = process.env.GOOGLE_CLIENT_ID;
  if (!clientId) return NextResponse.json({ error: "Google app credentials not set (GOOGLE_CLIENT_ID/SECRET)." }, { status: 400 });

  const base = process.env.APP_URL || "https://placidcrm.com";
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: `${base}/api/integrations/youtube/callback`,
    response_type: "code",
    access_type: "offline",
    prompt: "consent", // always mint a refresh token
    scope: "https://www.googleapis.com/auth/youtube.upload https://www.googleapis.com/auth/youtube.readonly",
    state: locationId,
  });
  return NextResponse.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params}`);
}
