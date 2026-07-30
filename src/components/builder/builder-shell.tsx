"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useFormState } from "react-dom";
import { updatePageAction, publishSiteAction } from "@/app/dashboard/l/[locationId]/website/actions";
import { BLOCK_DEFS, blockDef } from "@/lib/site-blocks-catalog";
import { ELEMENT_DEFS, elementDef } from "@/lib/site-elements";
import { BlockPreview } from "@/components/site-block-preview";
import { SiteElement } from "@/components/site-element";
import { FieldEditor } from "@/components/site-field-editor";

/* Placid Builder — Phase 2/3: real page editing inside the Phase-1 dark shell.
   Renders the live blocks via the SAME components as the public site (canvas ==
   published), with selection → inspector + ancestry breadcrumb, a live inspector,
   and click/drag-to-add from the palette. Saves via updatePageAction. */

type El = { type: string } & Record<string, unknown>;
type Col = { width?: number; elements?: El[] };
type AnyBlock = { type: string; columns?: Col[] } & Record<string, unknown>;
type Sel = { b: number; c?: number; e?: number } | null;
type PanelKey = "add" | "layers" | "pages" | "settings";
type Device = "desktop" | "tablet" | "mobile";
type CT = "sec" | "row" | "col" | "el";

const DEVICES: Record<Device, string> = { desktop: "Desktop · 1180px", tablet: "Tablet · 768px", mobile: "Mobile · 390px" };
const KC: Record<CT, string> = { sec: "var(--sec)", row: "var(--row)", col: "var(--col)", el: "var(--sel)" };
const newRow = (n: number): AnyBlock => ({ type: "row", columns: Array.from({ length: n }, () => ({ elements: [] as El[] })) });
const newEl = (t: string): El => ({ type: t, ...structuredClone(elementDef(t)?.default ?? {}) });

