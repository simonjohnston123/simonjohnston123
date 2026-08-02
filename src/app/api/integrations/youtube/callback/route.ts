import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { encryptJson } from "@/lib/crypto";

export const dynamic = "force-dynamic";

// Google OAuth callback: exchange the code, look up the channel name, store the
// refresh token (encrypted) as the location's YOUTUBE connection.
export async function GET(req: NextRequest) {
  const base = process.env.APP_URL || "https://placidcrm.com";
  const locationId = req.nextUrl.searchParams.get("state") ?? "";
  const code = req.nextUrl.searchParams.get("code");
  const back = `${base}/dashboard/l/${locationId}/social`;
  if (!code || !locationId) return NextResponse.redirect(`${back}?yt=denied`);

  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: process.env.GOOGLE_CLIENT_ID || "",
      client_secret: process.env.GOOGLE_CLIENT_SECRET || "",
      redirect_uri: `${base}/api/integrations/youtube/callback`,
      grant_type: "authorization_code",
    }),
  });
  const tok = (await tokenRes.json().catch(() => ({}))) as { access_token?: string; refresh_token?: string };
  if (!tok.refresh_token) return NextResponse.redirect(`${back}?yt=failed`);

  let label = "YouTube channel";
  try {
    const ch = await fetch("https://www.googleapis.com/youtube/v3/channels?part=snippet&mine=true", {
      headers: { authorization: `Bearer ${tok.access_token}` },
    });
    const j = (await ch.json()) as { items?: { snippet?: { title?: string } }[] };
    label = j.items?.[0]?.snippet?.title || label;
  } catch { /* label is cosmetic */ }

  await prisma.connection.upsert({
    where: { locationId_provider: { locationId, provider: "YOUTUBE" } },
    create: { locationId, provider: "YOUTUBE", status: "CONNECTED", accountLabel: label, secretCipher: encryptJson({ refreshToken: tok.refresh_token }) },
    update: { status: "CONNECTED", accountLabel: label, secretCipher: encryptJson({ refreshToken: tok.refresh_token }) },
  });
  return NextResponse.redirect(`${back}?yt=connected`);
}
