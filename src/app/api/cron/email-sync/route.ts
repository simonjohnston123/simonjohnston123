import { NextRequest, NextResponse } from "next/server";
import { syncAllEmail } from "@/lib/email-imap";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

// ---------------------------------------------------------------------------
// Email receive cron. A scheduler (droplet cron / systemd timer) hits this
// every minute to pull every connected mailbox into its location's Inbox.
//
//   * * * * * curl -fsS -H "x-cron-secret: $CRON_SECRET" \
//     https://placidcrm.com/api/cron/email-sync >/dev/null
//
// Protected by CRON_SECRET (header x-cron-secret or ?secret=). If CRON_SECRET
// is unset the route refuses to run, so it can't be triggered anonymously.
// ---------------------------------------------------------------------------

function authorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const header = req.headers.get("x-cron-secret");
  const query = req.nextUrl.searchParams.get("secret");
  return header === secret || query === secret;
}

async function handle(req: NextRequest) {
  if (!authorized(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const results = await syncAllEmail();
  const imported = results.reduce((n, r) => n + r.result.imported, 0);
  const mailboxes = results.length;
  const errors = results.filter((r) => !r.result.ok).map((r) => ({ locationId: r.locationId, reason: r.result.reason }));
  return NextResponse.json({ ok: true, mailboxes, imported, errors, results });
}

export async function GET(req: NextRequest) {
  return handle(req);
}
export async function POST(req: NextRequest) {
  return handle(req);
}
