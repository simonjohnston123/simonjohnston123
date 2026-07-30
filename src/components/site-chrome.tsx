import Link from "next/link";

export function SiteChrome({
  slug,
  logoText,
  tagline,
  primaryColor,
  pages,
  children,
}: {
  slug: string;
  logoText: string;
  tagline?: string | null;
  primaryColor: string;
  pages: { title: string; slug: string; isHome: boolean }[];
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-white">
      <header className="border-b border-slate-100">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
          <Link href={`/sites/${slug}`} className="text-lg font-bold" style={{ color: primaryColor }}>
            {logoText}
          </Link>
          <nav className="flex gap-4 text-sm font-medium text-slate-600">
            {pages.map((p) => (
              <Link
                key={p.slug || "home"}
                href={p.isHome ? `/sites/${slug}` : `/sites/${slug}/${p.slug}`}
                className="hover:text-slate-900"
              >
                {p.title}
              </Link>
            ))}
          </nav>
        </div>
      </header>
      {children}
      <footer className="border-t border-slate-100 px-6 py-8 text-center text-sm text-slate-400">
        © {new Date().getFullYear()} {logoText}
        {tagline ? ` · ${tagline}` : ""} · Powered by Placid Connect
      </footer>
    </div>
  );
}
