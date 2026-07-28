import { submitLeadAction } from "@/app/sites/actions";

export type Block =
  | { type: "hero"; heading?: string; subheading?: string; ctaLabel?: string; ctaHref?: string }
  | { type: "text"; heading?: string; body?: string }
  | { type: "features"; heading?: string; items?: { title?: string; body?: string; icon?: string }[] }
  | { type: "pricing"; heading?: string; subheading?: string; plans?: { name?: string; size?: string; price?: string; features?: string[] }[] }
  | { type: "faq"; heading?: string; items?: { q?: string; a?: string }[] }
  | { type: "cta"; heading?: string; subheading?: string; ctaLabel?: string; ctaHref?: string }
  | { type: "contact"; heading?: string; body?: string }
  | { type: string; [k: string]: unknown };

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
        switch (block.type) {
          case "hero":
            return (
              <section
                key={i}
                className="px-6 py-24 text-center text-white"
                style={{ background: `linear-gradient(135deg, ${primaryColor}, #0f172a)` }}
              >
                <h1 className="mx-auto max-w-3xl text-4xl font-bold sm:text-5xl">{String(block.heading ?? "")}</h1>
                {block.subheading ? (
                  <p className="mx-auto mt-5 max-w-2xl text-lg opacity-90">{String(block.subheading)}</p>
                ) : null}
                {block.ctaLabel ? (
                  <a
                    href={String(block.ctaHref ?? "#contact")}
                    className="mt-8 inline-block rounded-lg bg-white px-6 py-3 font-semibold"
                    style={{ color: primaryColor }}
                  >
                    {String(block.ctaLabel)}
                  </a>
                ) : null}
              </section>
            );
          case "text":
            return (
              <section key={i} className="mx-auto max-w-3xl px-6 py-16">
                {block.heading ? <h2 className="text-2xl font-bold text-slate-900">{String(block.heading)}</h2> : null}
                {block.body ? <p className="mt-4 whitespace-pre-line text-slate-600">{String(block.body)}</p> : null}
              </section>
            );
          case "features": {
            const items = Array.isArray((block as any).items) ? (block as any).items : [];
            return (
              <section key={i} className="mx-auto max-w-5xl px-6 py-16">
                {block.heading ? (
                  <h2 className="mb-8 text-center text-2xl font-bold text-slate-900">{String(block.heading)}</h2>
                ) : null}
                <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                  {items.map((it: any, j: number) => (
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
            const plans = Array.isArray((block as any).plans) ? (block as any).plans : [];
            return (
              <section key={i} className="bg-slate-50 px-6 py-16">
                <div className="mx-auto max-w-5xl">
                  {block.heading ? (
                    <h2 className="text-center text-2xl font-bold text-slate-900">{String(block.heading)}</h2>
                  ) : null}
                  {block.subheading ? (
                    <p className="mt-2 text-center text-slate-600">{String(block.subheading)}</p>
                  ) : null}
                  <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                    {plans.map((p: any, j: number) => (
                      <div key={j} className="flex flex-col rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
                        <h3 className="text-lg font-semibold text-slate-900">{String(p.name ?? "")}</h3>
                        {p.size ? <p className="text-sm text-slate-500">{String(p.size)}</p> : null}
                        {p.price ? (
                          <p className="mt-3 text-3xl font-bold" style={{ color: primaryColor }}>{String(p.price)}</p>
                        ) : null}
                        {Array.isArray(p.features) ? (
                          <ul className="mt-4 space-y-1 text-sm text-slate-600">
                            {p.features.map((f: string, k: number) => (
                              <li key={k}>✓ {String(f)}</li>
                            ))}
                          </ul>
                        ) : null}
                        <a
                          href="#contact"
                          className="mt-6 rounded-lg px-4 py-2 text-center text-sm font-semibold text-white"
                          style={{ background: primaryColor }}
                        >
                          Enquire
                        </a>
                      </div>
                    ))}
                  </div>
                </div>
              </section>
            );
          }
          case "faq": {
            const items = Array.isArray((block as any).items) ? (block as any).items : [];
            return (
              <section key={i} className="mx-auto max-w-3xl px-6 py-16">
                {block.heading ? (
                  <h2 className="mb-6 text-2xl font-bold text-slate-900">{String(block.heading)}</h2>
                ) : null}
                <div className="divide-y divide-slate-100">
                  {items.map((it: any, j: number) => (
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
              <section
                key={i}
                className="px-6 py-16 text-center text-white"
                style={{ background: primaryColor }}
              >
                <h2 className="mx-auto max-w-2xl text-2xl font-bold sm:text-3xl">{String(block.heading ?? "")}</h2>
                {block.subheading ? <p className="mx-auto mt-3 max-w-xl opacity-90">{String(block.subheading)}</p> : null}
                {block.ctaLabel ? (
                  <a href={String(block.ctaHref ?? "#contact")} className="mt-6 inline-block rounded-lg bg-white px-6 py-3 font-semibold" style={{ color: primaryColor }}>
                    {String(block.ctaLabel)}
                  </a>
                ) : null}
              </section>
            );
          case "contact":
            return (
              <section key={i} id="contact" className="bg-slate-50 px-6 py-16">
                <div className="mx-auto max-w-xl">
                  <h2 className="text-2xl font-bold text-slate-900">{String(block.heading ?? "Contact us")}</h2>
                  {block.body ? <p className="mt-2 text-slate-600">{String(block.body)}</p> : null}
                  <form action={submitLeadAction} className="mt-6 space-y-3">
                    <input type="hidden" name="slug" value={slug} />
                    <input name="name" placeholder="Your name" className="input" />
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      <input name="email" type="email" placeholder="Email" className="input" />
                      <input name="phone" placeholder="Phone" className="input" />
                    </div>
                    <textarea name="message" rows={3} placeholder="How can we help?" className="input" />
                    <button
                      className="rounded-lg px-5 py-2.5 font-semibold text-white"
                      style={{ background: primaryColor }}
                    >
                      Send enquiry
                    </button>
                  </form>
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
