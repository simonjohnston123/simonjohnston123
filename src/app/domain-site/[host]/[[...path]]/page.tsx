import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { prisma } from "@/lib/db";
import { SiteChrome } from "@/components/site-chrome";
import { SiteBlocks, type Block } from "@/components/site-blocks";

export const dynamic = "force-dynamic";

// Serves a tenant site on its own connected domain. The middleware rewrites
// any non-placidcrm.com host here: yourbusiness.com.au/{page} →
// /domain-site/yourbusiness.com.au/{page}. Links render relative (basePath "")
// so the visitor never sees placidcrm.com.
async function getSiteByHost(rawHost: string) {
  const host = decodeURIComponent(rawHost).toLowerCase().replace(/:.*$/, "");
  const apex = host.startsWith("www.") ? host.slice(4) : host;
  const site = await prisma.site.findFirst({
    where: { OR: [{ customDomain: apex }, { customDomain: host }] },
    include: {
      location: true,
      pages: { orderBy: { position: "asc" } },
    },
  });
  if (!site || !site.published) return null;
  return site;
}

export async function generateMetadata({
  params,
}: {
  params: { host: string; path?: string[] };
}): Promise<Metadata> {
  const site = await getSiteByHost(params.host);
  if (!site) return { title: "Not found" };
  const slugPath = params.path?.[0] ?? "";
  const page =
    slugPath === ""
      ? site.pages.find((p) => p.isHome) ?? site.pages[0]
      : site.pages.find((p) => p.slug === slugPath);
  return {
    title:
      slugPath === ""
        ? page?.seoTitle || site.logoText || site.location.name
        : `${page?.title ?? ""} · ${site.logoText || site.location.name}`,
    description: page?.seoDescription || site.tagline || undefined,
  };
}

export default async function DomainSitePage({
  params,
}: {
  params: { host: string; path?: string[] };
}) {
  const site = await getSiteByHost(params.host);
  if (!site) notFound();
  const slugPath = params.path?.[0] ?? "";
  const page =
    slugPath === ""
      ? site.pages.find((p) => p.isHome) ?? site.pages[0]
      : site.pages.find((p) => p.slug === slugPath && !p.isHome);
  if (!page) notFound();

  const blocks = (page.blocks as unknown as Block[]) ?? [];

  return (
    <SiteChrome
      slug={site.location.slug}
      logoText={site.logoText || site.location.name}
      tagline={site.tagline}
      primaryColor={site.primaryColor}
      theme={(site as { theme?: string }).theme ?? "light"}
      basePath=""
      pages={site.pages.map((p) => ({ title: p.title, slug: p.slug, isHome: p.isHome }))}
    >
      <SiteBlocks
        blocks={blocks}
        slug={site.location.slug}
        primaryColor={site.primaryColor}
        locationId={site.location.id}
      />
    </SiteChrome>
  );
}
