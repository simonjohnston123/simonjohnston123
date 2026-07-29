import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { prisma } from "@/lib/db";
import { parseSignedRequest, appUrl } from "@/lib/oauth-providers";

export const dynamic = "force-dynamic";

// Meta "Data Deletion Request" callback. Facebook POSTs a signed_request when a
// user asks to delete their data. We delete anything tied to that Meta user and
// return { url, confirmation_code } so Facebook can show the user a status link.
export async function POST(req: NextRequest) {
  const appSecret = process.env.FACEBOOK_APP_SECRET;
  const form = await req.formData().catch(() => null);
  const signed = form?.get("signed_request");

  if (!appSecret || typeof signed !== "string") {
    return NextResponse.json({ error: "invalid request" }, { status: 400 });
  }

  const data = parseSignedRequest(signed, appSecret);
  const userId = data?.user_id ? String(data.user_id) : null;
  if (!userId) return NextResponse.json({ error: "bad signature" }, { status: 400 });

  // Best-effort: remove any Meta connections stored for this user.
  await prisma.connection
    .deleteMany({
      where: {
        provider: { in: ["FACEBOOK", "INSTAGRAM"] },
        meta: { path: ["userId"], equals: userId },
      },
    })
    .catch(() => {});

  const code = crypto.randomBytes(8).toString("hex");
  return NextResponse.json({
    url: `${appUrl()}/data-deletion?code=${code}`,
    confirmation_code: code,
  });
}
