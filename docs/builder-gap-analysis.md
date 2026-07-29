# Placid CRM Builder — Gap Analysis & Fix Order

**For:** Claude Code
**Read with:** `placid-builder-design-spec.md` (target spec) and `placid-builder-mockup.html` (visual target)
**Based on:** the current build at `placidcrm.com/dashboard/l/<id>/website`, compared against GoHighLevel's page builder at `app.gohighlevel.com/location/<id>/page-builder/<id>`

The current build has the right *ingredients*. The problems are structural, not stylistic. Fixing the four P0 items below will do more for usability than any amount of restyling.

---

## P0 — Structural. Fix these first.

### P0.1 The builder must be its own full-screen route, not a panel inside the dashboard
**Now:** the editor is rendered inside `/dashboard/.../website`, so it inherits the CRM's left nav (Dashboard, Storage, CCTV, Contacts…) and the whole builder is squeezed into what's left. Palette, canvas and settings are fighting over ~1200px, and the canvas loses.

**Target:** GHL routes the editor to `/page-builder/<pageId>`, a dedicated full-viewport screen. The only navigation is a single `← Back` button top-left. No CRM sidebar, no dashboard chrome.

- Route: `/builder/:siteId/:pageId`
- `100vw × 100vh`, `overflow:hidden`, CSS grid per the spec
- `← Back` returns to the site's page list
- This one change roughly triples the canvas width

### P0.2 The canvas must render at device width
**Now:** the canvas is a ~380px column, so a desktop page renders in a phone-shaped box. Everything looks broken because it *is* being laid out wrong — the user is judging their site through a distorted lens.

**Target:** canvas max-width follows the selected breakpoint (1180 / 768 / 390) and centres in the available space, floating on a distinct backdrop with a shadow so the page edge is obvious. Desktop is the default. See spec §2.

### P0.3 There is no element inspector
**Now:** the right panel only ever shows PAGE SETTINGS (Page title, Meta title, Meta description) plus a hint telling the user to add a Row, drop Elements in, then click one "to edit it here." That's the whole editing story — and it's the reason it feels unusable. There is nowhere to change a button's label, colour, size, padding or link.

**Target:** the right panel is context-driven:
- Nothing selected → Page settings (title, meta, slug, tracking)
- Element selected → that element's inspector: **Content / Style / Advanced** tabs, live-applying, no modal, no Save button inside the panel
- Header shows a mono type chip + element name
- Spacing edited via the visual box-model control, not eight number fields

This is the single biggest functional gap. Build it before anything cosmetic.

### P0.4 Selection has no visual language
**Now:** no hover outline, no selected outline, no element toolbar, no indication of what's clickable or what's currently being edited.

**Target:** per spec §4.4/4.5 — hover = 1px outline + mono name badge; selected = 2px outline + floating toolbar (move up/down, duplicate, save to library, delete); drop target = coral insertion line with a label saying what will happen. Teal means selected, coral means will-land-here, never interchangeable.

---

## P1 — Palette structure

### P1.1 Replace the single scrolling list with a two-level nav
**Now:** one long column — ROWS, ELEMENTS, SECTIONS, CONTENT, MEDIA — with small buttons, all visible at once, requiring vertical scroll to reach anything.

