import { NextRequest, NextResponse } from "next/server";
import { promises as dns } from "dns";
import { prisma } from "@/lib/db";
import { requireLocationAccess } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const TARGET_IP = process.env.DOMAIN_TARGET_IP || "134.199.156.144";
const CNAME_TARGET = process.env.DOMAIN_CNAME_TARGET || "placidcrm.com";

async function lookupStatus(host: string) {
  let ips: string[] = [];
  let cname: string | null = null;
  try {
    ips = await dns.resolve4(host);
  } catch {
    /* no A record */
  }
  try {
    const c = await dns.resolveCname(host);
    cname = c[0] ?? null;
  } catch {
    /* no CNAME */
  }
  const pointing =
    ips.includes(TARGET_IP) || (cname ? cname.replace(/\.$/, "") === CNAME_TARGET : false);
  return { ips, cname, pointing };
}

// GET /api/domains/status?locationId=… — is the connected domain pointing at
// us, and is HTTPS answering yet?
export async function GET(req: NextRequest) {
  const locationId = req.nextUrl.searchParams.get("locationId") ?? "";
  if (!locationId) return NextResponse.json({ error: "Missing location." }, { status: 422 });
  try {
    await requireLocationAccess(locationId);
  } catch {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const site = await prisma.site.findUnique({
    where: { locationId },
    select: { customDomain: true, published: true },
  });
  if (!site?.customDomain) return NextResponse.json({ domain: null });

  const apex = await lookupStatus(site.customDomain);
  const www = await lookupStatus(`www.${site.customDomain}`);

  // HTTPS probe (also warms Caddy's on-demand certificate once DNS points).
  let httpsLive = false;
  if (apex.pointing || www.pointing) {
    try {
      const res = await fetch(`https://${site.customDomain}/`, {
        method: "HEAD",
        redirect: "manual",
        signal: AbortSignal.timeout(8000),
      });
      httpsLive = res.status > 0;
    } catch {
      httpsLive = false;
    }
  }

  return NextResponse.json({
    domain: site.customDomain,
    published: site.published,
    targetIp: TARGET_IP,
    cnameTarget: CNAME_TARGET,
    apex,
    www,
    httpsLive,
  });
}
