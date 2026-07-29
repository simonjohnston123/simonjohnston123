import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";

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

/**
 * Like getPublishedSite, but a logged-in owner/team member (or super-admin in
 * the same agency) can also preview an UNPUBLISHED draft — so the builder's
 * "Preview / Open site" link works before publishing. `draft` is true when the
 * viewer is seeing an unpublished site. Public visitors still get null (404).
 */
export async function getViewableSite(slug: string) {
  const location = await prisma.location.findUnique({
    where: { slug },
    include: { site: { include: { pages: { orderBy: { position: "asc" } } } } },
  });
  if (!location || !location.site) return null;
  if (location.site.published) return { location, site: location.site, draft: false };

  const user = await getCurrentUser();
  if (user) {
    const isMember = user.memberships.some((m) => m.locationId === location.id);
    const isAgencyAdmin = user.globalRole === "SUPER_ADMIN" && user.agencyId === location.agencyId;
    if (isMember || isAgencyAdmin) return { location, site: location.site, draft: true };
  }
  return null;
}
