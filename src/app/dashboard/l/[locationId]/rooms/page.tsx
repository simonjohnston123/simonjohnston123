import Link from "next/link";
import { requireLocationAccess } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { PageHeader, Badge } from "@/components/ui";
import { SubmitButton } from "@/components/submit-button";
import { addRoomAction, deleteRoomAction, saveHomesteadSettingsAction, setBookingStatusAction } from "./actions";
import { formatDate } from "@/lib/utils";

export const dynamic = "force-dynamic";

const money = (n: number) => `$${n.toLocaleString()}`;
const bColor: Record<string, "green" | "amber" | "slate" | "red"> = { ACTIVE: "green", PENDING: "amber", ENDED: "slate", CANCELLED: "red" };

export default async function RoomsPage({ params }: { params: { locationId: string } }) {
  const { location } = await requireLocationAccess(params.locationId);
  const [rooms, bookings, settings] = await Promise.all([
    prisma.homesteadRoom.findMany({ where: { locationId: params.locationId }, orderBy: { createdAt: "asc" } }),
    prisma.homesteadBooking.findMany({ where: { locationId: params.locationId }, include: { room: true }, orderBy: { createdAt: "desc" }, take: 50 }),
    prisma.homesteadSettings.findUnique({ where: { locationId: params.locationId } }),
  ]);

  return (
    <div>
      <PageHeader title="Rooms" subtitle="Short-term accommodation — rooms, guests & house rules"
        action={<Link href={`/homestead/${location.slug}`} target="_blank" className="btn-secondary text-sm">View booking page ↗</Link>} />

      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <div className="space-y-6">
          {/* Rooms */}
          <section>
            <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-500">Rooms</h2>
            <div className="grid gap-3 sm:grid-cols-2">
              {rooms.map((r) => (
                <div key={r.id} className="card overflow-hidden p-0">
                  {r.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={r.imageUrl} alt={r.name} className="h-32 w-full object-cover" />
                  ) : <div className="grid h-32 w-full place-items-center bg-slate-100 text-3xl text-slate-300">🛏</div>}
                  <div className="p-3">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-slate-900">{r.name}</span>
                      {r.active ? <Badge color="green">Active</Badge> : <Badge color="slate">Hidden</Badge>}
                    </div>
                    <div className="text-sm font-semibold text-brand-700">{money(r.weeklyPrice)}/week</div>
                    {r.description ? <p className="mt-1 line-clamp-2 text-xs text-slate-500">{r.description}</p> : null}
                    <form action={deleteRoomAction} className="mt-2 text-right">
                      <input type="hidden" name="locationId" value={params.locationId} /><input type="hidden" name="roomId" value={r.id} />
                      <button className="text-xs text-slate-400 hover:text-red-600">Delete</button>
                    </form>
                  </div>
                </div>
              ))}
            </div>
            <form action={addRoomAction} className="card mt-3 space-y-3 p-4">
              <input type="hidden" name="locationId" value={params.locationId} />
              <div className="grid grid-cols-2 gap-3">
                <div><label className="label">Room name</label><input name="name" required className="input" placeholder="Queen Room 1" /></div>
                <div><label className="label">Weekly price (AUD)</label><input name="weeklyPrice" type="number" min="0" className="input" placeholder="250" /></div>
              </div>
              <div><label className="label">Photo URL</label><input name="imageUrl" className="input" placeholder="https://… (upload coming soon)" /></div>
              <div><label className="label">Description</label><input name="description" className="input" placeholder="Furnished, ensuite, all bills included" /></div>
              <SubmitButton className="btn-primary">Add room</SubmitButton>
            </form>
          </section>

          {/* Bookings */}
          <section>
            <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-500">Guests & bookings</h2>
            <div className="card divide-y divide-slate-100">
              {bookings.length === 0 ? <p className="p-4 text-sm text-slate-400">No bookings yet.</p> : bookings.map((b) => (
                <div key={b.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
                  <div>
                    <div className="flex items-center gap-2"><span className="font-medium text-slate-800">{b.guestName}</span><Badge color={bColor[b.status]}>{b.status}</Badge></div>
                    <div className="text-xs text-slate-500">{b.room?.name ?? "—"} · {money(b.weeklyPrice)}/wk · from {formatDate(b.startDate)} · {b.guestEmail}{b.contractAccepted ? " · ✓ contract" : ""}</div>
                  </div>
                  <div className="flex gap-1">
                    {(["ACTIVE", "ENDED", "CANCELLED"] as const).map((s) => (
                      <form key={s} action={setBookingStatusAction}>
                        <input type="hidden" name="locationId" value={params.locationId} /><input type="hidden" name="bookingId" value={b.id} /><input type="hidden" name="status" value={s} />
                        <button className="rounded bg-slate-50 px-2 py-0.5 text-xs text-slate-600 hover:bg-slate-100">{s[0] + s.slice(1).toLowerCase()}</button>
                      </form>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>

        {/* Settings */}
        <form action={saveHomesteadSettingsAction} className="card h-fit space-y-3 p-4">
          <input type="hidden" name="locationId" value={params.locationId} />
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Booking rules &amp; welcome pack</h2>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="label">Book up to (days ahead)</label><input name="bookingWindowDays" type="number" defaultValue={settings?.bookingWindowDays ?? 21} className="input" /></div>
            <div><label className="label">Weeks charged upfront</label><input name="depositWeeks" type="number" min="1" defaultValue={settings?.depositWeeks ?? 1} className="input" /></div>
          </div>
          <div><label className="label">House rules</label><textarea name="houseRules" rows={4} defaultValue={settings?.houseRules ?? ""} className="input" placeholder="Your house rules…" /></div>
          <div><label className="label">Arrival / welcome info</label><textarea name="welcomeInfo" rows={4} defaultValue={settings?.welcomeInfo ?? ""} className="input" placeholder="How to get in, where to park, checkout…" /></div>
          <div><label className="label">Contract text</label><textarea name="contractText" rows={4} defaultValue={settings?.contractText ?? ""} className="input" placeholder="The agreement guests accept at booking…" /></div>
          <SubmitButton className="btn-primary">Save</SubmitButton>
        </form>
      </div>
    </div>
  );
}
