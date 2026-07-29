"use client";

import { useState } from "react";
import { SiteSettingsForm } from "@/components/site-editors";
import { VisualBuilder } from "@/components/visual-builder";
import { createPageAction, deletePageAction } from "@/app/dashboard/l/[locationId]/website/actions";
import { cn } from "@/lib/utils";

type Page = {
  id: string;
  title: string;
  slug: string;
  isHome: boolean;
  blocks: unknown;
  seoTitle: string | null;
  seoDescription: string | null;
};

type Site = {
  id: string;
  logoText: string | null;
  tagline: string | null;
  primaryColor: string;
  published: boolean;
  customDomain: string | null;
};

export function WebsiteWorkspace({
  locationId,
  siteSlug,
  site,
  pages,
  calendars,
}: {
  locationId: string;
  siteSlug: string;
  site: Site;
  pages: Page[];
  calendars: { id: string; name: string }[];
}) {
  const [activeId, setActiveId] = useState(() => (pages.find((p) => p.isHome) ?? pages[0])?.id);
  const [showSettings, setShowSettings] = useState(false);

  const active = pages.find((p) => p.id === activeId) ?? pages[0];
  const publicUrl = (p: Page) => (p.isHome ? `/sites/${siteSlug}` : `/sites/${siteSlug}/${p.slug}`);

  return (
    <div>
      {/* Page tabs + actions */}
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div className="flex flex-wrap items-center gap-1 rounded-xl border border-slate-200 bg-white p-1">
          {pages.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => setActiveId(p.id)}
              className={cn(
                "rounded-lg px-3 py-1.5 text-sm",
                p.id === active?.id ? "bg-brand-gradient text-white" : "text-slate-600 hover:bg-slate-100",
              )}
            >
              {p.isHome ? "⌂ " : ""}{p.title}
            </button>
          ))}
        </div>

        <form action={createPageAction} className="flex items-center gap-1">
          <input type="hidden" name="locationId" value={locationId} />
          <input name="title" placeholder="New page…" className="input h-9 w-36 py-1 text-sm" />
          <button className="btn-secondary text-sm">Add</button>
        </form>

        <div className="ml-auto flex items-center gap-2">
          {active && !active.isHome ? (
            <form action={deletePageAction}>
              <input type="hidden" name="locationId" value={locationId} />
              <input type="hidden" name="pageId" value={active.id} />
              <button className="text-xs text-slate-400 hover:text-red-600">Delete page</button>
            </form>
          ) : null}
          <button type="button" onClick={() => setShowSettings((s) => !s)} className="btn-ghost text-sm">
            {showSettings ? "Hide" : "Site settings"} ⚙
          </button>
        </div>
      </div>

      {/* Collapsible site-wide settings (logo, brand colour, publish, domain) */}
      {showSettings ? (
        <div className="mb-4">
          <SiteSettingsForm locationId={locationId} site={site} />
        </div>
      ) : null}

      {/* The builder for the active page. key resets local state per page. */}
      {active ? (
        <VisualBuilder
          key={active.id}
          locationId={locationId}
          page={active}
          calendars={calendars}
          primaryColor={site.primaryColor}
          publicUrl={publicUrl(active)}
        />
      ) : null}
    </div>
  );
}
