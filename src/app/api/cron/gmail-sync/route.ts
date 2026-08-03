import { NextRequest, NextResponse } from "next/server";
import { syncAllGmail } from "@/lib/gmail";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

// Pulls Gmail into every connected business's inbox. Runs alongside the IMAP
// sync — same CRON_SECRET pattern:
//   */2 * * * * curl -fsS -H "x-cron-secret: $CRON_SECRET" \
//     https://placidcrm.com/api/cron/gmail-sync >/dev/null

function authorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  return req.headers.get("x-cron-secret") === secret || req.nextUrl.searchParams.get("secret") === secret;
}

async function handle(req: NextRequest) {
  if (!authorized(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const summary = await syncAllGmail();
  return NextResponse.json({ ok: true, ...summary });
}

export const GET = handle;
export const POST = handle;
