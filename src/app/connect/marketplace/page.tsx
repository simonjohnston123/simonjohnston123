import Link from "next/link";
import { prisma } from "@/lib/db";
import { CATEGORIES } from "./categories";

export const dynamic = "force-dynamic";
export const metadata = { title: "Marketplace · Placid Connect" };

const money = (n: number) => (n === 0 ? "Free" : `$${n.toLocaleString()}`);

export default async function Marketplace({ searchParams }: { searchParams: { cat?: string; q?: string } }) {
  const cat = searchParams.cat;
  const q = (searchParams.q ?? "").trim();
  const listings = await prisma.connectListing.findMany({
    where: {
      status: "ACTIVE",
      ...(cat ? { category: cat } : {}),
      ...(q ? { OR: [{ title: { contains: q, mode: "insensitive" } }, { description: { contains: q, mode: "insensitive" } }] } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: 60,
  });

  return (
    <main className="mx-auto grid max-w-6xl gap-5 px-4 py-5 lg:grid-cols-[210px_1fr]">
      <aside className="hidden lg:block">
        <div className="sticky top-20 space-y-1">
          <Link href="/connect/marketplace/new" className="mb-3 block rounded-lg bg-brand-gradient px-4 py-2.5 text-center text-sm font-semibold text-white">+ Sell something</Link>
          <Link href="/connect/marketplace" className={`block rounded-lg px-3 py-2 text-sm ${!cat ? "bg-white font-semibold text-brand-700 shadow-sm" : "text-slate-700 hover:bg-white"}`}>All categories</Link>
          {CATEGORIES.map((c) => (
            <Link key={c} href={`/connect/marketplace?cat=${encodeURIComponent(c)}`} className={`block rounded-lg px-3 py-2 text-sm ${cat === c ? "bg-white font-semibold text-brand-700 shadow-sm" : "text-slate-700 hover:bg-white"}`}>{c}</Link>
          ))}
        </div>
      </aside>

      <section>
        <div className="mb-4 flex items-center justify-between gap-3">
          <h1 className="text-2xl font-bold text-slate-900">{cat ?? "Marketplace"}</h1>
          <form className="flex-1 max-w-xs"><input name="q" defaultValue={q} placeholder="Search marketplace…" className="w-full rounded-full border border-slate-200 bg-white px-4 py-2 text-sm outline-none" /></form>
          <Link href="/connect/marketplace/new" className="rounded-lg bg-brand-gradient px-4 py-2 text-sm font-semibold text-white lg:hidden">+ Sell</Link>
        </div>
        {listings.length === 0 ? (
          <div className="rounded-2xl bg-white p-10 text-center text-sm text-slate-400 shadow-sm">Nothing listed here yet. <Link href="/connect/marketplace/new" className="font-semibold text-brand-600">Be the first to sell →</Link></div>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {listings.map((l) => (
              <Link key={l.id} href={`/connect/marketplace/${l.id}`} className="overflow-hidden rounded-2xl bg-white shadow-sm hover:shadow">
                {l.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={l.imageUrl} alt={l.title} className="h-36 w-full object-cover" />
                ) : <div className="grid h-36 w-full place-items-center bg-slate-100 text-3xl text-slate-300">🛍</div>}
                <div className="p-2.5">
                  <div className="font-semibold text-slate-900">{money(l.price)}</div>
                  <div className="truncate text-sm text-slate-700">{l.title}</div>
                  {l.location ? <div className="truncate text-xs text-slate-400">{l.location}</div> : null}
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
