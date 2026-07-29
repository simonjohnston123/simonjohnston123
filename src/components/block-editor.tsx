"use client";

import { useState } from "react";
import { useFormState } from "react-dom";
import { updatePageAction } from "@/app/dashboard/l/[locationId]/website/actions";
import { SubmitButton } from "@/components/submit-button";
import { BLOCK_DEFS, blockDef, type BlockField } from "@/lib/site-blocks-catalog";

type AnyBlock = { type: string } & Record<string, unknown>;

export function BlockEditor({
  locationId,
  page,
  calendars,
}: {
  locationId: string;
  page: {
    id: string;
    title: string;
    slug: string;
    isHome: boolean;
    blocks: unknown;
    seoTitle: string | null;
    seoDescription: string | null;
  };
  calendars: { id: string; name: string }[];
}) {
  const [state, formAction] = useFormState(updatePageAction, { error: "", ok: false } as { error: string; ok?: boolean });
  const [blocks, setBlocks] = useState<AnyBlock[]>(() =>
    Array.isArray(page.blocks) ? (page.blocks as AnyBlock[]) : [],
  );
  const [adding, setAdding] = useState(false);

  const update = (i: number, patch: Record<string, unknown>) =>
    setBlocks((b) => b.map((blk, idx) => (idx === i ? { ...blk, ...patch } : blk)));
  const move = (i: number, dir: -1 | 1) =>
    setBlocks((b) => {
      const j = i + dir;
      if (j < 0 || j >= b.length) return b;
      const copy = [...b];
      [copy[i], copy[j]] = [copy[j], copy[i]];
      return copy;
    });
  const remove = (i: number) => setBlocks((b) => b.filter((_, idx) => idx !== i));
  const add = (type: string) => {
    const def = blockDef(type);
    if (!def) return;
    setBlocks((b) => [...b, { type, ...structuredClone(def.default) }]);
    setAdding(false);
  };

  return (
    <form action={formAction} className="card space-y-4 p-5">
      <input type="hidden" name="locationId" value={locationId} />
      <input type="hidden" name="pageId" value={page.id} />
      <input type="hidden" name="blocks" value={JSON.stringify(blocks)} />

      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-slate-800">/{page.slug || ""}</span>
          {page.isHome ? <span className="text-xs text-slate-400">(home)</span> : null}
        </div>
        <input
          name="title"
          defaultValue={page.title}
          className="input h-8 max-w-[200px] py-1 text-sm"
          placeholder="Page title"
        />
      </div>

      {/* Blocks */}
      <div className="space-y-3">
        {blocks.length === 0 ? (
          <p className="rounded-lg border border-dashed border-slate-200 p-6 text-center text-sm text-slate-400">
            No blocks yet — add your first below.
          </p>
        ) : (
          blocks.map((block, i) => {
            const def = blockDef(block.type);
            return (
              <div key={i} className="rounded-xl border border-slate-200 bg-slate-50/50 p-4">
                <div className="mb-3 flex items-center justify-between">
                  <span className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                    <span className="grid h-6 w-6 place-items-center rounded bg-brand-100 text-brand-700">{def?.icon ?? "▉"}</span>
                    {def?.label ?? block.type}
                  </span>
                  <div className="flex items-center gap-1">
                    <button type="button" onClick={() => move(i, -1)} disabled={i === 0} className="h-7 w-7 rounded text-slate-400 hover:bg-slate-200 disabled:opacity-30">↑</button>
                    <button type="button" onClick={() => move(i, 1)} disabled={i === blocks.length - 1} className="h-7 w-7 rounded text-slate-400 hover:bg-slate-200 disabled:opacity-30">↓</button>
                    <button type="button" onClick={() => remove(i)} className="h-7 w-7 rounded text-slate-400 hover:bg-red-100 hover:text-red-600">×</button>
                  </div>
                </div>
                {def ? (
                  <div className="space-y-3">
                    {def.fields.map((f) => (
                      <FieldEditor key={f.k} field={f} block={block} calendars={calendars} onChange={(patch) => update(i, patch)} />
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-slate-400">Unknown block type “{block.type}”.</p>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Add block */}
      <div className="relative">
        <button type="button" onClick={() => setAdding((a) => !a)} className="btn-secondary text-sm">+ Add block</button>
        {adding ? (
          <div className="absolute z-10 mt-2 w-64 rounded-xl border border-slate-200 bg-white p-2 shadow-lg">
            {(["Layout", "Content", "Media", "Convert"] as const).map((cat) => (
              <div key={cat} className="mb-1">
                <div className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-slate-400">{cat}</div>
                {BLOCK_DEFS.filter((b) => b.category === cat).map((b) => (
                  <button key={b.type} type="button" onClick={() => add(b.type)} className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-sm text-slate-700 hover:bg-slate-100">
                    <span className="w-4 text-center text-brand-600">{b.icon}</span> {b.label}
                  </button>
                ))}
              </div>
            ))}
          </div>
        ) : null}
      </div>

      {/* SEO */}
      <details className="rounded-xl border border-slate-200 p-3">
        <summary className="cursor-pointer text-sm font-medium text-slate-700">SEO</summary>
        <div className="mt-3 space-y-3">
          <div>
            <label className="label">Meta title</label>
            <input name="seoTitle" defaultValue={page.seoTitle ?? ""} className="input" placeholder={page.title} />
          </div>
          <div>
            <label className="label">Meta description</label>
            <textarea name="seoDescription" defaultValue={page.seoDescription ?? ""} rows={2} className="input" placeholder="Up to ~160 characters for search results." />
          </div>
        </div>
      </details>

      <div className="flex items-center gap-3 border-t border-slate-100 pt-3">
        <SubmitButton className="btn-primary">Save page</SubmitButton>
        {state?.ok ? <span className="text-sm text-green-600">Saved.</span> : null}
        {state?.error ? <span className="text-sm text-red-600">{state.error}</span> : null}
      </div>
    </form>
  );
}

function FieldEditor({
  field,
  block,
  calendars,
  onChange,
}: {
  field: BlockField;
  block: Record<string, unknown>;
  calendars: { id: string; name: string }[];
  onChange: (patch: Record<string, unknown>) => void;
}) {
  const value = block[field.k];

  if (field.kind === "textarea") {
    return (
      <div>
        <label className="label">{field.label}</label>
        <textarea rows={2} className="input" value={String(value ?? "")} placeholder={field.placeholder} onChange={(e) => onChange({ [field.k]: e.target.value })} />
      </div>
    );
  }

  if (field.kind === "select") {
    return (
      <div>
        <label className="label">{field.label}</label>
        <select className="input" value={String(value ?? "")} onChange={(e) => onChange({ [field.k]: e.target.value })}>
          {field.options?.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      </div>
    );
  }

  if (field.kind === "calendar") {
    return (
      <div>
        <label className="label">{field.label}</label>
        <select className="input" value={String(value ?? "")} onChange={(e) => onChange({ [field.k]: e.target.value })}>
          <option value="">— Select a calendar —</option>
          {calendars.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        {calendars.length === 0 ? <p className="mt-1 text-xs text-amber-600">No calendars yet — create one in the Calendar tab.</p> : null}
      </div>
    );
  }

  if (field.kind === "checks") {
    const arr = Array.isArray(value) ? (value as string[]) : [];
    return (
      <div>
        <label className="label">{field.label}</label>
        <div className="flex flex-wrap gap-3">
          {field.options?.map((o) => (
            <label key={o.value} className="flex items-center gap-1.5 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={arr.includes(o.value)}
                onChange={(e) => onChange({ [field.k]: e.target.checked ? [...arr, o.value] : arr.filter((v) => v !== o.value) })}
              />
              {o.label}
            </label>
          ))}
        </div>
      </div>
    );
  }

  if (field.kind === "items") {
    const items = Array.isArray(value) ? (value as Record<string, unknown>[]) : [];
    const setItems = (next: Record<string, unknown>[]) => onChange({ [field.k]: next });
    return (
      <div>
        <label className="label">{field.label}</label>
        <div className="space-y-2">
          {items.map((it, idx) => (
            <div key={idx} className="rounded-lg border border-slate-200 bg-white p-2">
              <div className="mb-1 flex justify-end">
                <button type="button" onClick={() => setItems(items.filter((_, k) => k !== idx))} className="text-xs text-slate-400 hover:text-red-600">Remove</button>
              </div>
              {field.itemFields?.map((sf) =>
                sf.kind === "textarea" ? (
                  <textarea key={sf.k} rows={2} className="input mb-1" placeholder={sf.label} value={String(it[sf.k] ?? "")} onChange={(e) => setItems(items.map((x, k) => (k === idx ? { ...x, [sf.k]: e.target.value } : x)))} />
                ) : (
                  <input key={sf.k} className="input mb-1" placeholder={sf.label} value={String(it[sf.k] ?? "")} onChange={(e) => setItems(items.map((x, k) => (k === idx ? { ...x, [sf.k]: e.target.value } : x)))} />
                ),
              )}
            </div>
          ))}
          <button type="button" onClick={() => setItems([...items, {}])} className="text-xs font-medium text-brand-600 hover:underline">+ Add item</button>
        </div>
      </div>
    );
  }

  // text / url
  return (
    <div>
      <label className="label">{field.label}</label>
      <input className="input" value={String(value ?? "")} placeholder={field.placeholder} onChange={(e) => onChange({ [field.k]: e.target.value })} />
    </div>
  );
}
