"use client";

import { useState } from "react";
import Link from "next/link";

/* Placid Builder — Phase 1 shell (static chrome, demo content).
   Matches docs/builder-ui-spec.md geometry + two-signal colour system.
   Phases 2+ replace the demo page with the real node-tree renderer + dnd-kit. */

type PanelKey = "add" | "sections" | "layers" | "pages" | "theme" | "media" | "settings";
type Device = "desktop" | "tablet" | "mobile";
type Crumb = { t: "sec" | "row" | "col" | "el"; name: string };
type Sel = { key: string; kind: string; name: string; chain: Crumb[] };

const DEVICES: Record<Device, string> = { desktop: "Desktop · 1180px", tablet: "Tablet · 768px", mobile: "Mobile · 390px" };
const KIND_COLOR: Record<Crumb["t"], string> = { sec: "var(--sec)", row: "var(--row)", col: "var(--col)", el: "var(--sel)" };

const TILE_GROUPS: { label: string; items: { icon: string; name: string }[] }[] = [
  { label: "Layout", items: [
    { icon: "▭", name: "Section" }, { icon: "☰", name: "Row" }, { icon: "▥", name: "Columns" },
    { icon: "—", name: "Divider" }, { icon: "↕", name: "Spacer" }, { icon: "▦", name: "Grid" } ] },
  { label: "Basic", items: [
    { icon: "¶", name: "Text" }, { icon: "H", name: "Heading" }, { icon: "⬛", name: "Button" },
    { icon: "▣", name: "Image" }, { icon: "▶", name: "Video" }, { icon: "◷", name: "Countdown" } ] },
  { label: "CRM & Convert", items: [
    { icon: "✎", name: "Form" }, { icon: "📅", name: "Calendar" }, { icon: "💬", name: "Chat" },
    { icon: "💳", name: "Payment" }, { icon: "★", name: "Reviews" }, { icon: "▤", name: "Directory" } ] },
  { label: "Commerce", items: [
    { icon: "🛍", name: "Product" }, { icon: "🛒", name: "Cart" }, { icon: "▦", name: "Collection" },
    { icon: "⭐", name: "Featured" }, { icon: "＋", name: "Upsell" }, { icon: "🧾", name: "Checkout" } ] },
  { label: "Advanced", items: [
    { icon: "</>", name: "HTML" }, { icon: "🗺", name: "Map" }, { icon: "▪", name: "QR" },
    { icon: "◎", name: "Social" }, { icon: "≡", name: "Nav" }, { icon: "{}", name: "Code" } ] },
];

const LAYERS: { d: number; t: Crumb["t"]; name: string; key?: string }[] = [
  { d: 0, t: "sec", name: "Header · Global" },
  { d: 0, t: "sec", name: "Section · Hero" },
  { d: 1, t: "row", name: "Row · 1 column" },
  { d: 2, t: "col", name: "Column · 100%" },
  { d: 3, t: "el", name: 'Heading · "Utes, vans…"', key: "h1" },
  { d: 3, t: "el", name: "Text · Subheading", key: "sub" },
  { d: 3, t: "el", name: 'Button · "Check availability"', key: "btn" },
  { d: 0, t: "sec", name: "Section · Why Placid" },
  { d: 0, t: "sec", name: "Section · Enquiry form" },
  { d: 0, t: "sec", name: "Footer · Global" },
];

const HERO_CHAIN: Crumb[] = [{ t: "sec", name: "Hero" }, { t: "row", name: "Row" }, { t: "col", name: "Column 100%" }];

