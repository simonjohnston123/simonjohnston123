import { prisma } from "@/lib/db";

export async function getPublishedSite(slug: string) {
  const location = await prisma.location.findUnique({
    where: { slug },
    include: {
      site: { include: { pages: { orderBy: { position: "asc" } } } },
    },
  });
  if (!location || !location.site || !location.site.published) return null;
  return { location, site: location.site };
}
