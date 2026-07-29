import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { parseSignedRequest } from "@/lib/oauth-providers";

export const dynamic = "force-dynamic";

// Meta "Deauthorize" callback — fires when a user removes the Placid app from
// their Facebook/Instagram. We mark their connections disconnected.
export async function POST(req: NextRequest) {
  const appSecret = process.env.FACEBOOK_APP_SECRET;
  const form = await req.formData().catch(() => null);
  const signed = form?.get("signed_request");

  if (!appSecret || typeof signed !== "string") {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  const data = parseSignedRequest(signed, appSecret);
  const userId = data?.user_id ? String(data.user_id) : null;
  if (userId) {
    await prisma.connection
      .updateMany({
        where: {
          provider: { in: ["FACEBOOK", "INSTAGRAM"] },
          meta: { path: ["userId"], equals: userId },
        },
        data: { status: "DISCONNECTED" },
      })
      .catch(() => {});
  }

  return NextResponse.json({ ok: true });
}
