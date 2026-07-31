import Link from "next/link";
import { requireLocationAccess } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { PageHeader, Badge, SegTabs } from "@/components/ui";
import { NewOrderButton } from "@/components/new-order";
import { ShopifySyncButton } from "@/components/shopify-sync-button";
import { formatMoney, formatDateTime } from "@/lib/utils";
import type { Prisma } from "@prisma/client";

export const dynamic = "force-dynamic";

export const STATUS_COLOR: Record<string, "slate" | "green" | "red" | "amber" | "blue"> = {
  NEW: "slate",
  CONFIRMED: "blue",
  PREPARING: "amber",
  READY: "blue",
  OUT_FOR_DELIVERY: "amber",
  COMPLETED: "green",
  CANCELLED: "red",
};

export function statusLabel(s: string): string {
  return s.replace(/_/g, " ").toLowerCase();
}

export default async function OrdersPage({
  params,
  searchParams,
}: {
  params: { locationId: string };
  searchParams: { type?: string };
}) {
  const { locationId } = params;
  await requireLocationAccess(locationId);

  const filter = searchParams.type === "PRODUCT" || searchParams.type === "DELIVERY" ? searchParams.type : undefined;
  const where: Prisma.OrderWhereInput = { locationId, ...(filter ? { type: filter } : {}) };

  const orders = await prisma.order.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: 300,
  });

  const base = `/dashboard/l/${locationId}/orders`;
  const open = orders.filter((o) => !["COMPLETED", "CANCELLED"].includes(o.status)).length;

  const shopifyConn = await prisma.connection.findFirst({
    where: { locationId, provider: "SHOPIFY", status: "CONNECTED" },
    select: { id: true },
  });

  return (
    <div>
      <PageHeader
        title="Orders"
        subtitle={`${open} open`}
        action={
          <div className="flex items-center gap-2">
            {shopifyConn ? <ShopifySyncButton locationId={locationId} /> : null}
            <NewOrderButton locationId={locationId} />
          </div>
        }
      />

      <SegTabs
        active={filter ?? "all"}
        items={[
          { key: "all", label: "All", href: base },
          { key: "PRODUCT", label: "Products", href: `${base}?type=PRODUCT` },
          { key: "DELIVERY", label: "Deliveries", href: `${base}?type=DELIVERY` },
        ]}
      />

      {orders.length === 0 ? (
        <div className="card p-10 text-center">
          <p className="text-base font-medium text-slate-800">No orders yet</p>
          <p className="mx-auto mt-1 max-w-md text-sm text-slate-500">Create a product order or a delivery job to get started.</p>
        </div>
      ) : (
        <div className="card p-1.5">
          {orders.map((o) => (
            <Link key={o.id} href={`${base}/${o.id}`} className="list-row">
              <span className="tile bg-brand-50">{o.type === "DELIVERY" ? "🚚" : "📦"}</span>
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-2">
                  <span className="truncate text-sm font-semibold text-slate-800">{o.customerName || "Walk-in"}</span>
                  <span className="shrink-0 font-mono text-[11px] text-slate-400">#{o.number}</span>
                </span>
                <span className="mt-0.5 flex items-center gap-2">
                  <Badge color={STATUS_COLOR[o.status]}>{statusLabel(o.status)}</Badge>
                  <span className="text-xs text-slate-500">{formatDateTime(o.createdAt)}</span>
                </span>
              </span>
              <span className="shrink-0 text-sm font-semibold text-slate-900">{formatMoney(o.total)}</span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
