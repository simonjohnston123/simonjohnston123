"use client";

/**
 * Client-safe visual preview of a single website block. Mirrors the public
 * renderer in components/site-blocks.tsx so the builder canvas looks like the
 * real page. Interactive blocks (forms/booking) render as static mockups.
 */

import { SiteRow, type RowBlock } from "@/components/site-element";

const FIELD_LABELS: Record<string, string> = {
  name: "Name",
  email: "Email",
  phone: "Phone",
  company: "Company",
  message: "Message",
};

export function BlockPreview({
  block,
  primaryColor,
}: {
  block: Record<string, unknown>;
  primaryColor: string;
}) {
  const s = (k: string) => String(block[k] ?? "");

  switch (block.type) {
    case "row":
      return <SiteRow block={block as RowBlock} primaryColor={primaryColor} />;
    case "hero":
      return (
        <section className="px-6 py-20 text-center text-white" style={{ background: `linear-gradient(135deg, ${primaryColor}, #0f172a)` }}>
          <h1 className="mx-auto max-w-3xl text-4xl font-bold sm:text-5xl">{s("heading") || "Your headline here"}</h1>
          {block.subheading ? <p className="mx-auto mt-5 max-w-2xl text-lg opacity-90">{s("subheading")}</p> : null}
          {block.ctaLabel ? (
            <span className="mt-8 inline-block rounded-lg bg-white px-6 py-3 font-semibold" style={{ color: primaryColor }}>{s("ctaLabel")}</span>
          ) : null}
        </section>
      );
    case "text":
      return (
        <section className="mx-auto max-w-3xl px-6 py-14">
          {block.heading ? <h2 className="text-2xl font-bold text-slate-900">{s("heading")}</h2> : null}
          {block.body ? <p className="mt-4 whitespace-pre-line text-slate-600">{s("body")}</p> : null}
        </section>
      );
    case "image":
      return (
        <section className="mx-auto max-w-4xl px-6 py-10">
          {block.url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={s("url")} alt={s("alt")} className="mx-auto max-h-[420px] w-full rounded-2xl object-cover" />
          ) : (
            <div className="grid h-56 w-full place-items-center rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50 text-sm text-slate-400">
              Image — add a URL in the inspector
            </div>
          )}
          {block.caption ? <p className="mt-2 text-center text-sm text-slate-500">{s("caption")}</p> : null}
        </section>
      );
    case "video":
      return (
        <section className="mx-auto max-w-3xl px-6 py-12 text-center">
          {block.heading ? <h2 className="mb-5 text-2xl font-bold text-slate-900">{s("heading")}</h2> : null}
          <div className="grid aspect-video place-items-center overflow-hidden rounded-2xl bg-slate-900 text-white/70">
            {block.embedUrl ? "▶ Video embed" : "▶ Add an embed URL"}
          </div>
        </section>
      );
    case "button":
      return (
        <section className="px-6 py-8" style={{ textAlign: (s("align") || "center") as "left" | "center" | "right" }}>
          <span className="inline-block rounded-lg px-6 py-3 font-semibold text-white" style={{ background: primaryColor }}>{s("label") || "Click here"}</span>
        </section>
      );
    case "features": {
      const items = Array.isArray(block.items) ? (block.items as Record<string, unknown>[]) : [];
      return (
        <section className="mx-auto max-w-5xl px-6 py-14">
          {block.heading ? <h2 className="mb-8 text-center text-2xl font-bold text-slate-900">{s("heading")}</h2> : null}
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {items.map((it, j) => (
              <div key={j} className="rounded-xl border border-slate-100 bg-white p-6 shadow-sm">
                {it.icon ? <div className="mb-3 text-2xl">{String(it.icon)}</div> : null}
                <h3 className="font-semibold text-slate-900">{String(it.title ?? "")}</h3>
                {it.body ? <p className="mt-2 text-sm text-slate-600">{String(it.body)}</p> : null}
              </div>
            ))}
          </div>
        </section>
      );
    }
    case "pricing": {
      const plans = Array.isArray(block.plans) ? (block.plans as Record<string, unknown>[]) : [];
      return (
        <section className="bg-slate-50 px-6 py-14">
          <div className="mx-auto max-w-5xl">
            {block.heading ? <h2 className="text-center text-2xl font-bold text-slate-900">{s("heading")}</h2> : null}
            <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {plans.map((p, j) => {
                const feats = Array.isArray(p.features)
                  ? (p.features as string[])
                  : typeof p.featuresText === "string"
                  ? p.featuresText.split("\n").map((x) => x.trim()).filter(Boolean)
                  : [];
                return (
                  <div key={j} className="flex flex-col rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
                    <h3 className="text-lg font-semibold text-slate-900">{String(p.name ?? "")}</h3>
                    {p.size ? <p className="text-sm text-slate-500">{String(p.size)}</p> : null}
                    {p.price ? <p className="mt-3 text-3xl font-bold" style={{ color: primaryColor }}>{String(p.price)}</p> : null}
                    {feats.length ? (
                      <ul className="mt-4 space-y-1 text-sm text-slate-600">
                        {feats.map((f, k) => <li key={k}>✓ {f}</li>)}
                      </ul>
                    ) : null}
                    <span className="mt-6 rounded-lg px-4 py-2 text-center text-sm font-semibold text-white" style={{ background: primaryColor }}>Enquire</span>
                  </div>
                );
              })}
            </div>
          </div>
        </section>
      );
    }
    case "faq": {
      const items = Array.isArray(block.items) ? (block.items as Record<string, unknown>[]) : [];
      return (
        <section className="mx-auto max-w-3xl px-6 py-14">
          {block.heading ? <h2 className="mb-6 text-2xl font-bold text-slate-900">{s("heading")}</h2> : null}
          <div className="divide-y divide-slate-100">
            {items.map((it, j) => (
              <div key={j} className="py-4">
                <h3 className="font-semibold text-slate-900">{String(it.q ?? "")}</h3>
                {it.a ? <p className="mt-1 text-slate-600">{String(it.a)}</p> : null}
              </div>
            ))}
          </div>
        </section>
      );
    }
    case "cta":
      return (
        <section className="px-6 py-14 text-center text-white" style={{ background: primaryColor }}>
          <h2 className="mx-auto max-w-2xl text-2xl font-bold sm:text-3xl">{s("heading") || "Ready to start?"}</h2>
          {block.subheading ? <p className="mx-auto mt-3 max-w-xl opacity-90">{s("subheading")}</p> : null}
          {block.ctaLabel ? (
            <span className="mt-6 inline-block rounded-lg bg-white px-6 py-3 font-semibold" style={{ color: primaryColor }}>{s("ctaLabel")}</span>
          ) : null}
        </section>
      );
    case "form":
    case "contact": {
      const fields = Array.isArray(block.fields) ? (block.fields as string[]) : ["name", "email", "phone", "message"];
      return (
        <section className="bg-slate-50 px-6 py-14">
          <div className="mx-auto max-w-xl">
            <h2 className="text-2xl font-bold text-slate-900">{s("heading") || "Contact us"}</h2>
            {block.body ? <p className="mt-2 text-slate-600">{s("body")}</p> : null}
            <div className="mt-6 space-y-3">
              {fields.map((f) => (
                <div key={f}>
                  <div className="mb-1 text-xs font-medium text-slate-500">{FIELD_LABELS[f] ?? f}</div>
                  <div className={`rounded-lg border border-slate-200 bg-white ${f === "message" ? "h-20" : "h-10"}`} />
                </div>
              ))}
              <span className="mt-2 inline-block rounded-lg px-5 py-2.5 text-sm font-semibold text-white" style={{ background: primaryColor }}>
                {s("submitLabel") || "Send enquiry"}
              </span>
            </div>
          </div>
        </section>
      );
    }
    case "products": {
      const items = Array.isArray(block.items) ? (block.items as Record<string, unknown>[]) : [];
      return (
        <section className="mx-auto max-w-5xl px-6 py-14">
          {block.heading ? <h2 className="mb-8 text-center text-2xl font-bold text-slate-900">{s("heading")}</h2> : null}
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {items.map((p, j) => (
              <div key={j} className="flex flex-col overflow-hidden rounded-xl border border-slate-100 bg-white shadow-sm">
                {p.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={String(p.imageUrl)} alt={String(p.name ?? "")} className="h-40 w-full object-cover" />
                ) : (
                  <div className="grid h-40 w-full place-items-center bg-slate-100 text-xs text-slate-400">No image</div>
                )}
                <div className="flex flex-1 flex-col p-5">
                  <h3 className="font-semibold text-slate-900">{String(p.name ?? "")}</h3>
                  {p.price ? <p className="mt-1 text-xl font-bold" style={{ color: primaryColor }}>{String(p.price)}</p> : null}
                  {p.description ? <p className="mt-2 flex-1 text-sm text-slate-600">{String(p.description)}</p> : null}
                  {p.buttonLabel ? (
                    <span className="mt-4 rounded-lg px-4 py-2 text-center text-sm font-semibold text-white" style={{ background: primaryColor }}>{String(p.buttonLabel)}</span>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        </section>
      );
    }
    case "booking":
      return (
        <section className="bg-slate-50 px-6 py-14">
          <div className="mx-auto max-w-xl">
            <h2 className="text-2xl font-bold text-slate-900">{s("heading") || "Book a time"}</h2>
            {block.body ? <p className="mt-2 text-slate-600">{s("body")}</p> : null}
            <div className="mt-6 rounded-xl border border-slate-200 bg-white p-4">
              <div className="grid grid-cols-7 gap-1.5">
                {Array.from({ length: 21 }).map((_, k) => (
                  <div key={k} className={`grid h-9 place-items-center rounded text-xs ${k % 5 === 0 ? "bg-slate-100 text-slate-300" : "border border-slate-200 text-slate-500"}`}>
                    {k % 5 === 0 ? "" : 9 + (k % 8)}
                  </div>
                ))}
              </div>
              <span className="mt-4 inline-block rounded-lg px-5 py-2.5 text-sm font-semibold text-white" style={{ background: primaryColor }}>
                {s("submitLabel") || "Request booking"}
              </span>
            </div>
          </div>
        </section>
      );
    default:
      return (
        <section className="px-6 py-8 text-center text-sm text-slate-400">Unknown block “{String(block.type)}”</section>
      );
  }
}
