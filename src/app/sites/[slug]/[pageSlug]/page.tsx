import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getViewableSite } from "@/lib/site";
import { SiteChrome } from "@/components/site-chrome";
import { SiteBlocks, type Block } from "@/components/site-blocks";
import { DraftBanner } from "@/components/draft-banner";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: { slug: string; pageSlug: string };
}): Promise<Metadata> {
  const data = await getViewableSite(params.slug);
  const page = data?.site.pages.find((p) => p.slug === params.pageSlug);
  if (!data || !page) return { title: "Not found" };
  return { title: `${page.title} · ${data.site.logoText || data.location.name}` };
}

export default async function SitePageView({
  params,
}: {
  params: { slug: string; pageSlug: string };
}) {
  const data = await getViewableSite(params.slug);
  if (!data) notFound();

  const { site, location } = data;
  const page = site.pages.find((p) => p.slug === params.pageSlug && !p.isHome);
  if (!page) notFound();

  const blocks = (page.blocks as unknown as Block[]) ?? [];

  return (
    <>
      {data.draft ? <DraftBanner locationId={location.id} /> : null}
      <SiteChrome
        slug={location.slug}
        logoText={site.logoText || location.name}
        tagline={site.tagline}
        primaryColor={site.primaryColor}
        pages={site.pages.map((p) => ({ title: p.title, slug: p.slug, isHome: p.isHome }))}
      >
        <SiteBlocks blocks={blocks} slug={location.slug} primaryColor={site.primaryColor} />
      </SiteChrome>
    </>
  );
}
