import Link from "next/link";
import { requireLocationAccess } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { PageHeader, Badge } from "@/components/ui";
import { NewProduct } from "@/components/new-product";

export const dynamic = "force-dynamic";

export default async function ProductsPage({ params }: { params: { locationId: string } }) {
  const { location } = await requireLocationAccess(params.locationId);

  const products = await prisma.product.findMany({
    where: { locationId: params.locationId },
    orderBy: [{ position: "asc" }, { createdAt: "desc" }],
  });

  return (
    <div>
      <PageHeader
        title="Products"
        subtitle="Your catalogue — shown on your public shop page."
        action={
          <div className="flex items-center gap-2">
            <Link href={`/shop/${location.slug}`} target="_blank" className="btn-secondary text-sm">Open shop ↗</Link>
            <Link href={`/dashboard/l/${params.locationId}/website`} className="btn-ghost text-sm">← Website</Link>
          </div>
        }
      />

      <div className="mb-6">
        <NewProduct locationId={params.locationId} />
      </div>

      {products.length === 0 ? (
        <p className="rounded-xl border border-dashed border-slate-200 p-8 text-center text-sm text-slate-500">
          No products yet. Add one above — AI can write the description for you.
        </p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {products.map((p) => (
            <div key={p.id} className="card flex flex-col overflow-hidden p-0">
              {p.imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={p.imageUrl} alt={p.name} className="h-36 w-full object-cover" />
              ) : (
                <div className="grid h-36 w-full place-items-center bg-slate-100 text-sm text-slate-400">No image</div>
              )}
              <div className="flex flex-1 flex-col p-4">
                <div className="flex items-start justify-between gap-2">
                  <span className="font-semibold text-slate-900">{p.name}</span>
                  {p.active ? null : <Badge color="slate">Hidden</Badge>}
                </div>
                {p.price != null ? <p className="mt-1 font-bold text-slate-900">${p.price}</p> : null}
                {p.description ? <p className="mt-1 line-clamp-2 text-sm text-slate-600">{p.description}</p> : null}
                <Link href={`/dashboard/l/${params.locationId}/products/${p.id}`} className="btn-primary mt-3 text-center text-sm">Edit</Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