**Target (GHL's pattern):** a narrow category list on the left; clicking a category opens a flyout panel with a search box and a tile grid. Categories, in this order:

```
Quick Add            ← most-used elements, flat grid
Sections             ← Full Width / Wide / Medium / Small
Rows                 ← 1 / 2 / 3 / 4 / 5 / 6 Column
Elements             ← the full element library, grouped (see P1.2)
Prebuilt Sections    ← designed section templates (see P1.3)
Saved Assets         ← Section / Global / Universal Sections, Element / Universal Elements
Widget Marketplace   ← installable widgets
Store                ← commerce elements
─────
Buttons              ← gallery of pre-styled button variants
Forms And Surveys    ← Create New Form / Survey, Add Existing Form / Survey
Social Media Icons
Countdown Timers
Images
Progress Bar
```

Every flyout gets its own search field. Search matters more than browsing once the library passes ~30 items.

### P1.2 Fix the element taxonomy — no duplicates, proper groups
**Now:** `Button` appears under both ELEMENTS and CONTENT. `Image` and `Video` each appear twice. Groups (ELEMENTS vs CONTENT vs MEDIA) overlap in meaning, so there's no way to predict where something lives.

**Target:** one canonical home per element, grouped by what the user is trying to do:

| Group | Elements |
|---|---|
| Text | Headline, Sub-headline, Paragraph, Bullet list, Rich Text |
| Media | Image, Image Slider, Video, Photo Gallery, Logo Showcase, FAQ, Testimonials |
| Form | Button, Form |
| Store | Cart, Searchbar, Collection List, Featured Products, Featured Product, Upsell |
| Blog | Blog Posts, Category Navigation, Social Share, Subscribe to Mailing List |
| Custom | Code, Survey, Calendar, Map, SVG, Reviews, Number Counter, QR Code, Pricing Table |
| Countdown | Countdown, Minute Timer, Day Timer |
| Blocks | Navigation Menu, Divider, Progress Bar, Image Feature, Spacer |
| Social | Social Icons |
| Order | 1 Step Order, 2 Step Order, Order Confirmation |

Ship whatever subset is built; keep the group names and slots so additions have an obvious home. Mark genuinely new items with a small `New` badge — GHL does this and it works.

### P1.3 Prebuilt Sections needs a category list, not a flat grid
**Now:** SECTIONS contains exactly one entry, `Hero`. CONTENT has Text / Features / Pricing / FAQ / Button. That's not a section library, it's a handful of blocks.

**Target:** designed, drop-in sections browsable by purpose, each rendered as a real thumbnail (not an icon):

```
About · Call To Action · FAQs · Footer · For Who · Guarantee & Awards ·
Image Slider · List · Mega Menu Headers · Partners · Plan Selection ·
Product · Store Sections · Team · Testimonials · Welcome
```

Two to four designed variants each is enough to start. This is the feature that makes a non-designer's site look professional — it matters more than any individual element.

### P1.4 Add a Buttons gallery
GHL's `Buttons` category shows ~15 pre-styled button variants (solid, outline, ghost, pill, icon-only, arrow, colour variants) that drop in ready-made. Cheap to build, disproportionately useful, and it stops users hand-styling every button from scratch.

---

## P2 — Top bar and page management

**Now:** page tabs (`Home` / `shop` / `About Us`) sit inline next to a `New page…` text field and an `Add` button, then a second toolbar with the slug, three device icons, `Templates ▾`, `Preview ↗`, `Save`. Two toolbars doing overlapping jobs, and no undo.

**Target:** one 52px top bar (spec §4.1):

| Position | Contains |
|---|---|
| Left | `← Back`, then a page selector dropdown (`Home ▾`) — pages belong in a dropdown or the Pages panel, not as inline tabs |
| Centre-right | Breakpoint segmented control with width readouts |
| Right | Undo / Redo · autosave state (`● Saved 4s ago`) · Preview (ghost) · **Publish** (solid accent) |

Notes:
- **Add undo/redo.** There is none right now. It's the difference between experimenting freely and being afraid to touch anything. ⌘Z / ⇧⌘Z, 50 steps, patch-based, covering drag, style and text edits.
- **Autosave, then Publish.** A manual `Save` button means unsaved work is the user's problem. Autosave on a 2s debounce with a visible state; `Publish` is the separate, deliberate action.
- Keep the preview URL + `Connect Domain` line under the toolbar — that's a good touch already present in GHL and worth copying.
- Show the page slug (`/home`) in the Pages panel or page settings, not the main toolbar.

---

## P3 — Polish, once P0–P2 land

- Layers panel bound to the same selection state as the canvas
- Per-breakpoint style overrides with the desktop-down cascade
- `+ Add section` insert zones between sections
- Global header/footer sections stored once, referenced by id
- Saved Assets (save any section or element to reuse across pages)
- Ancestry breadcrumb in the status bar
- Keyboard shortcuts table from spec §5

---

## What's already right — don't regress it

- Page-level SEO fields (title, meta title, meta description) are correct and well placed; they just need to live under "nothing selected"
- Three device icons already present — they only need to actually resize the canvas
- Preview URL + public address line is a good pattern
- Row column presets 1–6 match GHL exactly
- `Templates ▾` in the toolbar is the right idea; point it at the Prebuilt Sections library

---

## Suggested order of work

1. P0.1 full-screen route → immediately makes everything else viable
2. P0.2 device-width canvas
3. P0.3 element inspector (Content / Style tabs, live apply)
4. P0.4 selection + hover + drop visual language
5. P1.1 + P1.2 palette nav and taxonomy
6. P2 top bar, undo/redo, autosave/publish
7. P1.3 + P1.4 section library and button gallery
8. P3 polish

Items 1–4 are the whole "it's clunky and hard to use" complaint. Items 5–7 are the "it looks terrible" complaint. Item 8 is what makes it competitive.
