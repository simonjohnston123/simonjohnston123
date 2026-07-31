import { NextRequest, NextResponse } from "next/server";
import { requireLocationAccess } from "@/lib/auth";
import { isConfiguredAsync, buildAuthUrl, signState } from "@/lib/oauth-providers";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest, { params }: { params: { provider: string } }) {
  const provider = params.provider.toUpperCase();
  const locationId = req.nextUrl.searchParams.get("locationId") ?? "";
  if (!locationId) return NextResponse.redirect(new URL("/dashboard", req.url));

  // Ensures the caller is logged in and owns this sub-account.
  await requireLocationAccess(locationId);

  const back = (q: string) =>
    NextResponse.redirect(new URL(`/dashboard/l/${locationId}/integrations?${q}`, req.url));

  if (!(await isConfiguredAsync(provider))) return back("error=not_configured");

  const state = signState({ locationId, provider, t: String(Date.now()) });
  const url = buildAuthUrl(provider, state);
  if (!url) return back("error=unknown_provider");

  return NextResponse.redirect(url);
}
