import Link from "next/link";
import { notFound } from "next/navigation";
import { requireLocationAccess } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { PageHeader } from "@/components/ui";
import { ProductEditor } from "@/components/product-editor";
import { describeProductAction, deleteProductAction } from "../actions";

export const dynamic = "force-dynamic";

export default async function ProductEditPage({ params }: { params: { locationId: string; productId: string } }) {
  await requireLocationAccess(params.locationId);

  const product = await prisma.product.findFirst({ where: { id: params.productId, locationId: params.locationId } });
  const productCategories = await prisma.productCategory.findMany({
    where: { locationId: params.locationId },
    orderBy: { position: "asc" },
    select: { id: true, name: true },
  });
  if (!product) notFound();

  return (
    <div className="max-w-2xl">
      <PageHeader
        title={product.name}
        subtitle="Product"
        action={<Link href={`/dashboard/l/${params.locationId}/products`} className="btn-ghost text-sm">← All products</Link>}
      />

      <div className="card mb-6 p-5">
        <ProductEditor
          locationId={params.locationId}
          productId={product.id}
          name={product.name}
          price={product.price}
          description={product.description ?? ""}
          imageUrl={product.imageUrl ?? ""}
          categoryId={product.categoryId ?? ""}
          categories={productCategories.map((c) => ({ id: c.id, name: c.name }))}
          active={product.active}
        />
      </div>

      <div className="card mb-6 p-5">
        <h2 className="text-sm font-semibold text-slate-800">✨ Write the description with AI</h2>
        <form action={describeProductAction} className="mt-3 flex flex-col gap-2 sm:flex-row">
          <input type="hidden" name="locationId" value={params.locationId} />
          <input type="hidden" name="productId" value={product.id} />
          <input name="hint" placeholder="Optional details (materials, size, who it's for…)" className="input flex-1" />
          <button className="btn-secondary text-sm">Generate</button>
        </form>
      </div>

      <form action={deleteProductAction}>
        <input type="hidden" name="locationId" value={params.locationId} />
        <input type="hidden" name="productId" value={product.id} />
        <button className="text-sm text-slate-400 hover:text-red-600">Delete this product</button>
      </form>
    </div>
  );
}
