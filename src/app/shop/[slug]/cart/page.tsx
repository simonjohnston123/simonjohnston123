import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { loadCart } from "@/lib/cart";
import { QtyControl, CheckoutBox } from "@/components/shop-cart";

export const dynamic = "force-dynamic";

const money = (c: number) => `$${(c / 100).toFixed(2)}`;

export default async function CartPage({
  params, searchParams,
}: {
  params: { slug: string };
  searchParams: { to?: string };
}) {
  const location = await prisma.location.findUnique({
    where: { slug: params.slug },
    include: { site: true },
  });
  if (!location) notFound();

  const primary = location.site?.primaryColor || "#1d5df5";
  const cart = await loadCart(location.id, searchParams.to);
  const to = cart.destination ?? "AU";
  const base = `/shop/${location.slug}`;
  const sellable = cart.lines.filter((l) => l.deliverable);
  const allFreeDelivery = sellable.length > 0 && sellable.every((l) => l.freeDelivery);

  return (
    <main className="min-h-screen bg-slate-50">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-4">
          <Link href={`${base}?to=${to}`} className="text-sm font-medium text-slate-500 hover:text-slate-800">
            ← Keep shopping
          </Link>
          <span className="text-sm text-slate-500">Delivering to <strong className="text-slate-900">{to}</strong></span>
        </div>
      </header>

      <div className="mx-auto max-w-4xl px-4 py-10">
        <h1 className="mb-6 text-2xl font-bold text-slate-900">Your basket</h1>

        {cart.lines.length === 0 ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center">
            <p className="text-slate-500">Your basket is empty.</p>
            <Link href={`${base}?to=${to}`} className="mt-4 inline-block rounded-xl px-5 py-2.5 text-sm font-semibold text-white" style={{ backgroundColor: primary }}>
              Browse products
            </Link>
          </div>
        ) : (
          <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_320px]">
            <div className="space-y-3">
              {cart.lines.map((l) => (
                <div key={l.id} className={`flex gap-4 rounded-2xl border bg-white p-4 ${l.deliverable ? "border-slate-200" : "border-amber-300 bg-amber-50"}`}>
                  <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-xl bg-slate-50">
                    {l.image ? <Image src={l.image} alt={l.name} fill sizes="80px" className="object-contain p-1" /> : null}
                  </div>
                  <div className="min-w-0 flex-1">
                    <Link href={`${base}/p/${l.id}?to=${to}`} className="line-clamp-2 text-sm font-semibold text-slate-900 hover:underline">
                      {l.name}
                    </Link>
                    {!l.deliverable ? (
                      <p className="mt-1 text-xs font-medium text-amber-700">
                        We can&apos;t send this one to {to} — remove it to check out.
                      </p>
                    ) : (
                      <p className="mt-1 text-xs text-slate-500">
                        {money(l.unitCents)} each{l.freeDelivery ? " · free delivery" : ""}
                        {l.shipsFrom ? ` · ships from ${l.shipsFrom}` : ""}
                      </p>
                    )}
                    <div className="mt-2">
                      <QtyControl slug={location.slug} productId={l.id} qty={l.qty} />
                    </div>
                  </div>
                  <div className="text-right font-semibold text-slate-900 tabular-nums">{money(l.lineCents)}</div>
                </div>
              ))}
            </div>

            <aside className="h-fit rounded-2xl border border-slate-200 bg-white p-5">
              <div className="mb-4 space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-slate-500">Subtotal</span>
                  <span className="font-semibold tabular-nums">{money(cart.subtotalCents)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Delivery</span>
                  <span className="font-medium">{allFreeDelivery ? "Free" : "Calculated at checkout"}</span>
                </div>
              </div>

              {cart.hasUndeliverable ? (
                <p className="mb-3 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
                  Some items can&apos;t be delivered to {to}. They&apos;re excluded from the total.
                </p>
              ) : null}

              <CheckoutBox slug={location.slug} primary={primary} disabled={sellable.length === 0} />
            </aside>
          </div>
        )}
      </div>
    </main>
  );
}