export function BuilderShell({ locationId, locationName, slug }: { locationId: string; locationName: string; slug: string }) {
  const [panel, setPanel] = useState<PanelKey>("add");
  const [device, setDevice] = useState<Device>("desktop");
  const [tab, setTab] = useState<"content" | "style" | "advanced">("content");
  const [sel, setSel] = useState<Sel>({ key: "btn", kind: "Button", name: "Check availability", chain: [...HERO_CHAIN, { t: "el", name: "Button" }] });

  const pick = (key: string, kind: string, name: string, chain: Crumb[]) => (e: React.MouseEvent) => {
    e.stopPropagation();
    setSel({ key, kind, name, chain });
  };

  const Tools = ({ withMove = true }: { withMove?: boolean }) => (
    <div className="pb-el-tools">
      {withMove && <button title="Move up">↑</button>}
      {withMove && <button title="Move down">↓</button>}
      <button title="Duplicate">⧉</button>
      <button title="Save to library">☆</button>
      <button className="pb-danger" title="Delete">✕</button>
    </div>
  );

  return (
    <div className="pb-app">
      {/* TOP BAR */}
      <header className="pb-topbar">
        <div className="pb-brand">
          <div className="pb-brand-mark">P</div>
          <div className="pb-crumb">
            <span>Sites</span><span className="pb-sep">/</span>
            <span>{locationName}</span><span className="pb-sep">/</span>
            <b>Home</b> <span className="pb-sep">▾</span>
          </div>
        </div>
        <div className="pb-spacer" />
        <div className="pb-seg">
          {(Object.keys(DEVICES) as Device[]).map((d) => (
            <button key={d} aria-pressed={device === d} onClick={() => setDevice(d)} title={d}>
              {d === "desktop" ? "🖥" : d === "tablet" ? "▭" : "▯"}
              <span className="pb-w">{d === "desktop" ? "1180" : d === "tablet" ? "768" : "390"}</span>
            </button>
          ))}
        </div>
        <div style={{ display: "flex", gap: 2 }}>
          <button className="pb-icon-btn" title="Undo">↺</button>
          <button className="pb-icon-btn" disabled title="Redo">↻</button>
        </div>
        <div className="pb-save"><span className="pb-dot" /> Saved</div>
        <Link href={`/dashboard/l/${locationId}/website`} className="pb-ghost">Exit</Link>
        <button className="pb-ghost">Preview</button>
        <button className="pb-primary">Publish</button>
      </header>

      {/* LEFT RAIL */}
      <nav className="pb-rail">
        {([
          ["add", "＋", "Add elements"], ["sections", "▤", "Section library"], ["layers", "◈", "Layers"],
          ["pages", "🗎", "Pages"], ["theme", "◐", "Theme & brand"], ["media", "🖼", "Media"],
        ] as [PanelKey, string, string][]).map(([k, icon, label]) => (
          <button key={k} aria-pressed={panel === k} onClick={() => setPanel(k)}>
            <span style={{ fontSize: 16 }}>{icon}</span>
            <span className="pb-rail-label">{label}</span>
          </button>
        ))}
        <div className="pb-rspace" />
        <button aria-pressed={panel === "settings"} onClick={() => setPanel("settings")}>
          <span style={{ fontSize: 16 }}>⚙</span><span className="pb-rail-label">Page settings</span>
        </button>
      </nav>

      {/* LEFT PANEL */}
      <aside className="pb-panel">
        <div className="pb-panel-head">
          <h2>{panel === "add" ? "Add elements" : panel === "layers" ? "Layers" : panel === "sections" ? "Section library" : panel === "pages" ? "Pages" : panel === "theme" ? "Theme & brand" : panel === "media" ? "Media" : "Page settings"}</h2>
          <button className="pb-icon-btn" title="Collapse">‹</button>
        </div>
        {(panel === "add" || panel === "sections") && (
          <div className="pb-search">
            <span style={{ color: "var(--text-lo)" }}>⌕</span>
            <input placeholder={panel === "add" ? "Search elements" : "Search sections"} />
          </div>
        )}
        <div className="pb-panel-scroll">
          {panel === "add" && TILE_GROUPS.map((g) => (
            <div key={g.label}>
              <div className="pb-group pb-mono">{g.label}</div>
              <div className="pb-tiles">
                {g.items.map((it) => (
                  <div key={it.name} className="pb-tile" draggable title={`Drag ${it.name} onto the canvas`}>
                    <span style={{ fontSize: 15 }}>{it.icon}</span>{it.name}
                  </div>
                ))}
              </div>
            </div>
          ))}
          {panel === "layers" && (
            <div className="pb-tree">
              {LAYERS.map((n, i) => (
                <div key={i} className={`pb-node pb-d${n.d} ${n.key === sel.key ? "pb-on" : ""}`}
                  onClick={() => n.key && setSel({ key: n.key, kind: n.name.split(" · ")[0], name: n.name, chain: [...HERO_CHAIN, { t: "el", name: n.name }] })}>
                  <span className="pb-kind" style={{ background: KIND_COLOR[n.t] }} />
                  <span className="pb-nname">{n.name}</span>
                </div>
              ))}
            </div>
          )}
          {panel !== "add" && panel !== "layers" && (
            <p className="pb-hint" style={{ padding: "16px 4px" }}>
              {panel === "sections" ? "Pre-built Hero / Features / Testimonial / Pricing / Footer sections land here (Phase 6) — drop one onto any insert zone."
                : panel === "pages" ? "Your pages, with thumbnails + add-page — Phase 2."
                : panel === "theme" ? "Brand colours, fonts and tokens that repaint the whole site — Phase 3."
                : panel === "media" ? "Your uploaded images & files — Phase 3."
                : "Page title, SEO, social preview & advanced settings — Phase 2."}
            </p>
          )}
        </div>
      </aside>

      {/* CANVAS */}
      <main className="pb-canvas">
        <div className="pb-device" data-bp={device}>
          <div className="pb-device-tag pb-mono"><span>{DEVICES[device]}</span><span>·</span><span>100%</span></div>
          <div className="pb-page">
            {/* header */}
            <div className={`pb-el ${sel.key === "header" ? "pb-on" : ""}`} data-kind="Section · Header"
              onClick={pick("header", "Section", "Header", [{ t: "sec", name: "Header" }])}>
              <Tools withMove={false} />
              <div className="pb-snav">
                <div className="pb-slogo">{locationName}</div>
                <div className="pb-slinks"><span>Fleet</span><span>Rates</span><span>Locations</span><span>Contact</span></div>
                <div className="pb-scta">Book now</div>
              </div>
            </div>

            <div className="pb-insert"><button>＋ Add section</button></div>

            {/* hero */}
            <div className={`pb-el ${sel.key === "hero" ? "pb-on" : ""}`} data-kind="Section · Hero"
              onClick={pick("hero", "Section", "Hero", [{ t: "sec", name: "Hero" }])}>
              <div className="pb-hero">
                <div className={`pb-el ${sel.key === "h1" ? "pb-on" : ""}`} data-kind="Heading H1"
                  onClick={pick("h1", "Heading", "Heading H1", [...HERO_CHAIN, { t: "el", name: "Heading" }])}>
                  <h1>Utes, vans and 4WDs, ready when you are</h1>
                </div>
                <div className={`pb-el ${sel.key === "sub" ? "pb-on" : ""}`} data-kind="Text"
                  onClick={pick("sub", "Text", "Subheading", [...HERO_CHAIN, { t: "el", name: "Text" }])}>
                  <p>Weekly and monthly hire across South East Queensland. No hidden fees, no waiting on hold.</p>
                </div>
                <div className={`pb-el ${sel.key === "btn" ? "pb-on" : ""}`} style={{ display: "inline-block" }} data-kind="Button"
                  onClick={pick("btn", "Button", "Check availability", [...HERO_CHAIN, { t: "el", name: "Button" }])}>
                  <Tools />
                  <span className="pb-hero-btn">Check availability</span>
                </div>
              </div>
            </div>

            <div className="pb-insert"><button>＋ Add section</button></div>

            {/* three-up */}
            <div className={`pb-el ${sel.key === "why" ? "pb-on" : ""}`} data-kind="Section · Why Placid"
              onClick={pick("why", "Section", "Why Placid", [{ t: "sec", name: "Why Placid" }])}>
              <div className="pb-strip">
                {[["Long-term rates", "Discounts that kick in from week two, applied automatically."],
                  ["Delivered to site", "We drop the vehicle where the job is, across the region."],
                  ["One contact", "Same person answers every time. No call centre in the middle."]].map(([h, p], i) => (
                  <div key={i} className={`pb-el ${sel.key === "col" + i ? "pb-on" : ""}`} data-kind="Column · 33%"
                    onClick={pick("col" + i, "Column", `Column ${i + 1}`, [{ t: "sec", name: "Why Placid" }, { t: "row", name: "Row · 3 col" }, { t: "col", name: `Column ${i + 1}` }])}>
                    <h3>{h}</h3><p>{p}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* live-drag drop indicator (visual demo of the coral signal) */}
            <div className="pb-drop" data-label="DROP: ROW → COLUMN 1" aria-hidden />

            {/* form */}
            <div className={`pb-el ${sel.key === "enq" ? "pb-on" : ""}`} data-kind="Section · Enquiry"
              onClick={pick("enq", "Section", "Enquiry form", [{ t: "sec", name: "Enquiry" }])}>
              <div className="pb-formsec">
                <h2>Tell us what you need</h2>
                <div className="pb-sub">We&rsquo;ll come back within the hour, business days.</div>
                <div className={`pb-el ${sel.key === "form" ? "pb-on" : ""}`} data-kind="Form · Rental enquiry"
                  onClick={pick("form", "Form", "Rental enquiry", [{ t: "sec", name: "Enquiry" }, { t: "el", name: "Form" }])}>
                  <div className="pb-fform">
                    <div className="pb-finput" /><div className="pb-finput" /><div className="pb-finput" />
                    <div className="pb-fsubmit">Send enquiry</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* INSPECTOR */}
      <aside className="pb-inspector">
        <div className="pb-insp-head">
          <div className="pb-insp-title"><span className="pb-kindchip">{sel.kind}</span><h2>{sel.name}</h2></div>
          <div className="pb-tabs">
            {(["content", "style", "advanced"] as const).map((t) => (
              <button key={t} aria-pressed={tab === t} onClick={() => setTab(t)}>{t[0].toUpperCase() + t.slice(1)}</button>
            ))}
          </div>
        </div>
        <div className="pb-insp-scroll">
          <div className="pb-block">
            <h3>Content</h3>
            <div className="pb-field"><label>Label</label><input className="pb-control" defaultValue={sel.name} /></div>
            <div className="pb-field"><label>Action</label><div className="pb-control">Go to page <span className="pb-unit">▾</span></div></div>
            <div className="pb-field"><label>Target</label><div className="pb-control">/fleet <span className="pb-unit">▾</span></div></div>
          </div>
          <div className="pb-block">
            <h3>Appearance <span className="pb-unit">theme</span></h3>
            <div className="pb-field"><label>Fill</label><div className="pb-control"><span style={{ display: "flex", alignItems: "center", gap: 8 }}><span className="pb-swatch" style={{ background: "#0F7C6B" }} /> Brand / Primary</span><span className="pb-unit">▾</span></div></div>
            <div className="pb-field"><label>Radius</label><div className="pb-stepper"><input defaultValue="8" /><span>PX</span></div></div>
            <div className="pb-field"><label>Size</label><div className="pb-control">Large <span className="pb-unit">▾</span></div></div>
          </div>
          <div className="pb-block">
            <h3>Spacing</h3>
            <div className="pb-box">
              <div className="pb-bm-outer">
                <span className="pb-bm-tag">MARGIN</span>
                <span className="pb-bm-v t">0</span><span className="pb-bm-v b">0</span><span className="pb-bm-v l">0</span><span className="pb-bm-v r">0</span>
                <div className="pb-bm-inner">
                  <span className="pb-bm-tag">PADDING</span>
                  <span className="pb-bm-v t">12</span><span className="pb-bm-v b">12</span><span className="pb-bm-v l">26</span><span className="pb-bm-v r">26</span>
                  <span>ELEMENT</span>
                </div>
              </div>
            </div>
          </div>
          <div className="pb-block">
            <h3>Responsive</h3>
            <div className="pb-field"><label>Visible on</label>
              <div className="pb-bp" style={{ margin: 0 }}>
                <button className="pb-bp-chip" aria-pressed>DESK</button>
                <button className="pb-bp-chip" aria-pressed>TAB</button>
                <button className="pb-bp-chip" aria-pressed>MOB</button>
              </div>
            </div>
          </div>
          <p className="pb-hint">Styles set on Desktop cascade down. Edit while a smaller breakpoint is active and the change applies to that size and below only.</p>
        </div>
      </aside>

      {/* STATUS BAR */}
      <footer className="pb-status">
        <div className="pb-path">
          {sel.chain.map((c, i) => (
            <span key={i} style={{ display: "contents" }}>
              {i > 0 && <span className="pb-arrow">›</span>}
              <span className={`pb-chip ${i === sel.chain.length - 1 ? "pb-on" : ""}`}>
                <span className="pb-kind" style={{ background: KIND_COLOR[c.t] }} />{c.name}
              </span>
            </span>
          ))}
        </div>
        <div className="pb-status-right">
          <span className="pb-mono">W 214 × H 46</span>
          <span className="pb-mono">Autosave on</span>
          <span className="pb-mono">/{slug} · v1</span>
        </div>
      </footer>
    </div>
  );
}
