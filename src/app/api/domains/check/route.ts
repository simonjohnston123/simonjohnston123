import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

// Caddy on_demand_tls "ask" endpoint: 200 = issue a certificate for this
// domain, anything else = refuse. A domain qualifies once a site has it
// connected (apex or www form). Internal-only in practice (Caddy calls it),
// but harmless if probed — it leaks nothing beyond yes/no.
export async function GET(req: NextRequest) {
  const domain = (req.nextUrl.searchParams.get("domain") ?? "").toLowerCase().trim();
  if (!domain || domain.length > 253) return new NextResponse(null, { status: 400 });
  const apex = domain.startsWith("www.") ? domain.slice(4) : domain;
  const site = await prisma.site.findFirst({
    where: { OR: [{ customDomain: apex }, { customDomain: domain }] },
    select: { id: true },
  });
  return new NextResponse(null, { status: site ? 200 : 404 });
}
