"use client";

import { useState } from "react";
import Link from "next/link";
import { SiteSettingsForm } from "@/components/site-editors";
import { createPageAction, deletePageAction } from "@/app/dashboard/l/[locationId]/website/actions";

type Page = { id: string; title: string; slug: string; isHome: boolean; blocks: unknown; seoTitle: string | null; seoDescription: string | null };
type Site = { id: string; logoText: string | null; tagline: string | null; primaryColor: string; published: boolean; customDomain: string | null };

export function WebsiteWorkspace({
  locationId, siteSlug, site, pages,
}: {
  locationId: string; siteSlug: string; site: Site; pages: Page[]; calendars: { id: string; name: string }[];
}) {
  const [showSettings, setShowSettings] = useState(false);
  const publicUrl = (p: Page) => (p.isHome ? `/sites/${siteSlug}` : `/sites/${siteSlug}/${p.slug}`);

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Link href={`/build/${locationId}`} className="btn-primary">✨ Open builder</Link>
        <form action={createPageAction} className="flex items-center gap-1">
          <input type="hidden" name="locationId" value={locationId} />
          <input name="title" placeholder="New page…" className="input h-9 w-40 py-1 text-sm" />
          <button className="btn-secondary text-sm">Add page</button>
        </form>
        <button type="button" onClick={() => setShowSettings((s) => !s)} className="btn-ghost ml-auto text-sm">
          {showSettings ? "Hide settings" : "Site settings"} ⚙
        </button>
      </div>

      {showSettings ? (
        <div className="mb-4">
          <SiteSettingsForm locationId={locationId} site={site} />
        </div>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {pages.map((p) => (
          <div key={p.id} className="card flex flex-col p-4">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-slate-900">{p.isHome ? "⌂ " : ""}{p.title}</span>
              <span className="text-xs text-slate-400">/{p.slug}</span>
            </div>
            <div className="mt-4 flex items-center gap-2">
              <Link href={`/build/${locationId}?page=${p.id}`} className="btn-primary flex-1 text-center text-sm">Edit</Link>
              <Link href={publicUrl(p)} target="_blank" className="btn-secondary text-sm">View ↗</Link>
              {!p.isHome ? (
                <form action={deletePageAction}>
                  <input type="hidden" name="locationId" value={locationId} />
                  <input type="hidden" name="pageId" value={p.id} />
                  <button className="rounded-lg px-2 py-1 text-xs text-slate-400 hover:text-red-600" title="Delete page">✕</button>
                </form>
              ) : null}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
