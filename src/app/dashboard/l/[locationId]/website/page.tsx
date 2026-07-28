import Link from "next/link";
import { requireLocationAccess } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { PageHeader, Badge } from "@/components/ui";
import { SiteSettingsForm, PageEditor } from "@/components/site-editors";
import { createPageAction, deletePageAction } from "./actions";

export const dynamic = "force-dynamic";

export default async function WebsitePage({ params }: { params: { locationId: string } }) {
  const { location } = await requireLocationAccess(params.locationId);

  const site = await prisma.site.findUnique({
    where: { locationId: params.locationId },
    include: { pages: { orderBy: { position: "asc" } } },
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
        title="Website"
        subtitle={`Public marketing site for ${location.name}`}
        action={
          <div className="flex items-center gap-2">
            {site.published ? <Badge color="green">Published</Badge> : <Badge color="amber">Draft</Badge>}
            <Link href={publicUrl} target="_blank" className="btn-secondary text-sm">
              Preview ↗
            </Link>
          </div>
        }
      />

      <div className="mb-4 rounded-lg border border-brand-100 bg-brand-50 px-4 py-3 text-sm text-brand-800">
        Public address: <code className="font-mono">{publicUrl}</code>
        {site.customDomain ? <> · custom domain <code className="font-mono">{site.customDomain}</code></> : null}
      </div>

      <div className="grid gap-6 lg:grid-cols-[360px_1fr]">
        <div>
          <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-500">Site settings</h2>
          <SiteSettingsForm locationId={params.locationId} site={site} />
        </div>

        <div>
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Pages</h2>
            <form action={createPageAction} className="flex gap-2">
              <input type="hidden" name="locationId" value={params.locationId} />
              <input name="title" placeholder="New page title" className="input h-9 py-1 text-sm" />
              <button className="btn-secondary text-sm">Add page</button>
            </form>
          </div>
          <div className="space-y-4">
            {site.pages.map((page) => (
              <div key={page.id}>
                <PageEditor locationId={params.locationId} page={page} />
                {!page.isHome ? (
                  <form action={deletePageAction} className="mt-1 text-right">
                    <input type="hidden" name="locationId" value={params.locationId} />
                    <input type="hidden" name="pageId" value={page.id} />
                    <button className="text-xs text-slate-400 hover:text-red-600">Delete page</button>
                  </form>
                ) : null}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
