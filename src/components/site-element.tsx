// Pure, hook-free renderers shared by the builder canvas AND the public site,
// so the preview matches the live page exactly. No client interactivity here.
import type { CSSProperties } from "react";

export type Element = { type: string; [k: string]: unknown };

// Per-element style overrides set in the builder's Style tab (element.style).
function styleObj(st?: Record<string, unknown>): CSSProperties {
  if (!st) return {};
  const o: CSSProperties = {};
  const num = (v: unknown) => (v == null || v === "" ? undefined : Number(v));
  if (st.bg) o.background = String(st.bg);
  if (st.color) o.color = String(st.color);
  if (st.align) o.textAlign = st.align as CSSProperties["textAlign"];
  if (num(st.padTop) != null) o.paddingTop = num(st.padTop);
  if (num(st.padRight) != null) o.paddingRight = num(st.padRight);
  if (num(st.padBottom) != null) o.paddingBottom = num(st.padBottom);
  if (num(st.padLeft) != null) o.paddingLeft = num(st.padLeft);
  if (num(st.marginTop) != null) o.marginTop = num(st.marginTop);
  if (num(st.marginBottom) != null) o.marginBottom = num(st.marginBottom);
  if (num(st.radius) != null) o.borderRadius = num(st.radius);
  if (num(st.maxWidth)) { o.maxWidth = num(st.maxWidth); o.marginLeft = "auto"; o.marginRight = "auto"; }
  return o;
}

export function SiteElement(props: { element: Element; primaryColor: string }) {
  const st = styleObj(props.element.style as Record<string, unknown> | undefined);
  const inner = renderInner(props);
  return Object.keys(st).length ? <div style={st}>{inner}</div> : inner;
}
export type Column = { width?: number; elements?: Element[] };
export type RowBlock = { type: "row"; columns?: Column[] } & Record<string, unknown>;

const alignClass = (a: unknown) =>
  a === "center" ? "text-center" : a === "right" ? "text-right" : "text-left";

const headingSize = (s: unknown) =>
  s === "md" ? "text-xl" : s === "lg" ? "text-2xl sm:text-3xl" : "text-3xl sm:text-4xl";

const roundClass = (r: unknown) =>
  r === "full" ? "rounded-full" : r === "none" ? "rounded-none" : "rounded-xl";

function renderInner({ element, primaryColor }: { element: Element; primaryColor: string }) {
  const s = (k: string) => String(element[k] ?? "");
  switch (element.type) {
    case "heading":
      return <h2 className={`font-bold text-slate-900 ${headingSize(element.size)} ${alignClass(element.align)}`}>{s("text")}</h2>;
    case "subheading":
      return <h3 className={`text-lg font-semibold text-slate-700 ${alignClass(element.align)}`}>{s("text")}</h3>;
    case "paragraph":
      return <p className={`whitespace-pre-line text-slate-600 ${alignClass(element.align)}`}>{s("text")}</p>;
    case "bulletlist": {
      const items = Array.isArray(element.items) ? (element.items as Record<string, unknown>[]) : [];
      return (
        <ul className="space-y-1 text-slate-600">
          {items.map((it, i) => <li key={i} className="flex gap-2"><span style={{ color: primaryColor }}>•</span>{String(it.text ?? "")}</li>)}
        </ul>
      );
    }
    case "button": {
      const outline = element.style === "outline";
      return (
        <div className={alignClass(element.align)}>
          <a
            href={s("href") || "#"}
            className="inline-block rounded-lg px-6 py-3 font-semibold"
            style={outline ? { color: primaryColor, border: `2px solid ${primaryColor}` } : { background: primaryColor, color: "#fff" }}
          >
            {s("label") || "Click here"}
          </a>
        </div>
      );
    }
    case "image":
      return s("url") ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={s("url")} alt={s("alt")} className={`w-full object-cover ${roundClass(element.rounded)}`} />
      ) : (
        <div className={`grid h-40 w-full place-items-center border-2 border-dashed border-slate-200 bg-slate-50 text-xs text-slate-400 ${roundClass(element.rounded)}`}>Image</div>
      );
    case "video":
      return s("embedUrl") ? (
        <div className="relative aspect-video overflow-hidden rounded-xl">
          <iframe src={s("embedUrl")} className="absolute inset-0 h-full w-full" allowFullScreen title="Video" />
        </div>
      ) : (
        <div className="grid aspect-video place-items-center rounded-xl bg-slate-900 text-sm text-white/70">▶ Video</div>
      );
    case "divider":
      return <hr className="border-slate-200" />;
    case "spacer":
      return <div style={{ height: element.size === "sm" ? 16 : element.size === "lg" ? 64 : 32 }} />;
    default:
      return null;
  }
}

/** Public/pure render of a Row → Columns block. */
export function SiteRow({ block, primaryColor }: { block: RowBlock; primaryColor: string }) {
  const columns = Array.isArray(block.columns) ? block.columns : [];
  return (
    <section className="mx-auto max-w-5xl px-6 py-10">
      <div className="flex flex-col gap-6 sm:flex-row">
        {columns.map((col, i) => (
          <div key={i} className="space-y-4" style={{ flex: col.width || 1 }}>
            {(Array.isArray(col.elements) ? col.elements : []).map((el, j) => (
              <SiteElement key={j} element={el} primaryColor={primaryColor} />
            ))}
          </div>
        ))}
      </div>
    </section>
  );
}
