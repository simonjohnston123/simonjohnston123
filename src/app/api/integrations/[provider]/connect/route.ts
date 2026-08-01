import { NextRequest, NextResponse } from "next/server";
import { requireLocationAccess } from "@/lib/auth";
import { isConfiguredAsync, buildAuthUrl, signState, appUrl } from "@/lib/oauth-providers";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest, { params }: { params: { provider: string } }) {
  const provider = params.provider.toUpperCase();
  const locationId = req.nextUrl.searchParams.get("locationId") ?? "";
  // Build redirects against the public origin, not req.url — behind the reverse
  // proxy req.url resolves to the internal container host (e.g. cbceac649ee5:3000).
  if (!locationId) return NextResponse.redirect(`${appUrl()}/dashboard`);

  // Ensures the caller is logged in and owns this sub-account.
  await requireLocationAccess(locationId);

  const back = (q: string) =>
    NextResponse.redirect(`${appUrl()}/dashboard/l/${locationId}/integrations?${q}`);

  if (!(await isConfiguredAsync(provider))) return back("error=not_configured");

  const state = signState({ locationId, provider, t: String(Date.now()) });
  const url = await buildAuthUrl(provider, state);
  if (!url) return back("error=unknown_provider");

  return NextResponse.redirect(url);
}
