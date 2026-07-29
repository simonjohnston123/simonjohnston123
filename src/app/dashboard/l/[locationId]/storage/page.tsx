import Link from "next/link";
import { requireLocationAccess } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { PageHeader, Badge } from "@/components/ui";
import { getYard, buildGrid } from "@/lib/storage";
import { StorageNewBooking } from "@/components/storage-new-booking";
import {
  seedStorageAction,
  setStorageBookingStatusAction,
  setStorageRequestStatusAction,
  updateStorageSettingsAction,
  saveStorageProductAction,
  deleteStorageProductAction,
} from "./actions";

export const dynamic = "force-dynamic";

function money(cents: number) {
  return new Intl.NumberFormat("en-AU", { style: "currency", currency: "AUD" }).format((cents || 0) / 100);
}
const STATUS_COLOR: Record<string, "green" | "amber" | "red" | "slate" | "blue"> = {
  ACTIVE: "green", PENDING_PAYMENT: "amber", SUSPENDED: "amber", CANCELLED: "red", ENDED: "slate", WAITLISTED: "blue",
};
const fmt = (d: Date | null) => (d ? new Date(d).toLocaleDateString("en-AU") : "—");

export default async function StoragePage({ params }: { params: { locationId: string } }) {
  const { locationId } = params;
  await requireLocationAccess(locationId);

  const yard = await getYard(locationId);

  // Not set up yet → offer one-click seed.
  if (!yard.settings) {
    return (
      <div>
        <PageHeader title="Storage yard" subtitle="Manage the yard natively in the CRM" />
        <div className="card p-8 text-center">
          <div className="mx-auto mb-3 grid h-14 w-14 place-items-center rounded-2xl bg-brand-gradient text-2xl text-white">▦</div>
          <h2 className="text-lg font-semibold text-slate-800">Set up the yard</h2>
          <p className="mx-auto mt-1 max-w-md text-sm text-slate-500">
            Load the Placid Storage products, pricing and capacity so you can manage bookings, PINs and occupancy right here — no separate login.
          </p>
          <form action={seedStorageAction} className="mt-5">
            <input type="hidden" name="locationId" value={locationId} />
            <button className="btn-primary">Set up storage yard →</button>
          </form>
        </div>
      </div>
    );
  }

  // Names for the booking customers.
  const contactIds = [...new Set(yard.bookings.map((b) => b.contactId).filter(Boolean) as string[])];
  const contacts = contactIds.length ? await prisma.contact.findMany({ where: { id: { in: contactIds } }, select: { id: true, firstName: true, lastName: true } }) : [];
  const nameById = new Map(contacts.map((c) => [c.id, [c.firstName, c.lastName].filter(Boolean).join(" ") || "—"]));

  const products = yard.products.map((p) => ({ id: p.id, name: p.name, spotType: p.spotType }));
  const base = `/dashboard/l/${locationId}`;
  const carGrid = buildGrid("CAR", yard.occupancy.car.capacity, yard.bookings);
  const containerGrid = buildGrid("CONTAINER", yard.occupancy.container.capacity, yard.bookings);

  const Grid = ({ title, cells }: { title: string; cells: { label: string; booking: { ref: string } | null }[] }) => (
    <div className="card p-5">
      <h3 className="mb-3 text-sm font-semibold text-slate-800">{title}</h3>
      {cells.length === 0 ? (
        <p className="text-sm text-slate-400">Set a capacity in Yard settings to see the grid.</p>
      ) : (
        <div className="grid grid-cols-4 gap-2 sm:grid-cols-6 lg:grid-cols-8">
          {cells.map((c) => (
            <div
              key={c.label}
              title={c.booking ? `${c.label} · ${c.booking.ref}` : `${c.label} · free`}
              className={`grid aspect-square place-items-center rounded-lg border text-center text-[11px] font-medium ${
                c.booking ? "border-transparent bg-brand-gradient text-white shadow-sm" : "border-dashed border-slate-300 text-slate-400"
              }`}
            >
              {c.label.replace(/\D+/g, "")}
            </div>
          ))}
        </div>
      )}
    </div>
  );

  return (
    <div>
      <PageHeader
        title="Storage yard"
        subtitle="Placid Storage — 27 Toolooa Street, South Gladstone"
        action={<StorageNewBooking locationId={locationId} products={products} />}
      />

      {/* Occupancy */}
      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Occ label="Car bays" o={yard.occupancy.car} />
        <Occ label="Units / lockers" o={yard.occupancy.container} />
        <div className="card p-5"><div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Waitlist</div><div className="mt-1 text-3xl font-bold text-slate-900">{yard.waitlist.length}</div></div>
        <div className="card p-5"><div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Open requests</div><div className="mt-1 text-3xl font-bold text-slate-900">{yard.requests.length}</div></div>
      </div>

      {/* Occupancy grid — which bays/units are booked */}
      <div className="mb-6 grid gap-4 lg:grid-cols-2">
        <Grid title={`Car bays (${yard.occupancy.car.occupied}/${yard.occupancy.car.capacity})`} cells={carGrid} />
        <Grid title={`Units / lockers (${yard.occupancy.container.occupied}/${yard.occupancy.container.capacity})`} cells={containerGrid} />
      </div>

      {/* Bookings */}
      <section className="card mb-6 overflow-hidden">
        <div className="border-b border-slate-100 px-5 py-3 text-sm font-semibold text-slate-800">Bookings ({yard.bookings.length})</div>
        {yard.bookings.length === 0 ? (
          <p className="px-5 py-8 text-center text-sm text-slate-400">No bookings yet. Add one, or they&rsquo;ll arrive from the online booking site (Phase 2).</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="text-left text-xs uppercase tracking-wide text-slate-400">
                <th className="px-5 py-2">Ref</th><th className="px-2 py-2">Customer</th><th className="px-2 py-2">Spot</th>
                <th className="px-2 py-2">Term</th><th className="px-2 py-2">PIN</th><th className="px-2 py-2">Amount</th><th className="px-5 py-2 text-right">Status</th>
              </tr></thead>
              <tbody className="divide-y divide-slate-100">
                {yard.bookings.map((b) => (
                  <tr key={b.id} className="hover:bg-slate-50">
                    <td className="px-5 py-2 font-mono text-xs text-slate-500">{b.ref}</td>
                    <td className="px-2 py-2 text-slate-800">
                      {b.contactId ? <Link href={`${base}/contacts/${b.contactId}`} className="text-brand-700 hover:underline">{nameById.get(b.contactId)}</Link> : "—"}
                      {b.vehicleRego ? <span className="block text-xs text-slate-400">{[b.vehicleMake, b.vehicleModel, b.vehicleRego].filter(Boolean).join(" ")}</span> : null}
                    </td>
                    <td className="px-2 py-2 text-slate-600">{b.spotLabel ? <span className="font-medium">{b.spotLabel}</span> : b.product?.name ?? b.spotType}</td>
                    <td className="px-2 py-2 text-xs text-slate-500">{b.term.toLowerCase()}{b.openEnded ? " · open" : b.endDate ? ` · to ${fmt(b.endDate)}` : ""}</td>
                    <td className="px-2 py-2 font-mono text-slate-700">{b.pin ?? "—"}</td>
                    <td className="px-2 py-2 text-slate-700">{money(b.amountCents)}</td>
                    <td className="px-5 py-2">
                      <form action={setStorageBookingStatusAction} className="flex items-center justify-end gap-1">
                        <input type="hidden" name="locationId" value={locationId} />
                        <input type="hidden" name="bookingId" value={b.id} />
                        <select name="status" defaultValue={b.status} className="input h-8 w-32 py-0 text-xs">
                          {["ACTIVE", "SUSPENDED", "PENDING_PAYMENT", "ENDED", "CANCELLED"].map((s) => <option key={s} value={s}>{s.replace("_", " ").toLowerCase()}</option>)}
                        </select>
                        <button className="text-xs text-brand-600 hover:underline">Set</button>
                      </form>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Service requests */}
        <section className="card p-5">
          <h3 className="mb-3 text-sm font-semibold text-slate-800">Open service requests</h3>
          {yard.requests.length === 0 ? <p className="text-sm text-slate-400">None open.</p> : (
            <div className="space-y-2">
              {yard.requests.map((r) => (
                <div key={r.id} className="rounded-lg border border-slate-200 p-3 text-sm">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium text-slate-800">{r.name} · {r.category}</span>
                    <form action={setStorageRequestStatusAction}>
                      <input type="hidden" name="locationId" value={locationId} />
                      <input type="hidden" name="requestId" value={r.id} />
                      <input type="hidden" name="status" value="RESOLVED" />
                      <button className="text-xs text-brand-600 hover:underline">Resolve</button>
                    </form>
                  </div>
                  <p className="mt-1 text-slate-600">{r.message}</p>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Products & pricing */}
        <section className="card p-5">
          <h3 className="mb-3 text-sm font-semibold text-slate-800">Products &amp; pricing</h3>
          <div className="space-y-1.5">
            {yard.products.map((p) => (
              <div key={p.id} className="flex items-center justify-between rounded-lg border border-slate-200 px-3 py-2 text-sm">
                <span className="text-slate-700">{p.name}</span>
                <span className="font-medium text-slate-900">{money(p.priceMonthlyCents)}/mo{p.priceWeeklyCents ? ` · ${money(p.priceWeeklyCents)}/wk` : ""}</span>
              </div>
            ))}
          </div>
          {yard.waitlist.length ? (
            <>
              <h3 className="mb-2 mt-4 text-sm font-semibold text-slate-800">Waitlist</h3>
              <div className="space-y-1.5">
                {yard.waitlist.map((w) => (
                  <div key={w.id} className="flex items-center justify-between rounded-lg border border-slate-200 px-3 py-2 text-sm">
                    <span className="text-slate-700">{w.name}</span>
                    <span className="text-xs text-slate-400">{w.spotType.toLowerCase()}</span>
                  </div>
                ))}
              </div>
            </>
          ) : null}
        </section>
      </div>

      {/* Editable yard settings */}
      <details className="card mt-6 p-5">
        <summary className="cursor-pointer text-sm font-semibold text-slate-800">Yard settings — capacity &amp; pricing</summary>

        <form action={updateStorageSettingsAction} className="mt-4 grid gap-3 sm:grid-cols-3">
          <input type="hidden" name="locationId" value={locationId} />
          <div>
            <label className="label">Car bays (capacity)</label>
            <input name="carCapacity" type="number" min="0" defaultValue={yard.settings.carCapacity} className="input" />
          </div>
          <div>
            <label className="label">Units / lockers (capacity)</label>
            <input name="containerCapacity" type="number" min="0" defaultValue={yard.settings.containerCapacity} className="input" />
          </div>
          <div className="flex items-end">
            <button className="btn-primary w-full">Save capacity</button>
          </div>
          <div className="sm:col-span-3">
            <label className="label">Yard address</label>
            <input name="siteAddress" defaultValue={yard.settings.siteAddress ?? ""} className="input" />
          </div>
        </form>

        <h4 className="mb-2 mt-6 text-sm font-semibold text-slate-700">Products &amp; prices</h4>
        <div className="space-y-2">
          {yard.products.map((p) => (
            <form key={p.id} action={saveStorageProductAction} className="flex flex-wrap items-end gap-2 rounded-lg border border-slate-200 p-2">
              <input type="hidden" name="locationId" value={locationId} />
              <input type="hidden" name="productId" value={p.id} />
              <input name="name" defaultValue={p.name} className="input h-9 min-w-[180px] flex-1 py-1 text-sm" />
              <select name="spotType" defaultValue={p.spotType} className="input h-9 w-28 py-1 text-sm">
                <option value="CAR">Car bay</option>
                <option value="CONTAINER">Unit</option>
              </select>
              <input name="monthly" type="number" step="0.01" defaultValue={(p.priceMonthlyCents / 100).toFixed(2)} className="input h-9 w-24 py-1 text-sm" placeholder="$/mo" />
              <input name="weekly" type="number" step="0.01" defaultValue={p.priceWeeklyCents ? (p.priceWeeklyCents / 100).toFixed(2) : ""} className="input h-9 w-24 py-1 text-sm" placeholder="$/wk" />
              <button className="btn-secondary text-sm">Save</button>
              <button formAction={deleteStorageProductAction} className="btn-ghost text-sm text-slate-400 hover:text-red-600">Delete</button>
            </form>
          ))}
        </div>

        <h4 className="mb-2 mt-6 text-sm font-semibold text-slate-700">Add a product</h4>
        <form action={saveStorageProductAction} className="flex flex-wrap items-end gap-2">
          <input type="hidden" name="locationId" value={locationId} />
          <input name="name" placeholder="Product name" className="input h-9 min-w-[180px] flex-1 py-1 text-sm" />
          <select name="spotType" defaultValue="CONTAINER" className="input h-9 w-28 py-1 text-sm">
            <option value="CAR">Car bay</option>
            <option value="CONTAINER">Unit</option>
          </select>
          <input name="monthly" type="number" step="0.01" className="input h-9 w-24 py-1 text-sm" placeholder="$/mo" />
          <input name="weekly" type="number" step="0.01" className="input h-9 w-24 py-1 text-sm" placeholder="$/wk" />
          <button className="btn-primary text-sm">+ Add</button>
        </form>
      </details>
    </div>
  );
}

function Occ({ label, o }: { label: string; o: { capacity: number; occupied: number; available: number } }) {
  return (
    <div className="card p-5">
      <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</div>
      <div className="mt-1 text-3xl font-bold text-slate-900">{o.occupied}/{o.capacity}</div>
      <div className="text-sm font-medium text-brand-600">{o.available} available</div>
    </div>
  );
}
