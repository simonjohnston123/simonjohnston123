import { requireLocationAccess } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { BuilderShell } from "@/components/builder/builder-shell";

export const dynamic = "force-dynamic";

export default async function BuildPage({
  params,
  searchParams,
}: {
  params: { locationId: string };
  searchParams: { page?: string };
}) {
  const { location } = await requireLocationAccess(params.locationId);

  const site = await prisma.site.findUnique({
    where: { locationId: params.locationId },
    include: { pages: { orderBy: { position: "asc" } } },
  });
  const calendars = await prisma.calendar.findMany({
    where: { locationId: params.locationId },
    select: { id: true, name: true },
    orderBy: { createdAt: "asc" },
  });

  if (!site || site.pages.length === 0) {
    return (
      <div className="pb-app">
        <div style={{ gridArea: "canvas", display: "grid", placeItems: "center", color: "#A3ADBC" }}>
          No website is set up for this business yet.
        </div>
      </div>
    );
  }

  const page = site.pages.find((p) => p.id === searchParams.page) ?? site.pages.find((p) => p.isHome) ?? site.pages[0];

  return (
    <BuilderShell
      locationId={location.id}
      locationName={location.name}
      slug={location.slug}
      primaryColor={site.primaryColor}
      published={site.published}
      calendars={calendars}
      pages={site.pages.map((p) => ({ id: p.id, title: p.title, isHome: p.isHome }))}
      page={{
        id: page.id,
        title: page.title,
        slug: page.slug,
        isHome: page.isHome,
        blocks: page.blocks,
        seoTitle: page.seoTitle,
        seoDescription: page.seoDescription,
      }}
    />
  );
}
