import Link from "next/link";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";
export const metadata = { title: "Business pages · Placid Connect" };

export default async function DirectoryPage() {
  const businesses = await prisma.location.findMany({ orderBy: { name: "asc" }, select: { name: true, slug: true, industry: true, city: true, state: true } });
  return (
    <main className="mx-auto max-w-4xl px-4 py-6">
      <h1 className="text-2xl font-bold text-slate-900">Business pages</h1>
      <p className="mt-1 text-sm text-slate-500">Find, follow, book and buy — directly, with no middleman taking a cut.</p>
      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        {businesses.length === 0 ? <p className="text-sm text-slate-400">No businesses listed yet.</p> : businesses.map((b) => (
          <Link key={b.slug} href={`/sites/${b.slug}`} className="flex items-center gap-3 rounded-2xl bg-white p-4 shadow-sm hover:shadow">
            <span className="grid h-12 w-12 place-items-center rounded-xl bg-brand-gradient text-xl text-white">🏢</span>
            <div>
              <div className="font-semibold text-slate-800">{b.name}</div>
              <div className="text-xs text-slate-500">{[b.industry, [b.city, b.state].filter(Boolean).join(", ")].filter(Boolean).join(" · ")}</div>
            </div>
          </Link>
        ))}
      </div>
    </main>
  );
}
