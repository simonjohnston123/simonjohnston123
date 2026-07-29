import { NextRequest, NextResponse } from "next/server";
import { requireLocationAccess } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { encryptJson } from "@/lib/crypto";
import { verifyState, exchangeCode, oauthConfig } from "@/lib/oauth-providers";
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
    return NextResponse.redirect(new URL("/dashboard", req.url));
  }

  const back = (q: string) =>
    NextResponse.redirect(new URL(`/dashboard/l/${locationId}/integrations?${q}`, req.url));

  await requireLocationAccess(locationId);

  if (providerError) return back(`error=${encodeURIComponent(providerError)}`);
  if (!code) return back("error=no_code");

  const tok = await exchangeCode(provider, code);
  if (!tok) return back("error=token_exchange_failed");

  const label = (await oauthConfig(provider)?.fetchLabel?.(tok.accessToken)) ?? null;

  await prisma.connection.upsert({
    where: { locationId_provider: { locationId, provider: provider as ConnectionProvider } },
    create: {
      locationId,
      provider: provider as ConnectionProvider,
      status: "CONNECTED",
      accountLabel: label,
      secretCipher: encryptJson({ accessToken: tok.accessToken }),
    },
    update: {
      status: "CONNECTED",
      accountLabel: label,
      secretCipher: encryptJson({ accessToken: tok.accessToken }),
    },
  });

  return back(`connected=${provider}`);
}
