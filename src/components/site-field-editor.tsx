"use client";

import { type BlockField } from "@/lib/site-blocks-catalog";

/**
 * Editor for a single block field. Shared by the visual builder's inspector
 * and the legacy block editor.
 */
export function FieldEditor({
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
        <textarea rows={3} className="input" value={String(value ?? "")} placeholder={field.placeholder} onChange={(e) => onChange({ [field.k]: e.target.value })} />
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
          <option value="">Let visitors choose (all services)</option>
          {calendars.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        {calendars.length === 0 ? (
          <p className="mt-1 text-xs text-amber-600">No calendars yet — create one in the Calendar tab.</p>
        ) : (
          <p className="mt-1 text-xs text-slate-500">Leave as “Let visitors choose” to show a service picker, or lock the widget to one service.</p>
        )}
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
              <div className="mb-1 flex items-center justify-between">
                <span className="text-[11px] font-medium uppercase tracking-wide text-slate-400">Item {idx + 1}</span>
                <div className="flex items-center gap-2">
                  <button type="button" onClick={() => { if (idx > 0) setItems(swap(items, idx, idx - 1)); }} disabled={idx === 0} className="text-slate-400 hover:text-slate-700 disabled:opacity-30">↑</button>
                  <button type="button" onClick={() => { if (idx < items.length - 1) setItems(swap(items, idx, idx + 1)); }} disabled={idx === items.length - 1} className="text-slate-400 hover:text-slate-700 disabled:opacity-30">↓</button>
                  <button type="button" onClick={() => setItems(items.filter((_, k) => k !== idx))} className="text-xs text-slate-400 hover:text-red-600">Remove</button>
                </div>
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

function swap<T>(arr: T[], i: number, j: number): T[] {
  const copy = [...arr];
  [copy[i], copy[j]] = [copy[j], copy[i]];
  return copy;
}
