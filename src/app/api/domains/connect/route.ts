import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireLocationAccess } from "@/lib/auth";

export const dynamic = "force-dynamic";

const DOMAIN_RE = /^(?!-)[a-z0-9-]{1,63}(?<!-)(\.(?!-)[a-z0-9-]{1,63}(?<!-))+$/;

/** Normalise whatever the owner pastes to a bare apex-ish hostname. */
function normalise(raw: string): string | null {
  let d = raw.trim().toLowerCase();
  d = d.replace(/^https?:\/\//, "").replace(/\/.*$/, "").replace(/:.*$/, "");
  if (d.startsWith("www.")) d = d.slice(4);
  if (!DOMAIN_RE.test(d) || d.length > 253) return null;
  // Never allow taking over our own hosts.
  if (d === "placidcrm.com" || d.endsWith(".placidcrm.com")) return null;
  return d;
}

// POST /api/domains/connect { locationId, domain }  — connect a domain
// POST /api/domains/connect { locationId, domain: null } — disconnect
export async function POST(req: NextRequest) {
  let body: { locationId?: string; domain?: string | null };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Malformed request." }, { status: 400 });
  }
  const locationId = String(body.locationId ?? "");
  if (!locationId) return NextResponse.json({ error: "Missing location." }, { status: 422 });
  try {
    await requireLocationAccess(locationId);
  } catch {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const site = await prisma.site.findUnique({ where: { locationId }, select: { id: true } });
  if (!site) return NextResponse.json({ error: "No website configured." }, { status: 404 });

  if (body.domain === null || body.domain === "") {
    await prisma.site.update({ where: { id: site.id }, data: { customDomain: null } });
    return NextResponse.json({ ok: true, domain: null });
  }

  const domain = normalise(String(body.domain ?? ""));
  if (!domain) {
    return NextResponse.json(
      { error: "That doesn't look like a domain — enter it like yourbusiness.com.au" },
      { status: 422 }
    );
  }
  const taken = await prisma.site.findFirst({
    where: { customDomain: domain, NOT: { id: site.id } },
    select: { id: true },
  });
  if (taken) {
    return NextResponse.json({ error: "That domain is already connected to another site." }, { status: 409 });
  }
  await prisma.site.update({ where: { id: site.id }, data: { customDomain: domain } });
  return NextResponse.json({ ok: true, domain });
}
