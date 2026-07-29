"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { useFormState, useFormStatus } from "react-dom";
import { updatePageAction } from "@/app/dashboard/l/[locationId]/website/actions";
import { BLOCK_DEFS, blockDef } from "@/lib/site-blocks-catalog";
import { ELEMENT_DEFS, elementDef } from "@/lib/site-elements";
import { TEMPLATES } from "@/lib/site-templates";
import { BlockPreview } from "@/components/site-block-preview";
import { SiteElement } from "@/components/site-element";
import { FieldEditor } from "@/components/site-field-editor";
import { cn } from "@/lib/utils";

type El = { type: string } & Record<string, unknown>;
type Col = { width?: number; elements?: El[] };
type AnyBlock = { type: string; columns?: Col[] } & Record<string, unknown>;
type Sel = { b: number; c?: number; e?: number } | null;
type Drag =
  | { kind: "new-block"; type: string }
  | { kind: "new-row"; cols: number }
  | { kind: "new-element"; type: string }
  | { kind: "move-block"; from: number }
  | null;

const DEVICES = {
  desktop: { label: "Desktop", icon: "🖥", width: "100%" },
  tablet: { label: "Tablet", icon: "▭", width: "820px" },
  mobile: { label: "Mobile", icon: "▯", width: "390px" },
} as const;
type Device = keyof typeof DEVICES;

const newRow = (cols: number): AnyBlock => ({
  type: "row",
  columns: Array.from({ length: cols }, () => ({ elements: [] as El[] })),
});
const newEl = (type: string): El => ({ type, ...structuredClone(elementDef(type)?.default ?? {}) });

