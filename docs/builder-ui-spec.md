# Placid CRM — Website Builder UI Spec

Companion: `docs/builder-design-reference.html` (visual mockup — the target).
Implementation lives under `src/app/build/` + `src/components/builder/`.

## Core principles (fix the "clunky")
1. **Canvas is the hero** — dark chrome, white page floating on a dark backdrop with a big shadow.
2. **Persistent "where am I"** — status-bar ancestry breadcrumb (Section › Row › Column › Element), each clickable.
3. **Drop targets shown, not guessed** — 3px coral insertion line + label of the resolved outcome + ghost outlines on valid containers.
4. **Two-signal colour** — TEAL `#00C7A9` = selected; CORAL `#FF5C8A` = will land here. Never mix.
5. **No modals** — everything edits live in the fixed right inspector (only the media picker is a modal).
6. **Mono only for data** — IBM Plex Mono for measurements/units/type-badges/structural labels; Inter Tight for all controls.

## Geometry (fixed CSS grid, full viewport, no page scroll)
rail 56px · left panel 288px · canvas 1fr · inspector 304px · topbar 52px · status bar 30px.
<1280px: panel 248, inspector 268. Panel collapsible; inspector always visible.
Breakpoint canvas max-widths: desktop 1180 · tablet 768 · mobile 390; transition `max-width .28s cubic-bezier(.4,0,.2,1)`.

## Tokens
ink-900 #0E1116 (backdrop) · ink-800 #151920 (panels/topbar/inspector) · ink-750 #1A1F27 (rail/status/tiles) · ink-700 #212731 (inputs/chips) · ink-600 #2A313D (hover) · line #262D38.
text-hi #E8ECF2 · text-mid #A3ADBC · text-lo #6B7688.
sel #00C7A9 (selection only) · drop #FF5C8A (drop only) · sec #7C9CFF · row #9B8CFF · col #63C7F5.
Radii 6/9/13. Spacing 4/8/12/16/24/32. Fonts: Inter Tight (UI), IBM Plex Mono (9.5–10.5px, uppercase, ls .06em, data only).

## Regions
- **Top bar:** brand · breadcrumb-that-is-the-page-picker · [right] breakpoint segmented control · undo/redo · autosave state · Preview (ghost) · Publish (the ONLY solid-teal button).
- **Rail (56):** Add elements · Section library · Layers · Pages · Theme & brand · Media · (spacer) · Page settings. Active = teal tint + 2px left marker.
- **Left panel (288):** header+collapse · search · content. Add elements = 3-col tile grid (aspect 1/.86) grouped LAYOUT/BASIC/CRM & CONVERT/COMMERCE/ADVANCED, tiles cursor:grab. Section library = wide prebuilt-section thumbnails (Hero/Features/About/Team/Testimonials/Pricing/FAQ/Contact/CTA/Footer). Layers = indented tree, 5px kind-colour chip, eye on hover, selected = sel-soft, drag-reorderable, in sync with canvas selection.
- **Canvas:** white page r13 + big shadow; mono device tag. Hover = 1px teal outline + mono corner badge (SECTION · HERO / COLUMN · 33% / BUTTON). Select = 2px teal outline + top-right floating tools (up/down/duplicate/save-to-library/delete; delete red hover). Click selects innermost; Esc walks up. Insert zones between sections reveal a centred "+ Add section" pill.
- **Drop feedback:** valid containers dashed coral @40%; insertion = 3px coral line + glow + mono label ("DROP: ROW → COLUMN 1" / "DROP: NEW SECTION"); dragged tile follows cursor @60% scale .9; auto-scroll within 60px of edges. **Auto-wrap:** drop any element anywhere → builder silently creates Section→Row→Column wrappers. Hierarchy: Section⊃Rows, Row⊃Columns(1–6), Column⊃Elements; no self-nesting.
- **Inspector (304):** mono type chip + name; tabs Content · Style · Advanced; hairline-separated blocks with mono headers. Fields = 88px label + control (never stacked). Numeric = stepper + mono unit, drag-to-scrub label. Colour = 15px swatch + theme token name (tokens first, hex second). **Spacing = visual box model** (nested margin/padding rects, editable 4 sides). Responsive block = Visible-on DESK/TAB/MOB chips + per-bp overrides + cascade hint. Live apply, no Save/Cancel.
- **Status bar (30):** ancestry breadcrumb (clickable, structure-coloured chips, last active teal) + mono dims (W×H) + Autosave on + version.

## Interaction
Click=select innermost · Esc=parent/deselect · dbl-click text=inline contentEditable on canvas · ⌘D=duplicate · Del=delete+undo toast · ⌘Z/⇧⌘Z=undo/redo (covers drag/style/text) · ⌘C/V=copy/paste across pages · arrows=nudge order · drag from layers=reorder · autosave debounced 2s. Undo ≥50 steps, stored as patches.

## Data model (one JSON doc per page; node tree, flat props, breakpoint overrides)
Node: `{ id, type, name, props, style:{ base, tablet?, mobile? }, visibility?, children[] }`. `style.base`=desktop; tablet/mobile hold overrides only, merged down at render. Colours reference theme tokens (`token:brand.primary`). Global header/footer stored once, referenced by id + `isGlobal`. **One renderer, two modes (`editable`/`live`)** — editor and published page use the same component registry (canvas == published, pixel-identical).

## Implementation
- **dnd-kit** (headless, touch+keyboard, nested contexts, custom collision). `activationConstraint:{distance:5}` so click≠drag. `DragOverlay` for the ghost.
- **iframe canvas** so site CSS can't collide with chrome (or, interim: namespace all chrome + reset canvas subtree).
- State: single store (Zustand) + immer patches → undo stack. Selection is an id, never a DOM ref. Memoise nodes by id; narrow subscriptions.
- A11y: visible focus, keyboard drag, prefers-reduced-motion.

## Build order
1. **Shell + tokens + geometry** (static). ← Phase 1 (current)
2. Node-tree renderer + selection + hover badges + breadcrumb.
3. Inspector content/style blocks + live apply + box-model.
4. Drag & drop + coral line + auto-wrap.
5. Layers panel bound to selection.
6. Section library (real prebuilt designs) — pull EARLY, biggest non-designer win.
7. Breakpoints + per-bp overrides.
8. Undo/redo + autosave + publish.

## Definition of done
- Drag a Button onto an empty page in ONE action (auto-wrap, no manual scaffold).
- Selected element identifiable from canvas + inspector + layers + breadcrumb — all agree.
- Drop location stated in words during drag.
- Nothing that edits an element opens a modal.
- Every change undoable, undo ≤1 keystroke away.
- Mobile shows a real different layout, not a squashed desktop.
- Published page pixel-identical to canvas.
