import { NextRequest, NextResponse } from "next/server";
import { runDueSocialPosts } from "@/lib/social";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

// Social poster cron. The droplet hits this every minute (same pattern as
// email-sync) to publish scheduled posts that have come due:
//
//   * * * * * curl -fsS -H "x-cron-secret: $CRON_SECRET" \
//     https://placidcrm.com/api/cron/social-publish >/dev/null

function authorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  return req.headers.get("x-cron-secret") === secret || req.nextUrl.searchParams.get("secret") === secret;
}

async function handle(req: NextRequest) {
  if (!authorized(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const summary = await runDueSocialPosts();
  return NextResponse.json({ ok: true, ...summary });
}

export const GET = handle;
export const POST = handle;