export function VisualBuilder({
  locationId,
  page,
  calendars,
  primaryColor,
  publicUrl,
}: {
  locationId: string;
  page: { id: string; title: string; slug: string; isHome: boolean; blocks: unknown; seoTitle: string | null; seoDescription: string | null };
  calendars: { id: string; name: string }[];
  primaryColor: string;
  publicUrl: string;
}) {
  const [state, formAction] = useFormState(updatePageAction, { error: "", ok: false } as { error: string; ok?: boolean });
  const [blocks, setBlocks] = useState<AnyBlock[]>(() => (Array.isArray(page.blocks) ? (page.blocks as AnyBlock[]) : []));
  const [title, setTitle] = useState(page.title);
  const [seoTitle, setSeoTitle] = useState(page.seoTitle ?? "");
  const [seoDescription, setSeoDescription] = useState(page.seoDescription ?? "");
  const [sel, setSel] = useState<Sel>(null);
  const [device, setDevice] = useState<Device>("desktop");
  const [overIndex, setOverIndex] = useState<number | null>(null);
  const [templating, setTemplating] = useState(false);
  const drag = useRef<Drag>(null);

  // ---- top-level block ops ----
  const insertBlock = (type: string, at: number) => {
    const def = blockDef(type);
    if (!def) return;
    const b = { type, ...structuredClone(def.default) } as AnyBlock;
    setBlocks((bs) => { const c = [...bs]; c.splice(at, 0, b); return c; });
    setSel({ b: at });
  };
  const insertRow = (cols: number, at: number) => {
    setBlocks((bs) => { const c = [...bs]; c.splice(at, 0, newRow(cols)); return c; });
    setSel({ b: at });
  };
  const insertElementAsRow = (type: string, at: number) => {
    const row = newRow(1);
    row.columns![0].elements = [newEl(type)];
    setBlocks((bs) => { const c = [...bs]; c.splice(at, 0, row); return c; });
    setSel({ b: at, c: 0, e: 0 });
  };
  const updateBlock = (i: number, patch: Record<string, unknown>) =>
    setBlocks((bs) => bs.map((blk, idx) => (idx === i ? { ...blk, ...patch } : blk)));
  const moveBlock = (from: number, to: number) =>
    setBlocks((bs) => { const c = [...bs]; const [it] = c.splice(from, 1); c.splice(from < to ? to - 1 : to, 0, it); return c; });
  const duplicateBlock = (i: number) =>
    setBlocks((bs) => { const c = [...bs]; c.splice(i + 1, 0, structuredClone(bs[i])); return c; });
  const removeBlock = (i: number) => { setBlocks((bs) => bs.filter((_, idx) => idx !== i)); setSel(null); };

  // ---- column / element ops ----
  const editCol = (b: number, c: number, fn: (col: Col) => Col) =>
    setBlocks((bs) => bs.map((blk, bi) => (bi !== b ? blk : { ...blk, columns: (blk.columns ?? []).map((col, ci) => (ci !== c ? col : fn(col))) })));
  const addElement = (b: number, c: number, type: string) => {
    editCol(b, c, (col) => ({ ...col, elements: [...(col.elements ?? []), newEl(type)] }));
    setSel({ b, c, e: (blocks[b]?.columns?.[c]?.elements?.length ?? 0) });
  };
  const updateElement = (b: number, c: number, e: number, patch: Record<string, unknown>) =>
    editCol(b, c, (col) => ({ ...col, elements: (col.elements ?? []).map((el, ei) => (ei !== e ? el : { ...el, ...patch })) }));
  const moveElement = (b: number, c: number, e: number, dir: -1 | 1) =>
    editCol(b, c, (col) => {
      const els = [...(col.elements ?? [])]; const j = e + dir;
      if (j < 0 || j >= els.length) return col;
      [els[e], els[j]] = [els[j], els[e]];
      return { ...col, elements: els };
    });
  const removeElement = (b: number, c: number, e: number) => {
    editCol(b, c, (col) => ({ ...col, elements: (col.elements ?? []).filter((_, ei) => ei !== e) }));
    setSel({ b, c });
  };
  const duplicateElement = (b: number, c: number, e: number) =>
    editCol(b, c, (col) => { const els = [...(col.elements ?? [])]; els.splice(e + 1, 0, structuredClone(els[e])); return { ...col, elements: els }; });
  const addColumn = (b: number) =>
    setBlocks((bs) => bs.map((blk, bi) => (bi !== b ? blk : { ...blk, columns: [...(blk.columns ?? []), { elements: [] }] })));
  const removeColumn = (b: number, c: number) =>
    setBlocks((bs) => bs.map((blk, bi) => (bi !== b ? blk : { ...blk, columns: (blk.columns ?? []).filter((_, ci) => ci !== c) })));

  const applyTemplate = (key: string) => {
    const t = TEMPLATES.find((x) => x.key === key);
    if (!t) return;
    if (blocks.length && !confirm("Replace this page's content with the template?")) return;
    setBlocks(structuredClone(t.blocks) as AnyBlock[]); setSel(null); setTemplating(false);
  };

  // ---- drag & drop (top level) ----
  const onTopDrop = (at: number) => {
    const d = drag.current; setOverIndex(null); drag.current = null;
    if (!d) return;
    if (d.kind === "new-block") insertBlock(d.type, at);
    else if (d.kind === "new-row") insertRow(d.cols, at);
    else if (d.kind === "new-element") insertElementAsRow(d.type, at);
    else if (d.kind === "move-block") moveBlock(d.from, at);
  };
  const DropZone = ({ at }: { at: number }) => (
    <div
      onDragOver={(e) => { e.preventDefault(); setOverIndex(at); }}
      onDrop={(e) => { e.preventDefault(); onTopDrop(at); }}
      style={{ height: overIndex === at ? 44 : 10 }}
      className="relative"
    >
      <div className={cn("absolute inset-x-0 top-1/2 -translate-y-1/2 rounded-full transition-all", overIndex === at ? "h-1.5 bg-brand-500" : "h-0")} />
    </div>
  );

  const selEl = sel && sel.c != null && sel.e != null ? blocks[sel.b]?.columns?.[sel.c]?.elements?.[sel.e] : null;
  const selBlock = sel && sel.c == null ? blocks[sel.b] : null;

  return (
    <form action={formAction}>
      <input type="hidden" name="locationId" value={locationId} />
      <input type="hidden" name="pageId" value={page.id} />
      <input type="hidden" name="blocks" value={JSON.stringify(blocks)} />
      <input type="hidden" name="title" value={title} />
      <input type="hidden" name="seoTitle" value={seoTitle} />
      <input type="hidden" name="seoDescription" value={seoDescription} />

      {/* Toolbar */}
      <div className="sticky top-0 z-20 mb-3 flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-white/90 px-3 py-2 shadow-sm backdrop-blur">
        <span className="text-sm font-semibold text-slate-800">/{page.slug || ""}</span>
        {page.isHome ? <span className="text-xs text-slate-400">home</span> : null}
        <div className="mx-2 inline-flex overflow-hidden rounded-lg border border-slate-200">
          {(Object.keys(DEVICES) as Device[]).map((d) => (
            <button key={d} type="button" onClick={() => setDevice(d)} title={DEVICES[d].label}
              className={cn("px-2.5 py-1 text-sm", device === d ? "bg-brand-gradient text-white" : "bg-white text-slate-500 hover:bg-slate-50")}>
              {DEVICES[d].icon}
            </button>
          ))}
        </div>
        <div className="relative">
          <button type="button" onClick={() => setTemplating((t) => !t)} className="btn-ghost text-sm">Templates ▾</button>
          {templating ? (
            <div className="absolute z-30 mt-2 w-72 rounded-xl border border-slate-200 bg-white p-2 shadow-lg">
              {TEMPLATES.map((t) => (
                <button key={t.key} type="button" onClick={() => applyTemplate(t.key)} className="block w-full rounded px-2 py-2 text-left hover:bg-slate-100">
                  <div className="text-sm font-medium text-slate-800">{t.name}</div>
                  <div className="text-xs text-slate-500">{t.description}</div>
                </button>
              ))}
            </div>
          ) : null}
        </div>
        <div className="ml-auto flex items-center gap-2">
          {state?.ok ? <span className="text-sm text-green-600">Saved ✓</span> : null}
          {state?.error ? <span className="text-sm text-red-600">{state.error}</span> : null}
          <Link href={publicUrl} target="_blank" className="btn-secondary text-sm">Preview ↗</Link>
          <SaveButton />
        </div>
      </div>

      <div className="grid gap-3 lg:grid-cols-[200px_1fr_310px]">
        {/* Palette */}
        <aside className="max-h-[80vh] overflow-y-auto rounded-xl border border-slate-200 bg-white p-2">
          <PaletteGroup title="Rows" hint="Drag onto canvas or click">
            <div className="grid grid-cols-3 gap-1.5">
              {[1, 2, 3, 4, 5, 6].map((n) => (
                <button key={n} type="button" draggable
                  onDragStart={() => { drag.current = { kind: "new-row", cols: n }; }}
                  onDragEnd={() => { drag.current = null; setOverIndex(null); }}
                  onClick={() => insertRow(n, blocks.length)}
                  className="flex cursor-grab flex-col items-center gap-1 rounded-lg border border-slate-200 bg-slate-50 py-2 hover:border-brand-300 hover:bg-brand-50 active:cursor-grabbing">
                  <ColIcon n={n} />
                  <span className="text-[10px] text-slate-500">{n} col</span>
                </button>
              ))}
            </div>
          </PaletteGroup>

          <PaletteGroup title="Elements" hint="Drag into a column, or click">
            <div className="grid grid-cols-2 gap-1.5">
              {ELEMENT_DEFS.map((el) => (
                <button key={el.type} type="button" draggable
                  onDragStart={() => { drag.current = { kind: "new-element", type: el.type }; }}
                  onDragEnd={() => { drag.current = null; setOverIndex(null); }}
                  onClick={() => { if (sel?.c != null) addElement(sel.b, sel.c, el.type); else insertElementAsRow(el.type, blocks.length); }}
                  className="flex cursor-grab items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-2 py-1.5 text-left hover:border-brand-300 hover:bg-brand-50 active:cursor-grabbing">
                  <span className="w-4 text-center text-brand-600">{el.icon}</span>
                  <span className="text-[11px] text-slate-600">{el.label}</span>
                </button>
              ))}
            </div>
          </PaletteGroup>

          {(["Layout", "Content", "Media", "Convert"] as const).map((cat) => (
            <PaletteGroup key={cat} title={cat === "Layout" ? "Sections" : cat}>
              <div className="grid grid-cols-2 gap-1.5">
                {BLOCK_DEFS.filter((b) => b.category === cat).map((b) => (
                  <button key={b.type} type="button" draggable
                    onDragStart={() => { drag.current = { kind: "new-block", type: b.type }; }}
                    onDragEnd={() => { drag.current = null; setOverIndex(null); }}
                    onClick={() => insertBlock(b.type, blocks.length)}
                    className="flex cursor-grab items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-2 py-1.5 text-left hover:border-brand-300 hover:bg-brand-50 active:cursor-grabbing">
                    <span className="w-4 text-center text-brand-600">{b.icon}</span>
                    <span className="text-[11px] text-slate-600">{b.label}</span>
                  </button>
                ))}
              </div>
            </PaletteGroup>
          ))}
        </aside>

        {/* Canvas */}
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-slate-100 p-4">
          <div className="mx-auto rounded-lg bg-white shadow-sm ring-1 ring-slate-200 transition-all" style={{ width: DEVICES[device].width, maxWidth: "100%" }}>
            {blocks.length === 0 ? (
              <div onDragOver={(e) => { e.preventDefault(); setOverIndex(0); }} onDrop={(e) => { e.preventDefault(); onTopDrop(0); }}
                className={cn("m-4 grid place-items-center rounded-xl border-2 border-dashed p-16 text-center text-sm", overIndex === 0 ? "border-brand-400 bg-brand-50 text-brand-600" : "border-slate-200 text-slate-400")}>
                Drag a row, section or element here to start building.
              </div>
            ) : (
              <div className="overflow-hidden rounded-lg">
                <DropZone at={0} />
                {blocks.map((block, i) => (
                  <div key={i}>
                    <BlockShell
                      block={block} index={i} count={blocks.length} selected={sel?.b === i && sel.c == null}
                      onSelect={() => setSel({ b: i })}
                      onDragStart={() => { drag.current = { kind: "move-block", from: i }; }}
                      onDragEnd={() => { drag.current = null; setOverIndex(null); }}
                      onMoveUp={() => moveBlock(i, i - 1)} onMoveDown={() => moveBlock(i, i + 2)}
                      onDuplicate={() => duplicateBlock(i)} onDelete={() => removeBlock(i)}
                    >
                      {block.type === "row" ? (
                        <RowEditor
                          block={block} b={i} sel={sel} primaryColor={primaryColor}
                          onSelectEl={(c, e) => setSel({ b: i, c, e })}
                          onSelectCol={(c) => setSel({ b: i, c })}
                          onAddElement={(c, t) => addElement(i, c, t)}
                          onMoveEl={(c, e, dir) => moveElement(i, c, e, dir)}
                          onDupEl={(c, e) => duplicateElement(i, c, e)}
                          onDelEl={(c, e) => removeElement(i, c, e)}
                          onDropElement={(c) => { const d = drag.current; drag.current = null; if (d?.kind === "new-element") addElement(i, c, d.type); }}
                        />
                      ) : (
                        <BlockPreview block={block} primaryColor={primaryColor} />
                      )}
                    </BlockShell>
                    <DropZone at={i + 1} />
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Inspector */}
        <aside className="max-h-[80vh] overflow-y-auto rounded-xl border border-slate-200 bg-white p-3">
          {selEl ? (
            <Inspector title={`${elementDef(selEl.type)?.icon ?? ""} ${elementDef(selEl.type)?.label ?? selEl.type}`} onClose={() => setSel({ b: sel!.b, c: sel!.c })}>
              {(elementDef(selEl.type)?.fields ?? []).map((f) => (
                <FieldEditor key={f.k} field={f} block={selEl} calendars={calendars} onChange={(patch) => updateElement(sel!.b, sel!.c!, sel!.e!, patch)} />
              ))}
              <div className="mt-4 flex gap-2 border-t border-slate-100 pt-3">
                <button type="button" onClick={() => duplicateElement(sel!.b, sel!.c!, sel!.e!)} className="btn-secondary flex-1 text-xs">Duplicate</button>
                <button type="button" onClick={() => removeElement(sel!.b, sel!.c!, sel!.e!)} className="flex-1 rounded-lg bg-red-50 px-3 py-2 text-xs font-medium text-red-700 hover:bg-red-100">Delete</button>
              </div>
            </Inspector>
          ) : selBlock && selBlock.type === "row" ? (
            <Inspector title="▦ Row" onClose={() => setSel(null)}>
              <p className="text-sm text-slate-500">{(selBlock.columns ?? []).length} column(s). Click a column&rsquo;s + to add elements.</p>
              <div className="mt-3 flex gap-2">
                <button type="button" onClick={() => addColumn(sel!.b)} className="btn-secondary flex-1 text-xs">+ Add column</button>
                {(selBlock.columns ?? []).length > 1 ? (
                  <button type="button" onClick={() => removeColumn(sel!.b, (selBlock.columns ?? []).length - 1)} className="btn-secondary flex-1 text-xs">− Remove column</button>
                ) : null}
              </div>
              <div className="mt-4 flex gap-2 border-t border-slate-100 pt-3">
                <button type="button" onClick={() => duplicateBlock(sel!.b)} className="btn-secondary flex-1 text-xs">Duplicate</button>
                <button type="button" onClick={() => removeBlock(sel!.b)} className="flex-1 rounded-lg bg-red-50 px-3 py-2 text-xs font-medium text-red-700 hover:bg-red-100">Delete</button>
              </div>
            </Inspector>
          ) : selBlock ? (
            <Inspector title={`${blockDef(selBlock.type)?.icon ?? ""} ${blockDef(selBlock.type)?.label ?? selBlock.type}`} onClose={() => setSel(null)}>
              {(blockDef(selBlock.type)?.fields ?? []).map((f) => (
                <FieldEditor key={f.k} field={f} block={selBlock} calendars={calendars} onChange={(patch) => updateBlock(sel!.b, patch)} />
              ))}
              <div className="mt-4 flex gap-2 border-t border-slate-100 pt-3">
                <button type="button" onClick={() => duplicateBlock(sel!.b)} className="btn-secondary flex-1 text-xs">Duplicate</button>
                <button type="button" onClick={() => removeBlock(sel!.b)} className="flex-1 rounded-lg bg-red-50 px-3 py-2 text-xs font-medium text-red-700 hover:bg-red-100">Delete</button>
              </div>
            </Inspector>
          ) : (
            <div className="space-y-4">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Page settings</p>
              <div><label className="label">Page title</label><input className="input" value={title} onChange={(e) => setTitle(e.target.value)} /></div>
              <div><label className="label">Meta title (SEO)</label><input className="input" value={seoTitle} onChange={(e) => setSeoTitle(e.target.value)} placeholder={title} /></div>
              <div><label className="label">Meta description (SEO)</label><textarea rows={3} className="input" value={seoDescription} onChange={(e) => setSeoDescription(e.target.value)} placeholder="Up to ~160 characters." /></div>
              <p className="rounded-lg bg-slate-50 p-3 text-xs text-slate-500">Add a <b>Row</b>, drop <b>Elements</b> into its columns, then click any element to edit it here.</p>
            </div>
          )}
        </aside>
      </div>
    </form>
  );
}

function PaletteGroup({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="mb-3">
      <div className="px-1 text-[10px] font-semibold uppercase tracking-wide text-slate-400">{title}</div>
      {hint ? <div className="px-1 pb-1.5 text-[10px] text-slate-400">{hint}</div> : <div className="pb-1" />}
      {children}
    </div>
  );
}

function ColIcon({ n }: { n: number }) {
  return (
    <span className="flex h-4 w-8 gap-0.5">
      {Array.from({ length: n }).map((_, i) => <span key={i} className="flex-1 rounded-sm bg-brand-300" />)}
    </span>
  );
}

function Inspector({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <span className="text-sm font-semibold text-slate-800">{title}</span>
        <button type="button" onClick={onClose} className="text-xs text-slate-400 hover:text-slate-700">Done</button>
      </div>
      <div className="space-y-3">{children}</div>
    </div>
  );
}

function BlockShell({
  block, index, count, selected, onSelect, onDragStart, onDragEnd, onMoveUp, onMoveDown, onDuplicate, onDelete, children,
}: {
  block: AnyBlock; index: number; count: number; selected: boolean;
  onSelect: () => void; onDragStart: () => void; onDragEnd: () => void;
  onMoveUp: () => void; onMoveDown: () => void; onDuplicate: () => void; onDelete: () => void;
  children: React.ReactNode;
}) {
  const label = block.type === "row" ? "Row" : (blockDef(block.type)?.label ?? block.type);
  return (
    <div draggable onDragStart={onDragStart} onDragEnd={onDragEnd}
      onClick={(e) => { e.stopPropagation(); onSelect(); }}
      className={cn("group relative cursor-pointer", selected ? "ring-2 ring-brand-500" : "hover:ring-2 hover:ring-brand-200")}>
      <div className={cn("pointer-events-none absolute left-2 top-2 z-10 rounded bg-slate-900/80 px-1.5 py-0.5 text-[10px] font-medium text-white", selected ? "opacity-100" : "opacity-0 group-hover:opacity-100")}>⠿ {label}</div>
      <div className={cn("absolute right-2 top-2 z-10 flex items-center gap-1 rounded-lg bg-white/95 p-0.5 shadow ring-1 ring-slate-200", selected ? "opacity-100" : "opacity-0 group-hover:opacity-100")}>
        <Mini label="Up" disabled={index === 0} onClick={onMoveUp}>↑</Mini>
        <Mini label="Down" disabled={index === count - 1} onClick={onMoveDown}>↓</Mini>
        <Mini label="Duplicate" onClick={onDuplicate}>⧉</Mini>
        <Mini label="Delete" danger onClick={onDelete}>×</Mini>
      </div>
      {children}
    </div>
  );
}

function RowEditor({
  block, b, sel, primaryColor, onSelectEl, onSelectCol, onAddElement, onMoveEl, onDupEl, onDelEl, onDropElement,
}: {
  block: AnyBlock; b: number; sel: Sel; primaryColor: string;
  onSelectEl: (c: number, e: number) => void; onSelectCol: (c: number) => void;
  onAddElement: (c: number, type: string) => void;
  onMoveEl: (c: number, e: number, dir: -1 | 1) => void; onDupEl: (c: number, e: number) => void; onDelEl: (c: number, e: number) => void;
  onDropElement: (c: number) => void;
}) {
  const [addFor, setAddFor] = useState<number | null>(null);
  const [dragOverCol, setDragOverCol] = useState<number | null>(null);
  const columns = block.columns ?? [];
  return (
    <div className="flex flex-col gap-3 p-4 sm:flex-row">
      {columns.map((col, c) => {
        const els = col.elements ?? [];
        const colSelected = sel?.b === b && sel.c === c && sel.e == null;
        return (
          <div key={c} style={{ flex: col.width || 1 }}
            onDragOver={(e) => { e.preventDefault(); setDragOverCol(c); }}
            onDragLeave={() => setDragOverCol((v) => (v === c ? null : v))}
            onDrop={(e) => { e.preventDefault(); setDragOverCol(null); onDropElement(c); }}
            onClick={(e) => { e.stopPropagation(); onSelectCol(c); }}
            className={cn("min-h-[80px] space-y-3 rounded-lg border-2 border-dashed p-3", dragOverCol === c ? "border-brand-400 bg-brand-50" : colSelected ? "border-brand-300" : "border-slate-200")}>
            {els.length === 0 ? (
              <p className="py-4 text-center text-xs text-slate-400">Drop elements here</p>
            ) : (
              els.map((el, e) => {
                const elSelected = sel?.b === b && sel.c === c && sel.e === e;
                return (
                  <div key={e} onClick={(ev) => { ev.stopPropagation(); onSelectEl(c, e); }}
                    className={cn("group/el relative cursor-pointer rounded", elSelected ? "ring-2 ring-brand-500" : "hover:ring-2 hover:ring-brand-200")}>
                    <div className={cn("absolute right-1 top-1 z-10 flex gap-0.5 rounded bg-white/95 p-0.5 shadow ring-1 ring-slate-200", elSelected ? "opacity-100" : "opacity-0 group-hover/el:opacity-100")}>
                      <Mini label="Up" disabled={e === 0} onClick={() => onMoveEl(c, e, -1)}>↑</Mini>
                      <Mini label="Down" disabled={e === els.length - 1} onClick={() => onMoveEl(c, e, 1)}>↓</Mini>
                      <Mini label="Duplicate" onClick={() => onDupEl(c, e)}>⧉</Mini>
                      <Mini label="Delete" danger onClick={() => onDelEl(c, e)}>×</Mini>
                    </div>
                    <SiteElement element={el} primaryColor={primaryColor} />
                  </div>
                );
              })
            )}
            <div className="relative">
              <button type="button" onClick={(e) => { e.stopPropagation(); setAddFor((v) => (v === c ? null : c)); }}
                className="w-full rounded-lg border border-dashed border-slate-300 py-1.5 text-xs text-slate-500 hover:border-brand-300 hover:text-brand-600">+ Add element</button>
              {addFor === c ? (
                <div className="absolute z-20 mt-1 grid w-48 grid-cols-2 gap-1 rounded-xl border border-slate-200 bg-white p-2 shadow-lg">
                  {ELEMENT_DEFS.map((el) => (
                    <button key={el.type} type="button" onClick={(e) => { e.stopPropagation(); onAddElement(c, el.type); setAddFor(null); }}
                      className="flex items-center gap-1.5 rounded px-2 py-1.5 text-left text-[11px] text-slate-700 hover:bg-slate-100">
                      <span className="w-3 text-center text-brand-600">{el.icon}</span>{el.label}
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function Mini({ children, onClick, label, disabled, danger }: { children: React.ReactNode; onClick: () => void; label: string; disabled?: boolean; danger?: boolean }) {
  return (
    <button type="button" title={label} aria-label={label} disabled={disabled}
      onClick={(e) => { e.stopPropagation(); onClick(); }}
      className={cn("grid h-6 w-6 place-items-center rounded text-slate-500 disabled:opacity-30", danger ? "hover:bg-red-100 hover:text-red-600" : "hover:bg-slate-100 hover:text-slate-800")}>
      {children}
    </button>
  );
}

function SaveButton() {
  const { pending } = useFormStatus();
  return <button type="submit" className="btn-primary text-sm" disabled={pending} aria-busy={pending}>{pending ? "Saving…" : "Save"}</button>;
}
