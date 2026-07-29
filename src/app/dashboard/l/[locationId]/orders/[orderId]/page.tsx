import Link from "next/link";
import { notFound } from "next/navigation";
import { requireLocationAccess } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { Badge } from "@/components/ui";
import { formatMoney, formatDateTime, contactName } from "@/lib/utils";
import { setOrderStatusAction, deleteOrderAction } from "../actions";
import { STATUS_COLOR, statusLabel } from "../page";

export const dynamic = "force-dynamic";

const FLOW: Record<string, string[]> = {
  PRODUCT: ["NEW", "CONFIRMED", "PREPARING", "READY", "COMPLETED", "CANCELLED"],
  DELIVERY: ["NEW", "CONFIRMED", "PREPARING", "OUT_FOR_DELIVERY", "COMPLETED", "CANCELLED"],
};

export default async function OrderDetailPage({ params }: { params: { locationId: string; orderId: string } }) {
  const { locationId, orderId } = params;
  await requireLocationAccess(locationId);

  const order = await prisma.order.findFirst({ where: { id: orderId, locationId }, include: { contact: true } });
  if (!order) notFound();

  const items = Array.isArray(order.items) ? (order.items as { name: string; qty: number; price: number }[]) : [];
  const base = `/dashboard/l/${locationId}/orders`;
  const flow = FLOW[order.type] ?? FLOW.PRODUCT;

  return (
    <div>
      <Link href={base} className="mb-3 inline-block text-xs font-medium text-slate-400 hover:text-slate-600">← All orders</Link>

      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-bold text-slate-900">Order #{order.number}</h1>
          <Badge color={order.type === "DELIVERY" ? "amber" : "blue"}>{order.type === "DELIVERY" ? "Delivery" : "Product"}</Badge>
          <Badge color={STATUS_COLOR[order.status]}>{statusLabel(order.status)}</Badge>
        </div>
        <form action={deleteOrderAction}>
          <input type="hidden" name="locationId" value={locationId} />
          <input type="hidden" name="orderId" value={order.id} />
          <button className="btn-ghost text-sm text-slate-400 hover:text-red-600">Delete</button>
        </form>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <section className="card p-5">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Items</h2>
            <table className="mt-3 w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wide text-slate-400">
                  <th className="pb-2">Item</th>
                  <th className="pb-2 text-right">Qty</th>
                  <th className="pb-2 text-right">Price</th>
                  <th className="pb-2 text-right">Line</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {items.map((it, i) => (
                  <tr key={i}>
                    <td className="py-2 text-slate-800">{it.name}</td>
                    <td className="py-2 text-right text-slate-600">{it.qty}</td>
                    <td className="py-2 text-right text-slate-600">{formatMoney(it.price)}</td>
                    <td className="py-2 text-right font-medium text-slate-800">{formatMoney(it.qty * it.price)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t border-slate-200">
                  <td colSpan={3} className="pt-2 text-right text-sm font-semibold text-slate-500">Total</td>
                  <td className="pt-2 text-right text-lg font-bold text-slate-900">{formatMoney(order.total)}</td>
                </tr>
              </tfoot>
            </table>
          </section>

          {order.notes ? (
            <section className="card p-5">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Notes</h2>
              <p className="mt-2 whitespace-pre-line text-sm text-slate-600">{order.notes}</p>
            </section>
          ) : null}
        </div>

        <div className="space-y-6">
          <section className="card p-5">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Update status</h2>
            <div className="mt-3 flex flex-wrap gap-2">
              {flow.map((st) => (
                <form key={st} action={setOrderStatusAction}>
                  <input type="hidden" name="locationId" value={locationId} />
                  <input type="hidden" name="orderId" value={order.id} />
                  <input type="hidden" name="status" value={st} />
                  <button
                    className={`rounded-lg px-3 py-1.5 text-xs font-medium ${order.status === st ? "bg-brand-600 text-white" : "border border-slate-200 text-slate-600 hover:bg-slate-50"}`}
                  >
                    {statusLabel(st)}
                  </button>
                </form>
              ))}
            </div>
          </section>

          <section className="card p-5">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Customer</h2>
            <div className="mt-2 text-sm text-slate-700">
              <div className="font-medium">{order.customerName || (order.contact ? contactName(order.contact) : "Walk-in")}</div>
              {order.customerPhone ? <div className="text-slate-500">{order.customerPhone}</div> : null}
              {order.customerEmail ? <div className="text-slate-500">{order.customerEmail}</div> : null}
              {order.contact ? (
                <Link href={`${base.replace("/orders", "")}/contacts/${order.contact.id}`} className="mt-1 inline-block text-xs text-brand-600 hover:underline">
                  View contact →
                </Link>
              ) : null}
            </div>
            {order.deliveryAddress ? (
              <div className="mt-3">
                <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">Deliver to</div>
                <p className="mt-1 text-sm text-slate-700">{order.deliveryAddress}</p>
              </div>
            ) : null}
          </section>
        </div>
      </div>
    </div>
  );
}
