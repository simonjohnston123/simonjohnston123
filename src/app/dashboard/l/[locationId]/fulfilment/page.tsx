import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireLocationAccess } from "@/lib/auth";
import { PageHeader, EmptyState } from "@/components/ui";
import { supplierAutomation } from "@/lib/fulfilment";
import { RebuildButton, SupplierOrderCard, type DeskRow, type DeskItem } from "@/components/fulfilment-desk";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";
export const metadata = { title: "Ordering" };

const TABS = [
  { key: "TO_PLACE", label: "To order" },
  { key: "PLACED", label: "Placed" },
  { key: "SHIPPED", label: "Shipped" },
  { key: "FAILED", label: "Problems" },
] as const;

const money = (c: number) => `$${(c / 100).toFixed(2)}`;

export default async function FulfilmentPage({
  params, searchParams,
}: {
  params: { locationId: string };
  searchParams: { status?: string; supplier?: string };
}) {
  const locationId = params.locationId;
  await requireLocationAccess(locationId);

  const status = TABS.find((t) => t.key === searchParams.status)?.key ?? "TO_PLACE";
  const supplier = searchParams.supplier;

  const [rows, counts, supplierGroups] = await Promise.all([
    prisma.supplierOrder.findMany({
      where: { locationId, status, ...(supplier ? { supplier } : {}) },
      orderBy: { createdAt: "desc" },
      take: 100,
      include: {
        order: { select: { number: true, source: true, customerName: true, deliveryAddress: true, placedAt: true } },
      },
    }),
    prisma.supplierOrder.groupBy({ by: ["status"], where: { locationId }, _count: { _all: true } }),
    prisma.supplierOrder.groupBy({
      by: ["supplier"],
      where: { locationId, status: "TO_PLACE" },
      _count: { _all: true },
      _sum: { costCents: true },
    }),
  ]);

  const countFor = (k: string) => counts.find((c) => c.status === k)?._count._all ?? 0;
  const total = counts.reduce((s, c) => s + c._count._all, 0);

  const desk: DeskRow[] = rows.map((r) => {
    const items = (Array.isArray(r.items) ? r.items : []) as (DeskItem & { sellCents?: number | null })[];
    return {
      id: r.id,
      supplier: r.supplier,
      status: r.status,
      items,
      costCents: r.costCents,
      sellCents: items.reduce((s, i) => s + (i.sellCents ?? 0) * (i.qty ?? 1), 0),
      supplierRef: r.supplierRef,
      tracking: r.tracking,
      carrier: r.carrier,
      orderNumber: r.order.number,
      channel: r.order.source ?? "manual",
      customerName: r.order.customerName,
      deliveryAddress: r.order.deliveryAddress,
      placedAt: r.order.placedAt?.toISOString() ?? null,
      automation: supplierAutomation(r.supplier),
    };
  });

  const base = `/dashboard/l/${locationId}/fulfilment`;

  return (
    <div>
      <PageHeader
        title="Ordering"
        subtitle="Every order to place, every supplier, one screen"
        action={<RebuildButton locationId={locationId} />}
      />

      {total === 0 ? (
        <EmptyState
          title="Nothing to order yet"
          body="Orders sync in from eBay, Shopify and your own site. Hit “Scan orders” to work out what needs buying from each supplier."
          action={<RebuildButton locationId={locationId} />}
        />
      ) : (
        <>
          {/* What has to be bought right now, per supplier. */}
          {supplierGroups.length ? (
            <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {supplierGroups.map((g) => (
                <Link
                  key={g.supplier}
                  href={`${base}?status=TO_PLACE&supplier=${encodeURIComponent(g.supplier)}`}
                  className={cn("card p-4 transition hover:border-slate-300", supplier === g.supplier && "ring-2 ring-brand-400")}
                >
                  <div className="text-xs font-medium text-slate-500">{g.supplier}</div>
                  <div className="mt-1 text-2xl font-bold text-slate-900">{g._count._all}</div>
                  <div className="text-xs text-slate-500">
                    to order{g._sum.costCents ? ` · ${money(g._sum.costCents)} cost` : ""}
                  </div>
                </Link>
              ))}
            </div>
          ) : null}

          <div className="mb-4 flex flex-wrap items-center gap-2">
            {TABS.map((t) => (
              <Link
                key={t.key}
                href={`${base}?status=${t.key}${supplier ? `&supplier=${encodeURIComponent(supplier)}` : ""}`}
                className={cn(
                  "rounded-full px-3 py-1.5 text-sm font-medium transition",
                  status === t.key ? "bg-brand-gradient text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200",
                )}
              >
                {t.label} {countFor(t.key) ? <span className="opacity-70">{countFor(t.key)}</span> : null}
              </Link>
            ))}
            {supplier ? (
              <Link href={`${base}?status=${status}`} className="text-xs font-medium text-slate-500 underline">
                clear {supplier} filter
              </Link>
            ) : null}
          </div>

          {desk.length ? (
            <div className="space-y-3">
              {desk.map((row) => (
                <SupplierOrderCard key={row.id} locationId={locationId} row={row} />
              ))}
            </div>
          ) : (
            <div className="card p-8 text-center text-sm text-slate-500">Nothing in this list.</div>
          )}
        </>
      )}
    </div>
  );
}
