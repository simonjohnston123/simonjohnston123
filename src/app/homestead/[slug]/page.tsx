import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: { slug: string } }) {
  const loc = await prisma.location.findUnique({ where: { slug: params.slug } });
  return { title: loc ? `${loc.name} — Rooms` : "Rooms" };
}

const money = (n: number) => `$${n.toLocaleString()}`;

export default async function HomesteadRooms({ params }: { params: { slug: string } }) {
  const location = await prisma.location.findUnique({
    where: { slug: params.slug },
    include: { homesteadRooms: { where: { active: true }, orderBy: { createdAt: "asc" } } },
  });
  if (!location) notFound();

  const rooms = location.homesteadRooms;
  const anyWeekly = rooms.some((r) => r.allowsWeekly);
  const anyNightly = rooms.some((r) => r.allowsNightly);

  // The strapline should describe what's actually on offer, not assume weekly.
  const strapline =
    anyWeekly && anyNightly
      ? "Rooms by the night or by the week — stay as long as you need."
      : anyNightly
        ? "Rooms available by the night."
        : "Rooms available now — pay weekly, stay as long as you need.";

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-brand-gradient px-6 py-8 text-white">
        <div className="mx-auto max-w-4xl">
          <h1 className="text-3xl font-bold">{location.name}</h1>
          <p className="mt-1 text-white/85">{strapline}</p>
        </div>
      </header>
      <main className="mx-auto max-w-4xl px-6 py-8">
        {rooms.length === 0 ? (
          <p className="rounded-2xl bg-white p-8 text-center text-slate-400 shadow-sm">No rooms listed right now — check back soon.</p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {rooms.map((r) => (
              <div key={r.id} className="overflow-hidden rounded-2xl bg-white shadow-sm">
                {r.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={r.imageUrl} alt={r.name} className="h-52 w-full object-cover" />
                ) : <div className="grid h-52 w-full place-items-center bg-slate-100 text-5xl text-slate-300">🛏</div>}
                <div className="p-5">
                  <h2 className="text-lg font-semibold text-slate-900">{r.name}</h2>

                  {/* Price reads per letting mode, so a nightly-only room never shows "$0/wk". */}
                  <div className="mt-1 flex flex-wrap items-baseline gap-x-4 gap-y-1">
                    {r.allowsNightly ? (
                      <span className="text-lg font-bold text-brand-700">
                        {money(r.nightlyPrice)}<span className="text-sm font-normal text-slate-400">/night</span>
                      </span>
                    ) : null}
                    {r.allowsWeekly ? (
                      <span className="text-lg font-bold text-brand-700">
                        {money(r.weeklyPrice)}<span className="text-sm font-normal text-slate-400">/week</span>
                      </span>
                    ) : null}
                  </div>

                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {r.allowsWeekly ? <span className="rounded-full bg-brand-50 px-2 py-0.5 text-[11px] font-medium text-brand-700">Long stay</span> : null}
                    {r.allowsNightly ? <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600">By the night</span> : null}
                    {r.allowsNightly && r.minNights > 1 ? <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600">{r.minNights}-night min</span> : null}
                  </div>

                  {r.description ? <p className="mt-2 text-sm text-slate-600">{r.description}</p> : null}
                  <Link href={`/homestead/${params.slug}/book?room=${r.id}`} className="mt-4 block rounded-lg bg-brand-gradient py-2.5 text-center text-sm font-semibold text-white">Book this room</Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
