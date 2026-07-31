import { NextRequest, NextResponse } from "next/server";
import { requireLocationAccess } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { encryptJson } from "@/lib/crypto";
import { verifyState, exchangeCode, oauthConfig, connectionMeta, appUrl } from "@/lib/oauth-providers";
import type { ConnectionProvider } from "@prisma/client";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest, { params }: { params: { provider: string } }) {
  const provider = params.provider.toUpperCase();
  const sp = req.nextUrl.searchParams;
  const code = sp.get("code");
  const state = sp.get("state");
  const providerError = sp.get("error_description") || sp.get("error");

  const parsed = state ? verifyState(state) : null;
  const locationId = parsed?.locationId ?? "";
  if (!parsed || parsed.provider !== provider || !locationId) {
    return NextResponse.redirect(`${appUrl()}/dashboard`);
  }

  // Redirect against the public origin, not req.url — behind the reverse proxy
  // req.url resolves to the internal container host (e.g. cbceac649ee5:3000).
  const back = (q: string) =>
    NextResponse.redirect(`${appUrl()}/dashboard/l/${locationId}/integrations?${q}`);

  await requireLocationAccess(locationId);

  if (providerError) return back(`error=${encodeURIComponent(providerError)}`);
  if (!code) return back("error=no_code");

  const tok = await exchangeCode(provider, code);
  if (!tok) return back("error=token_exchange_failed");

  const label = (await oauthConfig(provider)?.fetchLabel?.(tok.accessToken)) ?? null;

  // Store the whole token set so refresh-token flows (Google) keep working after
  // the short-lived access token expires.
  const secret = encryptJson({
    accessToken: tok.accessToken,
    refreshToken: tok.refreshToken,
    expiresAt: tok.expiresAt,
  });
  // Non-secret account ids we may need for API calls (Stripe acct, Square merchant).
  const meta = connectionMeta(provider, tok.raw) as object;

  await prisma.connection.upsert({
    where: { locationId_provider: { locationId, provider: provider as ConnectionProvider } },
    create: {
      locationId,
      provider: provider as ConnectionProvider,
      status: "CONNECTED",
      accountLabel: label,
      secretCipher: secret,
      meta,
    },
    update: {
      status: "CONNECTED",
      accountLabel: label,
      secretCipher: secret,
      meta,
    },
  });

  return back(`connected=${provider}`);
}
