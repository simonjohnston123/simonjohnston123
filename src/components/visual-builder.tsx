"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { useFormState, useFormStatus } from "react-dom";
import { updatePageAction } from "@/app/dashboard/l/[locationId]/website/actions";
import { BLOCK_DEFS, blockDef } from "@/lib/site-blocks-catalog";
import { TEMPLATES } from "@/lib/site-templates";
import { BlockPreview } from "@/components/site-block-preview";
import { FieldEditor } from "@/components/site-field-editor";
import { cn } from "@/lib/utils";

type AnyBlock = { type: string } & Record<string, unknown>;
type DragInfo = { kind: "new"; type: string } | { kind: "move"; from: number };

const DEVICES = {
  desktop: { label: "Desktop", icon: "🖥", width: "100%" },
  tablet: { label: "Tablet", icon: "▭", width: "820px" },
  mobile: { label: "Mobile", icon: "▯", width: "390px" },
} as const;
type Device = keyof typeof DEVICES;

export function VisualBuilder({
  locationId,
  page,
  calendars,
  primaryColor,
  publicUrl,
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
  primaryColor: string;
  publicUrl: string;
}) {
  const [state, formAction] = useFormState(updatePageAction, { error: "", ok: false } as { error: string; ok?: boolean });
  const [blocks, setBlocks] = useState<AnyBlock[]>(() => (Array.isArray(page.blocks) ? (page.blocks as AnyBlock[]) : []));
  const [title, setTitle] = useState(page.title);
  const [seoTitle, setSeoTitle] = useState(page.seoTitle ?? "");
  const [seoDescription, setSeoDescription] = useState(page.seoDescription ?? "");
  const [selected, setSelected] = useState<number | null>(null);
  const [device, setDevice] = useState<Device>("desktop");
  const [overIndex, setOverIndex] = useState<number | null>(null);
  const [templating, setTemplating] = useState(false);
  const drag = useRef<DragInfo | null>(null);

  const selectedBlock = selected != null ? blocks[selected] : null;
  const selectedDef = selectedBlock ? blockDef(selectedBlock.type) : null;

  // ---- mutations ----
  const updateBlock = (i: number, patch: Record<string, unknown>) =>
    setBlocks((b) => b.map((blk, idx) => (idx === i ? { ...blk, ...patch } : blk)));

  const insertBlock = (type: string, at: number) => {
    const def = blockDef(type);
    if (!def) return;
    const newBlock = { type, ...structuredClone(def.default) } as AnyBlock;
    setBlocks((b) => {
      const copy = [...b];
      copy.splice(at, 0, newBlock);
      return copy;
    });
    setSelected(at);
  };

  const moveBlock = (from: number, to: number) => {
    setBlocks((b) => {
      const copy = [...b];
      const [item] = copy.splice(from, 1);
      const dest = from < to ? to - 1 : to;
      copy.splice(dest, 0, item);
      return copy;
    });
  };

  const duplicateBlock = (i: number) =>
    setBlocks((b) => {
      const copy = [...b];
      copy.splice(i + 1, 0, structuredClone(b[i]));
      return copy;
    });

  const removeBlock = (i: number) => {
    setBlocks((b) => b.filter((_, idx) => idx !== i));
    setSelected(null);
  };

  const applyTemplate = (key: string) => {
    const t = TEMPLATES.find((x) => x.key === key);
    if (!t) return;
    if (blocks.length && !confirm("Replace this page's content with the template?")) return;
    setBlocks(structuredClone(t.blocks) as AnyBlock[]);
    setSelected(null);
    setTemplating(false);
  };

  // ---- drag & drop ----
  const onDrop = (at: number) => {
    const info = drag.current;
    setOverIndex(null);
    drag.current = null;
    if (!info) return;
    if (info.kind === "new") insertBlock(info.type, at);
    else moveBlock(info.from, at);
  };

  const DropZone = ({ at }: { at: number }) => (
    <div
      onDragOver={(e) => { e.preventDefault(); setOverIndex(at); }}
      onDrop={(e) => { e.preventDefault(); onDrop(at); }}
      className="relative"
      style={{ height: overIndex === at ? 44 : 10 }}
    >
      <div
        className={cn(
          "absolute left-0 right-0 top-1/2 -translate-y-1/2 rounded-full transition-all",
          overIndex === at ? "h-1.5 bg-brand-500" : "h-0",
        )}
      />
      {overIndex === at ? (
        <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 text-center text-[11px] font-medium text-brand-600">Drop here</div>
      ) : null}
    </div>
  );

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
            <button
              key={d}
              type="button"
              onClick={() => setDevice(d)}
              className={cn("px-2.5 py-1 text-sm", device === d ? "bg-brand-gradient text-white" : "bg-white text-slate-500 hover:bg-slate-50")}
              title={DEVICES[d].label}
            >
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

      {/* Workspace: palette | canvas | inspector */}
      <div className="grid gap-3 lg:grid-cols-[190px_1fr_300px]">
        {/* Palette */}
        <aside className="rounded-xl border border-slate-200 bg-white p-2">
          <p className="px-1 pb-1 text-[11px] font-semibold uppercase tracking-wide text-slate-400">Blocks</p>
          <p className="px-1 pb-2 text-[11px] text-slate-400">Drag onto the canvas, or click to add.</p>
          {(["Layout", "Content", "Media", "Convert"] as const).map((cat) => (
            <div key={cat} className="mb-2">
              <div className="px-1 py-1 text-[10px] font-semibold uppercase tracking-wide text-slate-300">{cat}</div>
              <div className="grid grid-cols-2 gap-1.5">
                {BLOCK_DEFS.filter((b) => b.category === cat).map((b) => (
                  <button
                    key={b.type}
                    type="button"
                    draggable
                    onDragStart={() => { drag.current = { kind: "new", type: b.type }; }}
                    onDragEnd={() => { drag.current = null; setOverIndex(null); }}
                    onClick={() => insertBlock(b.type, blocks.length)}
                    className="flex cursor-grab flex-col items-center gap-1 rounded-lg border border-slate-200 bg-slate-50 px-1 py-2 text-center hover:border-brand-300 hover:bg-brand-50 active:cursor-grabbing"
                  >
                    <span className="text-brand-600">{b.icon}</span>
                    <span className="text-[11px] text-slate-600">{b.label}</span>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </aside>

        {/* Canvas */}
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-slate-100 p-4">
          <div className="mx-auto rounded-lg bg-white shadow-sm ring-1 ring-slate-200 transition-all" style={{ width: DEVICES[device].width, maxWidth: "100%" }}>
            {blocks.length === 0 ? (
              <div
                onDragOver={(e) => { e.preventDefault(); setOverIndex(0); }}
                onDrop={(e) => { e.preventDefault(); onDrop(0); }}
                className={cn(
                  "m-4 grid place-items-center rounded-xl border-2 border-dashed p-16 text-center text-sm",
                  overIndex === 0 ? "border-brand-400 bg-brand-50 text-brand-600" : "border-slate-200 text-slate-400",
                )}
              >
                Drag a block here, or click one on the left to start building.
              </div>
            ) : (
              <div className="overflow-hidden rounded-lg">
                <DropZone at={0} />
                {blocks.map((block, i) => {
                  const def = blockDef(block.type);
                  const isSel = selected === i;
                  return (
                    <div key={i}>
                      <div
                        draggable
                        onDragStart={() => { drag.current = { kind: "move", from: i }; }}
                        onDragEnd={() => { drag.current = null; setOverIndex(null); }}
                        onClick={() => setSelected(i)}
                        className={cn(
                          "group relative cursor-pointer",
                          isSel ? "ring-2 ring-brand-500" : "hover:ring-2 hover:ring-brand-200",
                        )}
                      >
                        {/* label + controls */}
                        <div className={cn(
                          "pointer-events-none absolute left-2 top-2 z-10 rounded bg-slate-900/80 px-1.5 py-0.5 text-[10px] font-medium text-white",
                          isSel ? "opacity-100" : "opacity-0 group-hover:opacity-100",
                        )}>
                          ⠿ {def?.label ?? block.type}
                        </div>
                        <div className={cn(
                          "absolute right-2 top-2 z-10 flex items-center gap-1 rounded-lg bg-white/95 p-0.5 shadow ring-1 ring-slate-200",
                          isSel ? "opacity-100" : "opacity-0 group-hover:opacity-100",
                        )}>
                          <IconBtn label="Move up" disabled={i === 0} onClick={() => moveBlock(i, i - 1)}>↑</IconBtn>
                          <IconBtn label="Move down" disabled={i === blocks.length - 1} onClick={() => moveBlock(i, i + 2)}>↓</IconBtn>
                          <IconBtn label="Duplicate" onClick={() => duplicateBlock(i)}>⧉</IconBtn>
                          <IconBtn label="Delete" danger onClick={() => removeBlock(i)}>×</IconBtn>
                        </div>
                        <BlockPreview block={block} primaryColor={primaryColor} />
                      </div>
                      <DropZone at={i + 1} />
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Inspector */}
        <aside className="rounded-xl border border-slate-200 bg-white p-3">
          {selectedBlock && selectedDef ? (
            <div>
              <div className="mb-3 flex items-center justify-between">
                <span className="text-sm font-semibold text-slate-800">{selectedDef.icon} {selectedDef.label}</span>
                <button type="button" onClick={() => setSelected(null)} className="text-xs text-slate-400 hover:text-slate-700">Done</button>
              </div>
              <div className="space-y-3">
                {selectedDef.fields.map((f) => (
                  <FieldEditor key={f.k} field={f} block={selectedBlock} calendars={calendars} onChange={(patch) => updateBlock(selected!, patch)} />
                ))}
              </div>
              <div className="mt-4 flex gap-2 border-t border-slate-100 pt-3">
                <button type="button" onClick={() => duplicateBlock(selected!)} className="btn-secondary flex-1 text-xs">Duplicate</button>
                <button type="button" onClick={() => removeBlock(selected!)} className="flex-1 rounded-lg bg-red-50 px-3 py-2 text-xs font-medium text-red-700 hover:bg-red-100">Delete</button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Page settings</p>
              <div>
                <label className="label">Page title</label>
                <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Page title" />
              </div>
              <div>
                <label className="label">Meta title (SEO)</label>
                <input className="input" value={seoTitle} onChange={(e) => setSeoTitle(e.target.value)} placeholder={title} />
              </div>
              <div>
                <label className="label">Meta description (SEO)</label>
                <textarea rows={3} className="input" value={seoDescription} onChange={(e) => setSeoDescription(e.target.value)} placeholder="Up to ~160 characters for search results." />
              </div>
              <p className="rounded-lg bg-slate-50 p-3 text-xs text-slate-500">
                Click any block on the canvas to edit its content here.
              </p>
            </div>
          )}
        </aside>
      </div>
    </form>
  );
}

function IconBtn({ children, onClick, label, disabled, danger }: { children: React.ReactNode; onClick: () => void; label: string; disabled?: boolean; danger?: boolean }) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      disabled={disabled}
      onClick={(e) => { e.stopPropagation(); onClick(); }}
      className={cn(
        "grid h-6 w-6 place-items-center rounded text-slate-500 hover:bg-slate-100 disabled:opacity-30",
        danger ? "hover:bg-red-100 hover:text-red-600" : "hover:text-slate-800",
      )}
    >
      {children}
    </button>
  );
}

function SaveButton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn-primary text-sm" disabled={pending} aria-busy={pending}>
      {pending ? "Saving…" : "Save"}
    </button>
  );
}
