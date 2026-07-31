import Link from "next/link";
import { requireLocationAccess } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { PageHeader, EmptyState } from "@/components/ui";
import { rulebook } from "@/lib/listing-marketplaces";
import { formatDateTime, cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

const STATUS_STYLE: Record<string, string> = {
  DRAFT: "bg-slate-100 text-slate-600",
  OPTIMISED: "bg-violet-100 text-violet-700",
  PARTIAL: "bg-amber-100 text-amber-700",
  PUBLISHED: "bg-emerald-100 text-emerald-700",
};

export default async function ListingsPage({ params }: { params: { locationId: string } }) {
  await requireLocationAccess(params.locationId);
  const locationId = params.locationId;
  const base = `/dashboard/l/${locationId}/listings`;

  const batches = await prisma.listingBatch.findMany({
    where: { locationId },
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { items: true } }, items: { select: { publishStatus: true } } },
  });

  return (
    <div>
      <PageHeader
        title="Listing Tool"
        subtitle="Turn your catalogue into optimised, marketplace-ready listings."
        action={
          <Link href={`${base}/new`} className="btn-primary">
            + New listing batch
          </Link>
        }
      />

      {batches.length === 0 ? (
        <EmptyState
          title="No listing batches yet"
          body="Start a batch: pick products, choose a marketplace, and shape them into optimised listings."
          action={
            <Link href={`${base}/new`} className="btn-primary">
              Create your first batch
            </Link>
          }
        />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {batches.map((b) => {
            const rb = rulebook(b.marketplace);
            const published = b.items.filter((i) => i.publishStatus === "PUBLISHED").length;
            return (
              <Link key={b.id} href={`${base}/${b.id}`} className="card block p-4 transition hover:border-brand-300 hover:shadow-md">
                <div className="flex items-start justify-between gap-2">
                  <span className="truncate font-semibold text-slate-900">{b.name}</span>
                  <span className={cn("shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold", STATUS_STYLE[b.status] ?? "bg-slate-100 text-slate-600")}>
                    {b.status}
                  </span>
                </div>
                <div className="mt-1 text-sm text-brand-600">{rb?.label ?? b.marketplace}</div>
                <div className="mt-3 flex items-center gap-3 text-xs text-slate-500">
                  <span>{b._count.items} item{b._count.items === 1 ? "" : "s"}</span>
                  {published > 0 ? <span className="text-emerald-600">✓ {published} live</span> : null}
                  <span className="ml-auto">{formatDateTime(b.createdAt)}</span>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
