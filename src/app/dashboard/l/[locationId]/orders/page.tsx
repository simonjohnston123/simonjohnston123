import Link from "next/link";
import { requireLocationAccess } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { PageHeader, Badge, SegTabs } from "@/components/ui";
import { NewOrderButton } from "@/components/new-order";
import { OrderSyncButton } from "@/components/order-sync-button";
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

const PER_PAGE_OPTIONS = [25, 50, 100, 200];
// Channel filter value → the `source` string we store on the order.
const CHANNEL_SOURCE: Record<string, string> = { ebay: "eBay", shopify: "Shopify", manual: "" };

function sourceChip(source: string | null) {
  const s = source || "Manual";
  const color =
    source === "eBay" ? "bg-amber-50 text-amber-700"
    : source === "Shopify" ? "bg-green-50 text-green-700"
    : "bg-slate-100 text-slate-500";
  return <span className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium ${color}`}>{s}</span>;
}

export default async function OrdersPage({
  params,
  searchParams,
}: {
  params: { locationId: string };
  searchParams: Record<string, string | undefined>;
}) {
  const { locationId } = params;
  await requireLocationAccess(locationId);

  const type = searchParams.type === "PRODUCT" || searchParams.type === "DELIVERY" ? searchParams.type : undefined;
  const channel = searchParams.channel && searchParams.channel in CHANNEL_SOURCE ? searchParams.channel : undefined;
  const from = searchParams.from || "";
  const to = searchParams.to || "";
  const min = searchParams.min || "";
  const max = searchParams.max || "";
  const loc = (searchParams.loc || "").trim();
  const per = PER_PAGE_OPTIONS.includes(Number(searchParams.per)) ? Number(searchParams.per) : 50;
  const page = Math.max(1, Number(searchParams.page) || 1);

  // Build the filter. placedAt is the marketplace order date (falls back to import time in the UI).
  const where: Prisma.OrderWhereInput = { locationId };
  if (type) where.type = type;
  if (channel === "manual") where.source = null;
  else if (channel) where.source = CHANNEL_SOURCE[channel];
  if (from || to) {
    where.placedAt = {};
    if (from) where.placedAt.gte = new Date(`${from}T00:00:00`);
    if (to) where.placedAt.lte = new Date(`${to}T23:59:59`);
  }
  if (min || max) {
    where.total = {};
    if (min) where.total.gte = Number(min);
    if (max) where.total.lte = Number(max);
  }
  if (loc) where.deliveryAddress = { contains: loc, mode: "insensitive" };

  const [count, agg, orders, channelConns] = await Promise.all([
    prisma.order.count({ where }),
    prisma.order.aggregate({ where, _sum: { total: true } }),
    prisma.order.findMany({
      where,
      orderBy: [{ placedAt: { sort: "desc", nulls: "last" } }, { createdAt: "desc" }],
      skip: (page - 1) * per,
      take: per,
    }),
    prisma.connection.findMany({
      where: { locationId, provider: { in: ["SHOPIFY", "EBAY"] }, status: "CONNECTED" },
      select: { provider: true },
    }),
  ]);

  const hasShopify = channelConns.some((c) => c.provider === "SHOPIFY");
  const hasEbay = channelConns.some((c) => c.provider === "EBAY");
  const base = `/dashboard/l/${locationId}/orders`;
  const pageCount = Math.max(1, Math.ceil(count / per));
  const startRow = count === 0 ? 0 : (page - 1) * per + 1;
  const endRow = Math.min(count, page * per);
  const filteredTotal = agg._sum.total ?? 0;

  // Preserve the current filter set in a link, overriding whatever is passed.
  const qs = (overrides: Record<string, string | number | undefined>) => {
    const p = new URLSearchParams();
    const merged: Record<string, string | number | undefined> = { type, channel, from, to, min, max, loc, per, page, ...overrides };
    for (const [k, v] of Object.entries(merged)) if (v !== undefined && v !== "" && v !== null) p.set(k, String(v));
    const s = p.toString();
    return s ? `${base}?${s}` : base;
  };

  const channelTabs: { key: string; label: string }[] = [
    { key: "", label: "All channels" },
    ...(hasEbay ? [{ key: "ebay", label: "eBay" }] : []),
    ...(hasShopify ? [{ key: "shopify", label: "Shopify" }] : []),
    { key: "manual", label: "Manual" },
  ];

  return (
    <div>
      <PageHeader
        title="Orders"
        subtitle={`${count} order${count === 1 ? "" : "s"} · ${formatMoney(filteredTotal)}`}
        action={
          <div className="flex items-center gap-2">
            {hasShopify ? <OrderSyncButton locationId={locationId} channel="shopify" /> : null}
            {hasEbay ? <OrderSyncButton locationId={locationId} channel="ebay" /> : null}
            <NewOrderButton locationId={locationId} />
          </div>
        }
      />

      <SegTabs
        active={type ?? "all"}
        items={[
          { key: "all", label: "All", href: qs({ type: undefined, page: undefined }) },
          { key: "PRODUCT", label: "Products", href: qs({ type: "PRODUCT", page: undefined }) },
          { key: "DELIVERY", label: "Deliveries", href: qs({ type: "DELIVERY", page: undefined }) },
        ]}
      />

      {/* Channel filter chips — only channels this business has connected. */}
      <div className="mb-3 flex flex-wrap gap-2">
        {channelTabs.map((c) => {
          const active = (channel ?? "") === c.key;
          return (
            <Link
              key={c.key || "all"}
              href={qs({ channel: c.key || undefined, page: undefined })}
              className={active ? "btn-primary text-xs" : "btn-secondary text-xs"}
            >
              {c.label}
            </Link>
          );
        })}
      </div>

      {/* Filter bar: date range, value between, location, per-page. Plain GET form. */}
      <form method="get" className="card mb-4 flex flex-wrap items-end gap-3 p-3">
        {type ? <input type="hidden" name="type" value={type} /> : null}
        {channel ? <input type="hidden" name="channel" value={channel} /> : null}
        <label className="text-xs text-slate-500">Placed from
          <input type="date" name="from" defaultValue={from} className="input mt-1 h-9 text-sm" />
        </label>
        <label className="text-xs text-slate-500">to
          <input type="date" name="to" defaultValue={to} className="input mt-1 h-9 text-sm" />
        </label>
        <label className="text-xs text-slate-500">Value min
          <input type="number" name="min" defaultValue={min} placeholder="$0" className="input mt-1 h-9 w-24 text-sm" />
        </label>
        <label className="text-xs text-slate-500">max
          <input type="number" name="max" defaultValue={max} placeholder="$∞" className="input mt-1 h-9 w-24 text-sm" />
        </label>
        <label className="text-xs text-slate-500">Location
          <input type="text" name="loc" defaultValue={loc} placeholder="state, city or country" className="input mt-1 h-9 w-44 text-sm" />
        </label>
        <label className="text-xs text-slate-500">Per page
          <select name="per" defaultValue={String(per)} className="input mt-1 h-9 w-20 text-sm">
            {PER_PAGE_OPTIONS.map((n) => <option key={n} value={n}>{n}</option>)}
          </select>
        </label>
        <div className="flex gap-2">
          <button className="btn-primary h-9 text-sm">Apply</button>
          <Link href={base} className="btn-secondary h-9 text-sm">Clear</Link>
        </div>
      </form>

      {orders.length === 0 ? (
        <div className="card p-10 text-center">
          <p className="text-base font-medium text-slate-800">No orders match</p>
          <p className="mx-auto mt-1 max-w-md text-sm text-slate-500">Try widening the date range or clearing filters — or sync a channel to pull orders in.</p>
        </div>
      ) : (
        <>
          <div className="card p-1.5">
            {orders.map((o) => (
              <Link key={o.id} href={`${base}/${o.id}`} className="list-row">
                <span className="tile bg-brand-50">{o.type === "DELIVERY" ? "🚚" : "📦"}</span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-2">
                    <span className="truncate text-sm font-semibold text-slate-800">{o.customerName || "Walk-in"}</span>
                    <span className="shrink-0 font-mono text-[11px] text-slate-400">#{o.number}</span>
                    {sourceChip(o.source)}
                  </span>
                  <span className="mt-0.5 flex items-center gap-2">
                    <Badge color={STATUS_COLOR[o.status]}>{statusLabel(o.status)}</Badge>
                    <span className="text-xs text-slate-500">{formatDateTime(o.placedAt ?? o.createdAt)}</span>
                  </span>
                </span>
                <span className="shrink-0 text-sm font-semibold text-slate-900">{formatMoney(o.total)}</span>
              </Link>
            ))}
          </div>

          {/* Pagination */}
          <div className="mt-3 flex items-center justify-between text-sm text-slate-500">
            <span>Showing {startRow}–{endRow} of {count}</span>
            <span className="flex items-center gap-2">
              {page > 1 ? <Link href={qs({ page: page - 1 })} className="btn-secondary text-xs">← Prev</Link> : <span className="btn-secondary cursor-not-allowed text-xs opacity-40">← Prev</span>}
              <span className="text-xs">Page {page} of {pageCount}</span>
              {page < pageCount ? <Link href={qs({ page: page + 1 })} className="btn-secondary text-xs">Next →</Link> : <span className="btn-secondary cursor-not-allowed text-xs opacity-40">Next →</span>}
            </span>
          </div>
        </>
      )}
    </div>
  );
}
