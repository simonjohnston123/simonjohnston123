import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function ShopPage({ params }: { params: { slug: string } }) {
  const location = await prisma.location.findUnique({
    where: { slug: params.slug },
    include: { site: true },
  });
  if (!location) notFound();

  const primaryColor = location.site?.primaryColor || "#1d5df5";
  const products = await prisma.product.findMany({
    where: { locationId: location.id, active: true },
    orderBy: [{ position: "asc" }, { createdAt: "desc" }],
  });

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-12">
      <div className="mx-auto max-w-5xl">
        <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: primaryColor }}>{location.name}</p>
        <h1 className="mt-1 text-3xl font-bold text-slate-900">Shop</h1>

        {products.length === 0 ? (
          <p className="mt-8 rounded-2xl border border-slate-200 bg-white p-10 text-center text-slate-500">
            No products listed yet — check back soon.
          </p>
        ) : (
          <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {products.map((p) => (
              <div key={p.id} className="flex flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                {p.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={p.imageUrl} alt={p.name} className="h-48 w-full object-cover" />
                ) : (
                  <div className="grid h-48 w-full place-items-center bg-slate-100 text-sm text-slate-400">No image</div>
                )}
                <div className="flex flex-1 flex-col p-5">
                  <h2 className="font-semibold text-slate-900">{p.name}</h2>
                  {p.price != null ? <p className="mt-1 text-xl font-bold" style={{ color: primaryColor }}>${p.price}</p> : null}
                  {p.description ? <p className="mt-2 flex-1 text-sm text-slate-600">{p.description}</p> : null}
                  <a
                    href={`/sites/${location.slug}#contact`}
                    className="mt-4 rounded-xl px-4 py-2.5 text-center text-sm font-semibold text-white"
                    style={{ background: primaryColor }}
                  >
                    Enquire
                  </a>
                </div>
              </div>
            ))}
          </div>
        )}

        <p className="mt-10 text-center text-xs text-slate-400">Powered by PlacidCRM</p>
      </div>
    </main>
  );
}
