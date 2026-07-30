import { LeadForm, BookingForm } from "@/components/site-forms";
import { SiteRow, type RowBlock } from "@/components/site-element";

export type Block = { type: string; [k: string]: unknown };

export function SiteBlocks({
  blocks,
  slug,
  primaryColor,
}: {
  blocks: Block[];
  slug: string;
  primaryColor: string;
}) {
  return (
    <>
      {blocks.map((block, i) => {
        const s = (k: string) => String(block[k] ?? "");
        switch (block.type) {
          case "row":
            return <SiteRow key={i} block={block as RowBlock} primaryColor={primaryColor} />;
          case "hero":
            return (
              <section key={i} className="px-6 py-24 text-center text-white" style={{ background: `linear-gradient(135deg, ${primaryColor}, #0f172a)` }}>
                <h1 className="mx-auto max-w-3xl text-4xl font-bold sm:text-5xl">{s("heading")}</h1>
                {block.subheading ? <p className="mx-auto mt-5 max-w-2xl text-lg opacity-90">{s("subheading")}</p> : null}
                {block.ctaLabel ? (
                  <a href={s("ctaHref") || "#contact"} className="mt-8 inline-block rounded-lg bg-white px-6 py-3 font-semibold" style={{ color: primaryColor }}>{s("ctaLabel")}</a>
                ) : null}
              </section>
            );
          case "text":
            return (
              <section key={i} className="mx-auto max-w-3xl px-6 py-16">
                {block.heading ? <h2 className="text-2xl font-bold text-slate-900">{s("heading")}</h2> : null}
                {block.body ? <p className="mt-4 whitespace-pre-line text-slate-600">{s("body")}</p> : null}
              </section>
            );
          case "image":
            return block.url ? (
              <section key={i} className="mx-auto max-w-4xl px-6 py-10">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={s("url")} alt={s("alt")} className="mx-auto max-h-[520px] w-full rounded-2xl object-cover" />
                {block.caption ? <p className="mt-2 text-center text-sm text-slate-500">{s("caption")}</p> : null}
              </section>
            ) : null;
          case "video":
            return block.embedUrl ? (
              <section key={i} className="mx-auto max-w-3xl px-6 py-12 text-center">
                {block.heading ? <h2 className="mb-5 text-2xl font-bold text-slate-900">{s("heading")}</h2> : null}
                <div className="relative aspect-video overflow-hidden rounded-2xl">
                  <iframe src={s("embedUrl")} className="absolute inset-0 h-full w-full" allowFullScreen title="Video" />
                </div>
              </section>
            ) : null;
          case "button":
            return (
              <section key={i} className="px-6 py-8" style={{ textAlign: (s("align") || "center") as "left" | "center" | "right" }}>
                <a href={s("href") || "#"} className="inline-block rounded-lg px-6 py-3 font-semibold text-white" style={{ background: primaryColor }}>{s("label") || "Click here"}</a>
              </section>
            );
          case "features": {
            const items = Array.isArray(block.items) ? (block.items as Record<string, unknown>[]) : [];
            return (
              <section key={i} className="mx-auto max-w-5xl px-6 py-16">
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
              <section key={i} className="bg-slate-50 px-6 py-16">
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
                          <a href="#contact" className="mt-6 rounded-lg px-4 py-2 text-center text-sm font-semibold text-white" style={{ background: primaryColor }}>Enquire</a>
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
              <section key={i} className="mx-auto max-w-3xl px-6 py-16">
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
          case "testimonials": {
            const items = Array.isArray(block.items) ? (block.items as Record<string, unknown>[]) : [];
            return (
              <section key={i} className="bg-slate-50 px-6 py-16">
                <div className="mx-auto max-w-5xl">
                  {block.heading ? <h2 className="mb-8 text-center text-2xl font-bold text-slate-900">{s("heading")}</h2> : null}
                  <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                    {items.map((it, j) => {
                      const stars = Math.min(Math.max(parseInt(String(it.rating ?? "5"), 10) || 5, 1), 5);
                      return (
                        <figure key={j} className="flex flex-col rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                          <div className="mb-3 flex gap-0.5" aria-label={`${stars} out of 5 stars`}>
                            {Array.from({ length: 5 }).map((_, k) => (
                              <span key={k} style={{ color: k < stars ? primaryColor : "#e2e8f0" }}>★</span>
                            ))}
                          </div>
                          {it.quote ? <blockquote className="flex-1 text-slate-700">{`“${String(it.quote)}”`}</blockquote> : null}
                          {(it.author || it.detail) ? (
                            <figcaption className="mt-4 text-sm">
                              {it.author ? <span className="font-semibold text-slate-900">{String(it.author)}</span> : null}
                              {it.detail ? <span className="text-slate-500">{it.author ? " · " : ""}{String(it.detail)}</span> : null}
                            </figcaption>
                          ) : null}
                        </figure>
                      );
                    })}
                  </div>
                </div>
              </section>
            );
          }
          case "cta":
            return (
              <section key={i} className="px-6 py-16 text-center text-white" style={{ background: primaryColor }}>
                <h2 className="mx-auto max-w-2xl text-2xl font-bold sm:text-3xl">{s("heading")}</h2>
                {block.subheading ? <p className="mx-auto mt-3 max-w-xl opacity-90">{s("subheading")}</p> : null}
                {block.ctaLabel ? (
                  <a href={s("ctaHref") || "#contact"} className="mt-6 inline-block rounded-lg bg-white px-6 py-3 font-semibold" style={{ color: primaryColor }}>{s("ctaLabel")}</a>
                ) : null}
              </section>
            );
          case "form":
          case "contact": {
            const fields = Array.isArray(block.fields) ? (block.fields as string[]) : ["name", "email", "phone", "message"];
            return (
              <section key={i} id="contact" className="bg-slate-50 px-6 py-16">
                <div className="mx-auto max-w-xl">
                  <h2 className="text-2xl font-bold text-slate-900">{s("heading") || "Contact us"}</h2>
                  {block.body ? <p className="mt-2 text-slate-600">{s("body")}</p> : null}
                  <div className="mt-6">
                    <LeadForm slug={slug} primaryColor={primaryColor} fields={fields} submitLabel={s("submitLabel") || "Send enquiry"} thankYou={s("thankYou") || "Thanks — we'll be in touch shortly."} />
                  </div>
                </div>
              </section>
            );
          }
          case "products": {
            const items = Array.isArray(block.items) ? (block.items as Record<string, unknown>[]) : [];
            return (
              <section key={i} className="mx-auto max-w-5xl px-6 py-16">
                {block.heading ? <h2 className="mb-8 text-center text-2xl font-bold text-slate-900">{s("heading")}</h2> : null}
                <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                  {items.map((p, j) => (
                    <div key={j} className="flex flex-col overflow-hidden rounded-xl border border-slate-100 bg-white shadow-sm">
                      {p.imageUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={String(p.imageUrl)} alt={String(p.name ?? "")} className="h-44 w-full object-cover" />
                      ) : (
                        <div className="grid h-44 w-full place-items-center bg-slate-100 text-sm text-slate-400">No image</div>
                      )}
                      <div className="flex flex-1 flex-col p-5">
                        <h3 className="font-semibold text-slate-900">{String(p.name ?? "")}</h3>
                        {p.price ? <p className="mt-1 text-xl font-bold" style={{ color: primaryColor }}>{String(p.price)}</p> : null}
                        {p.description ? <p className="mt-2 flex-1 text-sm text-slate-600">{String(p.description)}</p> : null}
                        {p.buttonLabel ? (
                          <a href={String(p.buttonHref || "#")} className="mt-4 rounded-lg px-4 py-2 text-center text-sm font-semibold text-white" style={{ background: primaryColor }}>{String(p.buttonLabel)}</a>
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
              <section key={i} id="booking" className="bg-slate-50 px-6 py-16">
                <div className="mx-auto max-w-3xl">
                  <h2 className="text-2xl font-bold text-slate-900">{s("heading") || "Book a time"}</h2>
                  {block.body ? <p className="mt-2 text-slate-600">{s("body")}</p> : null}
                  <div className="mt-6">
                    <BookingForm slug={slug} primaryColor={primaryColor} calendarId={s("calendarId")} submitLabel={s("submitLabel") || "Request booking"} thankYou={s("thankYou") || "Thanks — we'll confirm your booking soon."} />
                  </div>
                </div>
              </section>
            );
          default:
            return null;
        }
      })}
    </>
  );
}
