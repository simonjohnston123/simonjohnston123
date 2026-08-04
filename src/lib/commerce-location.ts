import "server-only";
import { prisma } from "@/lib/db";

// Which storefront a public API call belongs to. Defaults to Placid Deals so
// agents can call the API without knowing internal ids.
export async function resolveStorefront(slug?: string | null): Promise<{ id: string; name: string; slug: string } | null> {
  if (slug) {
    const bySlug = await prisma.location.findUnique({ where: { slug }, select: { id: true, name: true, slug: true } });
    if (bySlug) return bySlug;
  }
  return prisma.location.findFirst({
    where: { name: { contains: "Placid Deals", mode: "insensitive" } },
    select: { id: true, name: true, slug: true },
  });
}

export const CORS = { "access-control-allow-origin": "*" } as const;