export function BuilderShell({
  locationId, locationName, slug, primaryColor, published, calendars, pages, page,
}: {
  locationId: string; locationName: string; slug: string; primaryColor: string; published: boolean;
  calendars: { id: string; name: string }[];
  pages: { id: string; title: string; isHome: boolean }[];
  page: { id: string; title: string; slug: string; isHome: boolean; blocks: unknown; seoTitle: string | null; seoDescription: string | null };
}) {
  const [state, formAction] = useFormState(updatePageAction, { error: "", ok: false } as { error: string; ok?: boolean });
  // History-backed blocks (undo/redo). setBlocks keeps the same (value|updater)
  // signature so every mutation helper records an undo step automatically.
  const [hist, setHist] = useState<{ past: AnyBlock[][]; present: AnyBlock[]; future: AnyBlock[][] }>(() => ({
    past: [], present: Array.isArray(page.blocks) ? (page.blocks as AnyBlock[]) : [], future: [],
  }));
  const blocks = hist.present;
  const setBlocks = (updater: AnyBlock[] | ((b: AnyBlock[]) => AnyBlock[])) =>
    setHist((h) => {
      const next = typeof updater === "function" ? (updater as (b: AnyBlock[]) => AnyBlock[])(h.present) : updater;
      if (next === h.present) return h;
      return { past: [...h.past, h.present].slice(-50), present: next, future: [] };
    });
  const undo = () => setHist((h) => (h.past.length ? { past: h.past.slice(0, -1), present: h.past[h.past.length - 1], future: [h.present, ...h.future].slice(0, 50) } : h));
  const redo = () => setHist((h) => (h.future.length ? { past: [...h.past, h.present], present: h.future[0], future: h.future.slice(1) } : h));
  const canUndo = hist.past.length > 0;
  const canRedo = hist.future.length > 0;
  const [saveState, setSaveState] = useState<"saved" | "saving">("saved");
  const [title, setTitle] = useState(page.title);
  const [seoTitle, setSeoTitle] = useState(page.seoTitle ?? "");
  const [seoDescription, setSeoDescription] = useState(page.seoDescription ?? "");
  const [sel, setSel] = useState<Sel>(null);
  const [device, setDevice] = useState<Device>("desktop");
  const [panel, setPanel] = useState<PanelKey>("add");
  const [tab, setTab] = useState<"content" | "style">("content");
  const [over, setOver] = useState<{ b: number; c: number } | null>(null);
  const [overTop, setOverTop] = useState<number | null>(null);
  const drag = useRef<{ kind: "el" | "row" | "block"; type?: string; n?: number } | null>(null);

  // ---- mutations ----
  const insertBlock = (type: string, at = blocks.length) => { const d = blockDef(type); if (!d) return; setBlocks((b) => { const c = [...b]; c.splice(at, 0, { type, ...structuredClone(d.default) } as AnyBlock); return c; }); setSel({ b: at }); };
  const insertRow = (n: number, at = blocks.length) => { setBlocks((b) => { const c = [...b]; c.splice(at, 0, newRow(n)); return c; }); setSel({ b: at }); };
  const insertElAsRow = (t: string, at = blocks.length) => { const r = newRow(1); r.columns![0].elements = [newEl(t)]; setBlocks((b) => { const c = [...b]; c.splice(at, 0, r); return c; }); setSel({ b: at, c: 0, e: 0 }); };
  const updateBlock = (i: number, patch: Record<string, unknown>) => setBlocks((b) => b.map((x, k) => (k === i ? { ...x, ...patch } : x)));
  const moveBlock = (from: number, to: number) => setBlocks((b) => { const c = [...b]; const [it] = c.splice(from, 1); c.splice(from < to ? to - 1 : to, 0, it); return c; });
  const dupBlock = (i: number) => setBlocks((b) => { const c = [...b]; c.splice(i + 1, 0, structuredClone(b[i])); return c; });
  const delBlock = (i: number) => { setBlocks((b) => b.filter((_, k) => k !== i)); setSel(null); };
  const editCol = (b: number, c: number, fn: (col: Col) => Col) => setBlocks((bs) => bs.map((blk, bi) => (bi !== b ? blk : { ...blk, columns: (blk.columns ?? []).map((col, ci) => (ci !== c ? col : fn(col))) })));
  const addEl = (b: number, c: number, t: string) => { editCol(b, c, (col) => ({ ...col, elements: [...(col.elements ?? []), newEl(t)] })); setSel({ b, c, e: blocks[b]?.columns?.[c]?.elements?.length ?? 0 }); };
  const updateEl = (b: number, c: number, e: number, patch: Record<string, unknown>) => editCol(b, c, (col) => ({ ...col, elements: (col.elements ?? []).map((x, k) => (k === e ? { ...x, ...patch } : x)) }));
  const moveEl = (b: number, c: number, e: number, dir: -1 | 1) => editCol(b, c, (col) => { const els = [...(col.elements ?? [])]; const j = e + dir; if (j < 0 || j >= els.length) return col; [els[e], els[j]] = [els[j], els[e]]; return { ...col, elements: els }; });
  const dupEl = (b: number, c: number, e: number) => editCol(b, c, (col) => { const els = [...(col.elements ?? [])]; els.splice(e + 1, 0, structuredClone(els[e])); return { ...col, elements: els }; });
  const delEl = (b: number, c: number, e: number) => { editCol(b, c, (col) => ({ ...col, elements: (col.elements ?? []).filter((_, k) => k !== e) })); setSel({ b, c }); };
  const addCol = (b: number) => setBlocks((bs) => bs.map((blk, bi) => (bi !== b ? blk : { ...blk, columns: [...(blk.columns ?? []), { elements: [] }] })));
  const delCol = (b: number, c: number) => setBlocks((bs) => bs.map((blk, bi) => (bi !== b ? blk : { ...blk, columns: (blk.columns ?? []).filter((_, k) => k !== c) })));

  const dropOnCol = (b: number, c: number) => { const d = drag.current; drag.current = null; setOver(null); if (d?.kind === "el" && d.type) addEl(b, c, d.type); };
  // Top-level canvas drop: auto-wraps a bare element into a Row → Column.
  const onTopDrop = (at: number) => {
    const d = drag.current; drag.current = null; setOverTop(null); setOver(null);
    if (!d) return;
    if (d.kind === "row") insertRow(d.n ?? 1, at);
    else if (d.kind === "el" && d.type) insertElAsRow(d.type, at);
    else if (d.kind === "block" && d.type) insertBlock(d.type, at);
  };
  const topDrop = (at: number) => (
    <div key={"td" + at} onDragOver={(e) => { e.preventDefault(); setOverTop(at); }} onDragLeave={() => setOverTop((v) => (v === at ? null : v))} onDrop={(e) => { e.preventDefault(); onTopDrop(at); }}
      style={{ height: overTop === at ? 34 : 12, transition: "height .1s" }} className="relative">
      {overTop === at ? (
        <div style={{ position: "absolute", left: 8, right: 8, top: "50%", transform: "translateY(-50%)", height: 3, background: "var(--drop)", borderRadius: 2, boxShadow: "0 0 0 4px var(--drop-soft)" }}>
          <span style={{ position: "absolute", left: "50%", top: -18, transform: "translateX(-50%)", background: "var(--drop)", color: "#2A0512", fontFamily: "var(--mono)", fontSize: 9, letterSpacing: ".06em", padding: "2px 7px", borderRadius: 4, whiteSpace: "nowrap" }}>DROP HERE</span>
        </div>
      ) : null}
    </div>
  );
  const setElStyle = (k: string, v: unknown) => {
    if (!sel || sel.c == null || sel.e == null) return;
    const cur = ((blocks[sel.b]?.columns?.[sel.c]?.elements?.[sel.e]?.style) as Record<string, unknown>) ?? {};
    updateEl(sel.b, sel.c, sel.e, { style: { ...cur, [k]: v } });
  };

  // Autosave — 2s debounce after any change to blocks/title/SEO.
  const firstRun = useRef(true);
  useEffect(() => {
    if (firstRun.current) { firstRun.current = false; return; }
    setSaveState("saving");
    const t = setTimeout(async () => {
      const fd = new FormData();
      fd.set("locationId", locationId); fd.set("pageId", page.id);
      fd.set("blocks", JSON.stringify(blocks)); fd.set("title", title);
      fd.set("seoTitle", seoTitle); fd.set("seoDescription", seoDescription);
      try { await updatePageAction({ error: "", ok: false }, fd); } catch { /* keep last state */ }
      setSaveState("saved");
    }, 2000);
    return () => clearTimeout(t);
  }, [blocks, title, seoTitle, seoDescription, locationId, page.id]);

  // Undo / redo keyboard shortcuts.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "z") { e.preventDefault(); if (e.shiftKey) redo(); else undo(); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // ---- derived: selection kind/name/chain ----
  const selBlock = sel ? blocks[sel.b] : null;
  const selEl = sel && sel.c != null && sel.e != null ? blocks[sel.b]?.columns?.[sel.c]?.elements?.[sel.e] : null;
  const chain: { t: CT; name: string }[] = (() => {
    if (!sel || !selBlock) return [];
    if (selBlock.type === "row") {
      const out: { t: CT; name: string }[] = [{ t: "row", name: "Row" }];
      if (sel.c != null) out.push({ t: "col", name: `Column ${sel.c + 1}` });
      if (selEl) out.push({ t: "el", name: elementDef(selEl.type)?.label ?? "Element" });
      return out;
    }
    return [{ t: "sec", name: blockDef(selBlock.type)?.label ?? selBlock.type }];
  })();
  const inspKind = selEl ? "Element" : selBlock?.type === "row" ? (sel?.c != null ? "Column" : "Row") : selBlock ? "Section" : "Page";
  const inspName = selEl ? (elementDef(selEl.type)?.label ?? selEl.type) : selBlock?.type === "row" ? (sel?.c != null ? `Column ${sel!.c! + 1}` : "Row") : selBlock ? (blockDef(selBlock.type)?.label ?? selBlock.type) : title;

  const Tools = ({ up, down, dup, del }: { up?: () => void; down?: () => void; dup: () => void; del: () => void }) => (
    <div className="pb-el-tools" onClick={(e) => e.stopPropagation()}>
      {up && <button type="button" title="Move up" onClick={up}>↑</button>}
      {down && <button type="button" title="Move down" onClick={down}>↓</button>}
      <button type="button" title="Duplicate" onClick={dup}>⧉</button>
      <button type="button" className="pb-danger" title="Delete" onClick={del}>✕</button>
    </div>
  );

  return (
    <form className="pb-app" action={formAction}>
      <input type="hidden" name="locationId" value={locationId} />
      <input type="hidden" name="pageId" value={page.id} />
      <input type="hidden" name="blocks" value={JSON.stringify(blocks)} />
      <input type="hidden" name="title" value={title} />
      <input type="hidden" name="seoTitle" value={seoTitle} />
      <input type="hidden" name="seoDescription" value={seoDescription} />

      {/* TOP BAR */}
      <header className="pb-topbar">
        <div className="pb-brand">
          <div className="pb-brand-mark">P</div>
          <div className="pb-crumb"><span>Sites</span><span className="pb-sep">/</span><span>{locationName}</span><span className="pb-sep">/</span><b>{title}</b></div>
        </div>
        <div className="pb-spacer" />
        <div className="pb-seg">
          {(Object.keys(DEVICES) as Device[]).map((d) => (
            <button key={d} type="button" aria-pressed={device === d} onClick={() => setDevice(d)} title={d}>
              {d === "desktop" ? "🖥" : d === "tablet" ? "▭" : "▯"}<span className="pb-w">{d === "desktop" ? "1180" : d === "tablet" ? "768" : "390"}</span>
            </button>
          ))}
        </div>
        <div style={{ display: "flex", gap: 2 }}>
          <button type="button" className="pb-icon-btn" title="Undo (⌘Z)" disabled={!canUndo} onClick={undo}>↺</button>
          <button type="button" className="pb-icon-btn" title="Redo (⇧⌘Z)" disabled={!canRedo} onClick={redo}>↻</button>
        </div>
        <div className="pb-save"><span className="pb-dot" style={{ background: saveState === "saving" ? "#F2B441" : "var(--sel)" }} /> {saveState === "saving" ? "Saving…" : "Saved"}</div>
        <Link href={`/dashboard/l/${locationId}/website`} className="pb-ghost">Exit</Link>
        <button type="submit" formAction={publishSiteAction} className="pb-primary" title={published ? "Re-publish" : "Publish live"}>Publish</button>
      </header>

      {/* RAIL */}
      <nav className="pb-rail">
        {([["add", "＋", "Add elements"], ["layers", "◈", "Layers"], ["pages", "🗎", "Pages"]] as [PanelKey, string, string][]).map(([k, ic, lb]) => (
          <button key={k} type="button" aria-pressed={panel === k} onClick={() => setPanel(k)}><span style={{ fontSize: 16 }}>{ic}</span><span className="pb-rail-label">{lb}</span></button>
        ))}
        <div className="pb-rspace" />
        <button type="button" aria-pressed={panel === "settings"} onClick={() => { setPanel("settings"); setSel(null); }}><span style={{ fontSize: 16 }}>⚙</span><span className="pb-rail-label">Page settings</span></button>
      </nav>

      {/* PANEL */}
      <aside className="pb-panel">
        <div className="pb-panel-head"><h2>{panel === "add" ? "Add elements" : panel === "layers" ? "Layers" : panel === "pages" ? "Pages" : "Page settings"}</h2></div>
        <div className="pb-panel-scroll">
          {panel === "add" && (
            <>
              <div className="pb-group pb-mono">Rows</div>
              <div className="pb-tiles">
                {[1, 2, 3, 4, 5, 6].map((n) => (
                  <div key={n} className="pb-tile" draggable onDragStart={() => (drag.current = { kind: "row", n })} onDragEnd={() => (drag.current = null)} onClick={() => insertRow(n)}>
                    <span style={{ fontSize: 15 }}>▥</span>{n} col
                  </div>
                ))}
              </div>
              <div className="pb-group pb-mono">Elements</div>
              <div className="pb-tiles">
                {ELEMENT_DEFS.map((el) => (
                  <div key={el.type} className="pb-tile" draggable onDragStart={() => (drag.current = { kind: "el", type: el.type })} onDragEnd={() => (drag.current = null)}
                    onClick={() => (sel?.c != null ? addEl(sel.b, sel.c, el.type) : insertElAsRow(el.type))} title={`Add ${el.label}`}>
                    <span style={{ fontSize: 15 }}>{el.icon}</span>{el.label}
                  </div>
                ))}
              </div>
              <div className="pb-group pb-mono">Sections</div>
              <div className="pb-tiles">
                {BLOCK_DEFS.map((b) => (
                  <div key={b.type} className="pb-tile" draggable
                    onDragStart={() => (drag.current = { kind: "block", type: b.type })}
                    onDragEnd={() => { drag.current = null; setOverTop(null); }}
                    onClick={() => insertBlock(b.type)} title={`Add ${b.label} section`}>
                    <span style={{ fontSize: 15 }}>{b.icon}</span>{b.label}
                  </div>
                ))}
              </div>
            </>
          )}
          {panel === "layers" && (
            <div className="pb-tree">
              {blocks.length === 0 ? <p className="pb-hint">Empty page — add a row or section.</p> : blocks.map((blk, i) => (
                <div key={i}>
                  <div className={`pb-node ${sel?.b === i && sel.c == null ? "pb-on" : ""}`} onClick={() => setSel({ b: i })}>
                    <span className="pb-kind" style={{ background: blk.type === "row" ? KC.row : KC.sec }} />
                    <span className="pb-nname">{blk.type === "row" ? `Row · ${(blk.columns ?? []).length} col` : blockDef(blk.type)?.label ?? blk.type}</span>
                  </div>
                  {blk.type === "row" && (blk.columns ?? []).map((col, c) => (col.elements ?? []).map((el, e) => (
                    <div key={`${c}-${e}`} className={`pb-node pb-d2 ${sel?.b === i && sel.c === c && sel.e === e ? "pb-on" : ""}`} onClick={() => setSel({ b: i, c, e })}>
                      <span className="pb-kind" style={{ background: KC.el }} /><span className="pb-nname">{elementDef(el.type)?.label ?? el.type}</span>
                    </div>
                  )))}
                </div>
              ))}
            </div>
          )}
          {panel === "pages" && (
            <div style={{ padding: "8px 4px" }}>
              {pages.map((p) => (
                <a key={p.id} href={`/build/${locationId}?page=${p.id}`} className={`pb-node ${p.id === page.id ? "pb-on" : ""}`}>
                  <span className="pb-kind" style={{ background: KC.sec }} /><span className="pb-nname">{p.isHome ? "⌂ " : ""}{p.title}</span>
                </a>
              ))}
            </div>
          )}
          {panel === "settings" && (
            <div style={{ padding: "12px 4px", display: "grid", gap: 12 }}>
              <div><label className="label">Page title</label><input className="input" value={title} onChange={(e) => setTitle(e.target.value)} /></div>
              <div><label className="label">Meta title (SEO)</label><input className="input" value={seoTitle} onChange={(e) => setSeoTitle(e.target.value)} placeholder={title} /></div>
              <div><label className="label">Meta description</label><textarea className="input" rows={3} value={seoDescription} onChange={(e) => setSeoDescription(e.target.value)} /></div>
            </div>
          )}
        </div>
      </aside>

      {/* CANVAS */}
      <main className="pb-canvas" onClick={() => setSel(null)}>
        <div className="pb-device" data-bp={device}>
          <div className="pb-device-tag pb-mono"><span>{DEVICES[device]}</span></div>
          <div className="pb-page" onClick={(e) => e.stopPropagation()} onClickCapture={(e) => { const a = (e.target as HTMLElement).closest("a"); if (a) e.preventDefault(); }}>
            {blocks.length === 0 ? (
              <div className="pb-el-empty" style={{ margin: 24, padding: 48, borderColor: overTop === 0 ? "var(--drop)" : undefined, background: overTop === 0 ? "var(--drop-soft)" : undefined }}
                onDragOver={(e) => { e.preventDefault(); setOverTop(0); }} onDragLeave={() => setOverTop(null)} onDrop={(e) => { e.preventDefault(); onTopDrop(0); }}>
                Drag any element, row or section here — or click one on the left.
              </div>
            ) : (
              <>
              {blocks.map((block, i) => (
              <div key={i}>
                {topDrop(i)}
                {block.type === "row" ? (
                  <div className={`pb-el ${sel?.b === i && sel.c == null ? "pb-on" : ""}`} data-kind="Row" onClick={(e) => { e.stopPropagation(); setSel({ b: i }); }}>
                    <Tools up={i > 0 ? () => moveBlock(i, i - 1) : undefined} down={i < blocks.length - 1 ? () => moveBlock(i, i + 2) : undefined} dup={() => dupBlock(i)} del={() => delBlock(i)} />
                    <div style={{ display: "flex", gap: 12, padding: 12 }}>
                      {(block.columns ?? []).map((col, c) => (
                        <div key={c} className={`pb-colwrap ${over && over.b === i && over.c === c ? "pb-over" : ""}`} style={{ flex: col.width || 1, minHeight: 40, padding: 6 }}
                          onClick={(e) => { e.stopPropagation(); setSel({ b: i, c }); }}
                          onDragOver={(e) => { e.preventDefault(); setOver({ b: i, c }); }} onDragLeave={() => setOver((v) => (v && v.b === i && v.c === c ? null : v))} onDrop={(e) => { e.preventDefault(); dropOnCol(i, c); }}>
                          {(col.elements ?? []).length === 0 ? <div className="pb-el-empty">Drop elements here</div> : (col.elements ?? []).map((el, e) => (
                            <div key={e} className={`pb-el ${sel?.b === i && sel.c === c && sel.e === e ? "pb-on" : ""}`} data-kind={elementDef(el.type)?.label ?? el.type} onClick={(ev) => { ev.stopPropagation(); setSel({ b: i, c, e }); }}>
                              <Tools up={e > 0 ? () => moveEl(i, c, e, -1) : undefined} down={e < (col.elements ?? []).length - 1 ? () => moveEl(i, c, e, 1) : undefined} dup={() => dupEl(i, c, e)} del={() => delEl(i, c, e)} />
                              <SiteElement element={el} primaryColor={primaryColor} />
                            </div>
                          ))}
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className={`pb-el ${sel?.b === i && sel.c == null ? "pb-on" : ""}`} data-kind={blockDef(block.type)?.label ?? block.type} onClick={(e) => { e.stopPropagation(); setSel({ b: i }); }}>
                    <Tools up={i > 0 ? () => moveBlock(i, i - 1) : undefined} down={i < blocks.length - 1 ? () => moveBlock(i, i + 2) : undefined} dup={() => dupBlock(i)} del={() => delBlock(i)} />
                    <BlockPreview block={block} primaryColor={primaryColor} />
                  </div>
                )}
              </div>
              ))}
              {topDrop(blocks.length)}
              </>
            )}
          </div>
        </div>
      </main>

      {/* INSPECTOR */}
      <aside className="pb-inspector">
        <div className="pb-insp-head">
          <div className="pb-insp-title"><span className="pb-kindchip">{inspKind}</span><h2>{inspName}</h2></div>
          {(selEl || (selBlock && selBlock.type !== "row")) && (
            <div className="pb-tabs">
              {(["content", "style"] as const).map((t) => <button key={t} type="button" aria-pressed={tab === t} onClick={() => setTab(t)}>{t[0].toUpperCase() + t.slice(1)}</button>)}
            </div>
          )}
        </div>
        <div className="pb-insp-scroll">
          {selEl ? (
            <div className="pb-block">
              {tab === "style" ? (
                <StyleControls st={(selEl.style as Record<string, unknown>) ?? {}} set={setElStyle} />
              ) : (
                <>
                  <h3>Content</h3>
                  <div style={{ display: "grid", gap: 10 }}>
                    {(elementDef(selEl.type)?.fields ?? []).map((f) => (
                      <FieldEditor key={f.k} field={f} block={selEl} calendars={calendars} onChange={(patch) => updateEl(sel!.b, sel!.c!, sel!.e!, patch)} />
                    ))}
                  </div>
                </>
              )}
              <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
                <button type="button" className="btn-secondary" style={{ flex: 1, fontSize: 12 }} onClick={() => dupEl(sel!.b, sel!.c!, sel!.e!)}>Duplicate</button>
                <button type="button" style={{ flex: 1, fontSize: 12, background: "rgba(255,107,107,.15)", color: "#FF9B9B", borderRadius: 6, padding: "7px" }} onClick={() => delEl(sel!.b, sel!.c!, sel!.e!)}>Delete</button>
              </div>
            </div>
          ) : selBlock && selBlock.type === "row" && sel?.c == null ? (
            <div className="pb-block">
              <h3>Row</h3>
              <p className="pb-hint" style={{ padding: 0, marginBottom: 10 }}>{(selBlock.columns ?? []).length} column(s). Click a column, then add elements from the left.</p>
              <div style={{ display: "flex", gap: 8 }}>
                <button type="button" className="btn-secondary" style={{ flex: 1, fontSize: 12 }} onClick={() => addCol(sel!.b)}>+ Column</button>
                {(selBlock.columns ?? []).length > 1 && <button type="button" className="btn-secondary" style={{ flex: 1, fontSize: 12 }} onClick={() => delCol(sel!.b, (selBlock.columns ?? []).length - 1)}>− Column</button>}
              </div>
              <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
                <button type="button" className="btn-secondary" style={{ flex: 1, fontSize: 12 }} onClick={() => dupBlock(sel!.b)}>Duplicate</button>
                <button type="button" style={{ flex: 1, fontSize: 12, background: "rgba(255,107,107,.15)", color: "#FF9B9B", borderRadius: 6, padding: "7px" }} onClick={() => delBlock(sel!.b)}>Delete</button>
              </div>
            </div>
          ) : selBlock ? (
            <div className="pb-block">
              <h3>Content</h3>
              <div style={{ display: "grid", gap: 10 }}>
                {(blockDef(selBlock.type)?.fields ?? []).map((f) => (
                  <FieldEditor key={f.k} field={f} block={selBlock} calendars={calendars} onChange={(patch) => updateBlock(sel!.b, patch)} />
                ))}
              </div>
              <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
                <button type="button" className="btn-secondary" style={{ flex: 1, fontSize: 12 }} onClick={() => dupBlock(sel!.b)}>Duplicate</button>
                <button type="button" style={{ flex: 1, fontSize: 12, background: "rgba(255,107,107,.15)", color: "#FF9B9B", borderRadius: 6, padding: "7px" }} onClick={() => delBlock(sel!.b)}>Delete</button>
              </div>
            </div>
          ) : (
            <p className="pb-hint">Click any element on the canvas to edit it here. Add rows &amp; elements from the left — changes <b>auto-save</b>; hit <b>Publish</b> to go live.</p>
          )}
        </div>
      </aside>

      {/* STATUS BAR */}
      <footer className="pb-status">
        <div className="pb-path">
          {chain.length === 0 ? <span className="pb-mono" style={{ color: "var(--text-lo)" }}>Nothing selected</span> : chain.map((c, i) => (
            <span key={i} style={{ display: "contents" }}>
              {i > 0 && <span className="pb-arrow">›</span>}
              <span className={`pb-chip ${i === chain.length - 1 ? "pb-on" : ""}`}><span className="pb-kind" style={{ background: KC[c.t] }} />{c.name}</span>
            </span>
          ))}
        </div>
        <div className="pb-status-right">
          {state?.error ? <span className="pb-mono" style={{ color: "var(--danger)" }}>{state.error}</span> : null}
          <span className="pb-mono">{blocks.length} block(s)</span>
          <span className="pb-mono">/{slug}</span>
        </div>
      </footer>
    </form>
  );
}

function StyleControls({ st, set }: { st: Record<string, unknown>; set: (k: string, v: unknown) => void }) {
  const v = (k: string) => (st[k] == null ? "" : String(st[k]));
  const pad = (k: string, label: string) => (
    <div key={k}><label className="pb-unit" style={{ display: "block", marginBottom: 2 }}>{label}</label><input type="number" value={v(k)} onChange={(e) => set(k, e.target.value)} className="pb-control" style={{ padding: "5px 7px" }} /></div>
  );
  return (
    <>
      <h3>Style</h3>
      <div style={{ display: "grid", gap: 10 }}>
        <div className="pb-field"><label>Align</label>
          <div style={{ display: "flex", gap: 4 }}>
            {(["left", "center", "right"] as const).map((a) => (
              <button key={a} type="button" onClick={() => set("align", a)} className="pb-bp-chip" aria-pressed={st.align === a} style={{ textTransform: "capitalize" }}>{a}</button>
            ))}
          </div>
        </div>
        <div className="pb-field"><label>Background</label>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <input type="color" value={v("bg") || "#ffffff"} onChange={(e) => set("bg", e.target.value)} style={{ width: 30, height: 26, padding: 0, border: "none", background: "none", cursor: "pointer" }} />
            <button type="button" className="pb-unit" onClick={() => set("bg", "")}>clear</button>
          </div>
        </div>
        <div className="pb-field"><label>Text colour</label>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <input type="color" value={v("color") || "#12161C"} onChange={(e) => set("color", e.target.value)} style={{ width: 30, height: 26, padding: 0, border: "none", background: "none", cursor: "pointer" }} />
            <button type="button" className="pb-unit" onClick={() => set("color", "")}>clear</button>
          </div>
        </div>
        <div className="pb-field"><label>Radius</label><div className="pb-stepper"><input type="number" value={v("radius")} onChange={(e) => set("radius", e.target.value)} /><span>PX</span></div></div>
        <div className="pb-field"><label>Max width</label><div className="pb-stepper"><input type="number" value={v("maxWidth")} placeholder="full" onChange={(e) => set("maxWidth", e.target.value)} /><span>PX</span></div></div>
      </div>

      <h3 style={{ marginTop: 16 }}>Spacing <span className="pb-unit">px</span></h3>
      <div className="pb-box">
        <div className="pb-bm-tag" style={{ marginBottom: 6 }}>PADDING</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 6 }}>
          {pad("padTop", "Top")}{pad("padRight", "Right")}{pad("padBottom", "Bottom")}{pad("padLeft", "Left")}
        </div>
        <div className="pb-bm-tag" style={{ margin: "10px 0 6px" }}>MARGIN</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
          {pad("marginTop", "Top")}{pad("marginBottom", "Bottom")}
        </div>
      </div>
    </>
  );
}
