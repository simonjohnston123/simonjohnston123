import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getPublishedSite } from "@/lib/site";
import { SiteChrome } from "@/components/site-chrome";
import { SiteBlocks, type Block } from "@/components/site-blocks";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: { slug: string } }): Promise<Metadata> {
  const data = await getPublishedSite(params.slug);
  if (!data) return { title: "Not found" };
  return {
    title: data.site.logoText || data.location.name,
    description: data.site.tagline || `${data.location.name} — official website.`,
  };
}

export default async function SiteHome({ params }: { params: { slug: string } }) {
  const data = await getPublishedSite(params.slug);
  if (!data) notFound();

  const { site, location } = data;
  const home = site.pages.find((p) => p.isHome) ?? site.pages[0];
  const blocks = (home?.blocks as unknown as Block[]) ?? [];

  return (
    <SiteChrome
      slug={location.slug}
      logoText={site.logoText || location.name}
      tagline={site.tagline}
      primaryColor={site.primaryColor}
      pages={site.pages.map((p) => ({ title: p.title, slug: p.slug, isHome: p.isHome }))}
    >
      <SiteBlocks blocks={blocks} slug={location.slug} primaryColor={site.primaryColor} />
    </SiteChrome>
  );
}
