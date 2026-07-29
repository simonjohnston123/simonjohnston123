import Link from "next/link";
import { requireLocationAccess } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { PageHeader, Badge } from "@/components/ui";
import { NewOrderButton } from "@/components/new-order";
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
  const Tab = ({ v, label }: { v?: string; label: string }) => (
    <Link
      href={v ? `${base}?type=${v}` : base}
      className={`rounded-lg px-3 py-1.5 text-sm font-medium ${(!filter && !v) || filter === v ? "bg-brand-600 text-white" : "text-slate-600 hover:bg-slate-100"}`}
    >
      {label}
    </Link>
  );

  return (
    <div>
      <PageHeader title="Orders" subtitle={`${open} open`} action={<NewOrderButton locationId={locationId} />} />

      <div className="mb-4 flex gap-1">
        <Tab label="All" />
        <Tab v="PRODUCT" label="Products" />
        <Tab v="DELIVERY" label="Deliveries" />
      </div>

      {orders.length === 0 ? (
        <div className="card p-10 text-center">
          <p className="text-base font-medium text-slate-800">No orders yet</p>
          <p className="mx-auto mt-1 max-w-md text-sm text-slate-500">Create a product order or a delivery job to get started.</p>
        </div>
      ) : (
        <div className="card divide-y divide-slate-100">
          {orders.map((o) => (
            <Link key={o.id} href={`${base}/${o.id}`} className="flex items-center gap-4 px-4 py-3 hover:bg-slate-50">
              <span className="w-14 font-mono text-sm text-slate-500">#{o.number}</span>
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium text-slate-800">{o.customerName || "Walk-in"}</div>
                <div className="text-xs text-slate-500">
                  {o.type === "DELIVERY" ? "🚚 Delivery" : "📦 Product"} · {formatDateTime(o.createdAt)}
                </div>
              </div>
              <Badge color={STATUS_COLOR[o.status]}>{statusLabel(o.status)}</Badge>
              <span className="w-24 text-right text-sm font-semibold text-slate-900">{formatMoney(o.total)}</span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
