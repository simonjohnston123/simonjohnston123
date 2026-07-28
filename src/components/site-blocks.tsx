import { submitLeadAction } from "@/app/sites/actions";

export type Block =
  | { type: "hero"; heading?: string; subheading?: string; ctaLabel?: string; ctaHref?: string }
  | { type: "text"; heading?: string; body?: string }
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
