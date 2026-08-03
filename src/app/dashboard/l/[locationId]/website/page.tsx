import Link from "next/link";
import { requireLocationAccess } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { PageHeader, Badge } from "@/components/ui";
import { WebsiteWorkspace } from "@/components/website-workspace";
import { AiSiteEditor } from "@/components/ai-site-editor";
import { DomainManager } from "@/components/domain-manager";

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
            <Link href={`/build/${params.locationId}`} className="btn-primary text-sm">✨ New builder (beta)</Link>
          </div>
        }
      />

      <div className="mb-4 rounded-lg border border-brand-100 bg-brand-50 px-4 py-3 text-sm text-brand-800">
        Public address: <code className="font-mono">{publicUrl}</code>
        {site.customDomain ? <> · custom domain <code className="font-mono">{site.customDomain}</code></> : null}
      </div>

      {/* Website hub: everything a business builds, each with an AI assist. */}
      <div className="mb-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <Link href={`/dashboard/l/${params.locationId}/setup`} className="card border-brand-200 bg-brand-50/40 p-5 transition hover:border-brand-300">
          <div className="flex items-center gap-2">
            <span className="text-xl">✨</span>
            <h3 className="font-semibold text-slate-900">AI setup</h3>
            <Badge color="blue">Start here</Badge>
          </div>
          <p className="mt-2 text-sm text-slate-600">Answer a few questions and AI builds your services, booking questions and forms — live.</p>
        </Link>

        <Link href={`/dashboard/l/${params.locationId}/forms`} className="card p-5 transition hover:border-slate-300">
          <div className="flex items-center gap-2"><span className="text-xl">📝</span><h3 className="font-semibold text-slate-900">Forms &amp; Surveys</h3></div>
          <p className="mt-2 text-sm text-slate-600">Describe a form or survey and AI builds the fields. Share a link; responses land in Contacts.</p>
        </Link>

        <Link href={`/dashboard/l/${params.locationId}/calendar`} className="card p-5 transition hover:border-slate-300">
          <div className="flex items-center gap-2"><span className="text-xl">📅</span><h3 className="font-semibold text-slate-900">Calendars &amp; Services</h3></div>
          <p className="mt-2 text-sm text-slate-600">Your bookable services — prices, durations, availability and booking questions.</p>
        </Link>

        <Link href={`/dashboard/l/${params.locationId}/products`} className="card p-5 transition hover:border-slate-300">
          <div className="flex items-center gap-2"><span className="text-xl">🛍️</span><h3 className="font-semibold text-slate-900">Products</h3></div>
          <p className="mt-2 text-sm text-slate-600">Build your catalogue with AI-written descriptions, shown on your public shop page.</p>
        </Link>
      </div>

      {/* AI website editor — describe a change, watch it apply on the live preview. */}
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">AI editor</h2>
      <div className="mb-8">
        <AiSiteEditor
          locationId={params.locationId}
          previewUrl={site.customDomain ? `https://${site.customDomain}` : publicUrl}
          mode={site.customDomain ? "external" : "builder"}
        />
      </div>

      {/* Buy or connect a custom domain for this business. */}
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">Domain</h2>
      <div className="mb-8">
        <DomainManager locationId={params.locationId} />
      </div>

      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">Pages</h2>
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
