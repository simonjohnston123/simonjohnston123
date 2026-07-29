import Link from "next/link";
import { requireLocationAccess } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { PageHeader, Badge } from "@/components/ui";
import { WebsiteWorkspace } from "@/components/website-workspace";

export const dynamic = "force-dynamic";

export default async function WebsitePage({ params }: { params: { locationId: string } }) {
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

  if (!site) {
    return (
      <div>
        <PageHeader title="Website" />
        <p className="text-sm text-slate-500">No website is configured for this business.</p>
      </div>
    );
  }

  const publicUrl = `/sites/${location.slug}`;

  return (
    <div>
      <PageHeader
        title="Website builder"
        subtitle={`Drag-and-drop marketing site for ${location.name}`}
        action={
          <div className="flex items-center gap-2">
            {site.published ? <Badge color="green">Published</Badge> : <Badge color="amber">Draft</Badge>}
            <Link href={publicUrl} target="_blank" className="btn-secondary text-sm">Open site ↗</Link>
          </div>
        }
      />

      <div className="mb-4 rounded-lg border border-brand-100 bg-brand-50 px-4 py-3 text-sm text-brand-800">
        Public address: <code className="font-mono">{publicUrl}</code>
        {site.customDomain ? <> · custom domain <code className="font-mono">{site.customDomain}</code></> : null}
      </div>

      <WebsiteWorkspace
        locationId={params.locationId}
        siteSlug={location.slug}
        site={site}
        pages={site.pages}
        calendars={calendars}
      />
    </div>
  );
}
