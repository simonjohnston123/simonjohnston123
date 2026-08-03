import Link from "next/link";

export function SiteChrome({
  slug,
  logoText,
  tagline,
  primaryColor,
  pages,
  children,
  theme = "light",
  basePath,
}: {
  slug: string;
  logoText: string;
  tagline?: string | null;
  primaryColor: string;
  pages: { title: string; slug: string; isHome: boolean }[];
  children: React.ReactNode;
  // Theme system + custom-domain hosting (added by the site-builder work):
  // basePath is "" when served on the business's own domain, "/sites/<slug>"
  // inside the CRM.
  theme?: string;
  basePath?: string;
}) {
  const root = basePath ?? `/sites/${slug}`;
  const href = (p: { slug: string; isHome: boolean }) => (p.isHome ? root || "/" : `${root}/${p.slug}`);
  const noir = theme === "noir" || theme === "dark";

  return (
    <div className={`min-h-screen ${noir ? "bg-slate-950 text-slate-100" : "bg-white"}`}>
      <header className={`border-b ${noir ? "border-white/10" : "border-slate-100"}`}>
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
          <Link href={root || "/"} className="text-lg font-bold" style={{ color: primaryColor }}>
            {logoText}
          </Link>
          <nav className={`flex gap-4 text-sm font-medium ${noir ? "text-slate-300" : "text-slate-600"}`}>
            {pages.map((p) => (
              <Link key={p.slug || "home"} href={href(p)} className={noir ? "hover:text-white" : "hover:text-slate-900"}>
                {p.title}
              </Link>
            ))}
          </nav>
        </div>
      </header>
      {children}
      <footer className={`border-t px-6 py-8 text-center text-sm ${noir ? "border-white/10 text-slate-500" : "border-slate-100 text-slate-400"}`}>
        © {new Date().getFullYear()} {logoText}
        {tagline ? ` · ${tagline}` : ""} · Powered by Placid Connect
      </footer>
    </div>
  );
}
