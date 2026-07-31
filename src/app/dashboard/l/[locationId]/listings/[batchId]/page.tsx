import Link from "next/link";
import { notFound } from "next/navigation";
import { requireLocationAccess } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { PageHeader } from "@/components/ui";
import { ListingBatchEditor } from "@/components/listing-batch-editor";

export const dynamic = "force-dynamic";

type Violation = { field: string; message: string };

export default async function BatchPage({ params }: { params: { locationId: string; batchId: string } }) {
  await requireLocationAccess(params.locationId);
  const { locationId, batchId } = params;
  const base = `/dashboard/l/${locationId}/listings`;

  const batch = await prisma.listingBatch.findFirst({
    where: { id: batchId, locationId },
    include: { items: { orderBy: { createdAt: "asc" } } },
  });
  if (!batch) notFound();

  const products = await prisma.product.findMany({
    where: { id: { in: batch.items.map((i) => i.productId) } },
    select: { id: true, name: true, imageUrl: true },
  });
  const pmap = new Map(products.map((p) => [p.id, p]));

  const items = batch.items.map((i) => ({
    id: i.id,
    productName: pmap.get(i.productId)?.name ?? "(product removed)",
    productImage: pmap.get(i.productId)?.imageUrl ?? null,
    fields: (i.fields ?? {}) as Record<string, unknown>,
    validation: (i.validation ?? []) as Violation[],
    publishStatus: i.publishStatus,
    externalId: i.externalId,
  }));

  return (
    <div>
      <PageHeader
        title="Edit listings"
        subtitle="Shape each listing to the marketplace, then publish. AI optimisation lands in Phase 3."
        action={
          <Link href={base} className="btn-secondary">
            ← All batches
          </Link>
        }
      />
      <ListingBatchEditor
        locationId={locationId}
        batch={{ id: batch.id, name: batch.name, marketplace: batch.marketplace, status: batch.status }}
        items={items}
      />
    </div>
  );
}
