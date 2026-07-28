"use client";

import { useState } from "react";
import { useFormState } from "react-dom";
import {
  updateSiteAction,
  updatePageAction,
} from "@/app/dashboard/l/[locationId]/website/actions";
import { SubmitButton } from "@/components/submit-button";

type Site = {
  id: string;
  logoText: string | null;
  tagline: string | null;
  primaryColor: string;
  published: boolean;
  customDomain: string | null;
};

export function SiteSettingsForm({ locationId, site }: { locationId: string; site: Site }) {
  const [state, formAction] = useFormState(updateSiteAction, { error: "", ok: false } as { error: string; ok?: boolean });
  return (
    <form action={formAction} className="card space-y-4 p-5">
      <input type="hidden" name="locationId" value={locationId} />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="logoText">Logo text</label>
          <input id="logoText" name="logoText" defaultValue={site.logoText ?? ""} className="input" />
        </div>
        <div>
          <label className="label" htmlFor="primaryColor">Brand colour</label>
          <input id="primaryColor" name="primaryColor" type="color" defaultValue={site.primaryColor} className="input h-10 p-1" />
        </div>
      </div>
      <div>
        <label className="label" htmlFor="tagline">Tagline</label>
        <input id="tagline" name="tagline" defaultValue={site.tagline ?? ""} className="input" />
      </div>
      <div>
        <label className="label" htmlFor="customDomain">Custom domain (optional)</label>
        <input id="customDomain" name="customDomain" defaultValue={site.customDomain ?? ""} className="input" placeholder="storage.placidcrm.com" />
      </div>
      <label className="flex items-center gap-2 text-sm text-slate-700">
        <input type="checkbox" name="published" defaultChecked={site.published} className="h-4 w-4" />
        Site is published (publicly visible)
      </label>
      <div className="flex items-center gap-3">
        <SubmitButton className="btn-primary">Save site</SubmitButton>
        {state?.ok ? <span className="text-sm text-green-600">Saved.</span> : null}
        {state?.error ? <span className="text-sm text-red-600">{state.error}</span> : null}
      </div>
    </form>
  );
}

type Page = { id: string; title: string; slug: string; isHome: boolean; blocks: unknown };

export function PageEditor({ locationId, page }: { locationId: string; page: Page }) {
  const [state, formAction] = useFormState(updatePageAction, { error: "", ok: false } as { error: string; ok?: boolean });
  const [json, setJson] = useState(() => JSON.stringify(page.blocks ?? [], null, 2));

  return (
    <form action={formAction} className="card space-y-4 p-5">
      <input type="hidden" name="locationId" value={locationId} />
      <input type="hidden" name="pageId" value={page.id} />
      <div className="flex items-center justify-between">
        <div className="text-sm font-semibold text-slate-800">
          /{page.slug || ""} {page.isHome ? <span className="text-xs text-slate-400">(home)</span> : null}
        </div>
      </div>
      <div>
        <label className="label" htmlFor={`title-${page.id}`}>Page title</label>
        <input id={`title-${page.id}`} name="title" defaultValue={page.title} className="input" />
      </div>
      <div>
        <label className="label" htmlFor={`blocks-${page.id}`}>Content blocks (JSON)</label>
        <textarea
          id={`blocks-${page.id}`}
          name="blocks"
          value={json}
          onChange={(e) => setJson(e.target.value)}
          rows={12}
          spellCheck={false}
          className="input font-mono text-xs"
        />
        <p className="mt-1 text-xs text-slate-400">
          Block types: <code>hero</code> (heading, subheading, ctaLabel, ctaHref),{" "}
          <code>text</code> (heading, body), <code>contact</code> (heading, body).
        </p>
      </div>
      <div className="flex items-center gap-3">
        <SubmitButton className="btn-primary">Save page</SubmitButton>
        {state?.ok ? <span className="text-sm text-green-600">Saved.</span> : null}
        {state?.error ? <span className="text-sm text-red-600">{state.error}</span> : null}
      </div>
    </form>
  );
}
