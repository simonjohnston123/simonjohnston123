import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";

export const dynamic = "force-dynamic";

// ---------------------------------------------------------------------------
// eBay Marketplace Account Deletion / Closure notification endpoint (required
// for production apps). Configure in the eBay dev portal → Alerts &
// Notifications with:
//   Endpoint URL:        https://placidcrm.com/api/ebay/deletion
//   Verification token:  EBAY_VERIFICATION_TOKEN (32-80 chars)
//
// - GET  ?challenge_code=… → return SHA-256(challengeCode + token + endpointUrl)
//   so eBay can verify we own the endpoint.
// - POST notification      → acknowledge with 200 (and scrub the buyer if we
//   ever stored their data).
// ---------------------------------------------------------------------------

const ENDPOINT_URL = "https://placidcrm.com/api/ebay/deletion";

export async function GET(req: NextRequest) {
  const challengeCode = req.nextUrl.searchParams.get("challenge_code");
  const token = process.env.EBAY_VERIFICATION_TOKEN || "";
  if (!challengeCode) return NextResponse.json({ error: "missing challenge_code" }, { status: 400 });
  if (!token) return NextResponse.json({ error: "verification token not configured" }, { status: 503 });

  const hash = crypto.createHash("sha256");
  hash.update(challengeCode);
  hash.update(token);
  hash.update(ENDPOINT_URL);
  const challengeResponse = hash.digest("hex");

  return NextResponse.json({ challengeResponse }, { status: 200, headers: { "content-type": "application/json" } });
}

export async function POST(req: NextRequest) {
  // eBay expects a fast 2xx acknowledgement. We don't retain buyer PII beyond
  // masked order data, so there's nothing to purge — just acknowledge.
  try {
    await req.json().catch(() => null);
  } catch {
    /* ignore body parse errors */
  }
  return NextResponse.json({ ok: true }, { status: 200 });
}
