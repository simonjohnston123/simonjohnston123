import Link from "next/link";
import { requireLocationAccess } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { PageHeader, Badge } from "@/components/ui";
import { SubmitButton } from "@/components/submit-button";
import { HomesteadTimeline } from "@/components/homestead-timeline";
import { HomesteadNewBooking } from "@/components/homestead-new-booking";
import { addClientAction, addRoomAction, deleteRoomAction, saveHomesteadSettingsAction, setBookingStatusAction } from "./actions";
import { formatDate } from "@/lib/utils";
import { statusLabel, nightsBetween } from "@/lib/homestead";

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

  const inResidence = bookings.filter((b) => b.status === "ACTIVE" && b.stayType === "WEEKLY").length;
  const guestsInHouse = bookings.filter((b) => b.status === "ACTIVE" && b.stayType === "NIGHTLY").length;
  const arriving = bookings.filter((b) => b.status === "PENDING").length;

  return (
    <div>
      <PageHeader title="Rooms & availability" subtitle="Residents let by the week, guests let by the night — on one set of beds"
        action={<Link href={`/homestead/${location.slug}`} target="_blank" className="btn-secondary text-sm">View booking page ↗</Link>} />

      {/* At-a-glance */}
      <div className="mb-6 grid gap-3 sm:grid-cols-4">
        {[
          { label: "Rooms", value: rooms.length },
          { label: "In residence", value: inResidence },
          { label: "Guests in house", value: guestsInHouse },
          { label: "Upcoming", value: arriving },
        ].map((s) => (
          <div key={s.label} className="card p-4">
            <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">{s.label}</div>
            <div className="mt-1 text-2xl font-bold tabular-nums text-slate-900">{s.value}</div>
          </div>
        ))}
      </div>

      {/* Availability — the whole point of mixed inventory */}
      <section className="mb-6">
        <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-500">Availability — next 30 days</h2>
        <HomesteadTimeline rooms={rooms} bookings={bookings} />
      </section>

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
                    <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-sm">
                      {r.allowsWeekly ? <span className="font-semibold text-brand-700">{money(r.weeklyPrice)}/week</span> : null}
                      {r.allowsNightly ? <span className="font-semibold text-accent-600">{money(r.nightlyPrice)}/night</span> : null}
                      {!r.allowsWeekly && !r.allowsNightly ? <span className="text-slate-400">No letting mode set</span> : null}
                    </div>
                    {r.allowsNightly && r.minNights > 1 ? <div className="text-[11px] text-slate-400">{r.minNights}-night minimum</div> : null}
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
              <div><label className="label">Room name</label><input name="name" required className="input" placeholder="Queen Room 1" /></div>

              <fieldset className="rounded-xl border border-slate-200 p-3">
                <legend className="px-1 text-xs font-semibold uppercase tracking-wide text-slate-400">How is it let?</legend>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
                      <input type="checkbox" name="allowsWeekly" defaultChecked /> Weekly (resident)
                    </label>
                    <input name="weeklyPrice" type="number" min="0" className="input mt-1.5" placeholder="250" aria-label="Weekly price AUD" />
                    <p className="mt-1 text-[11px] text-slate-400">AUD per week</p>
                  </div>
                  <div>
                    <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
                      <input type="checkbox" name="allowsNightly" /> Nightly (guest)
                    </label>
                    <input name="nightlyPrice" type="number" min="0" className="input mt-1.5" placeholder="95" aria-label="Nightly price AUD" />
                    <div className="mt-1.5 flex items-center gap-2">
                      <label className="text-[11px] text-slate-400">Min nights</label>
                      <input name="minNights" type="number" min="1" defaultValue={1} className="input w-16 py-1 text-sm" />
                    </div>
                  </div>
                </div>
              </fieldset>

              <div><label className="label">Photo URL</label><input name="imageUrl" className="input" placeholder="https://… (upload coming soon)" /></div>
              <div><label className="label">Description</label><input name="description" className="input" placeholder="Furnished, ensuite, all bills included" /></div>
              <SubmitButton className="btn-primary">Add room</SubmitButton>
            </form>
          </section>

          {/* New booking — goes through the same availability gate as the public form */}
          <section>
            <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-500">New booking</h2>
            <HomesteadNewBooking locationId={params.locationId} rooms={rooms} />
          </section>

          {/* Add a client */}
          <section>
            <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-500">Add a client</h2>
            <form action={addClientAction} className="card grid gap-3 p-4 sm:grid-cols-2">
              <input type="hidden" name="locationId" value={params.locationId} />
              <div><label className="label">First name</label><input name="firstName" className="input" placeholder="Jane" /></div>
              <div><label className="label">Last name</label><input name="lastName" className="input" placeholder="Doe" /></div>
              <div><label className="label">Email</label><input name="email" type="email" className="input" placeholder="jane@example.com" /></div>
              <div><label className="label">Phone</label><input name="phone" className="input" placeholder="04xx xxx xxx" /></div>
              <div className="sm:col-span-2"><SubmitButton className="btn-primary">Add client</SubmitButton></div>
            </form>
          </section>

          {/* Bookings */}
          <section>
            <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-500">Residents &amp; guests</h2>
            <div className="card divide-y divide-slate-100">
              {bookings.length === 0 ? <p className="p-4 text-sm text-slate-400">No bookings yet.</p> : bookings.map((b) => {
                const nightly = b.stayType === "NIGHTLY";
                const nights = nightly && b.endDate ? nightsBetween(b.startDate, b.endDate) : 0;
                return (
                  <div key={b.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-medium text-slate-800">{b.guestName}</span>
                        <Badge color={nightly ? "blue" : "slate"}>{nightly ? "Guest" : "Resident"}</Badge>
                        <Badge color={bColor[b.status]}>{statusLabel(b.status, b.stayType)}</Badge>
                      </div>
                      <div className="text-xs text-slate-500">
                        {b.room?.name ?? "—"}
                        {" · "}
                        {nightly
                          ? <>{money(b.nightlyPrice)}/night · {nights} night{nights === 1 ? "" : "s"} · {formatDate(b.startDate)}{b.endDate ? ` → ${formatDate(b.endDate)}` : ""}</>
                          : <>{money(b.weeklyPrice)}/wk · from {formatDate(b.startDate)}{b.endDate ? ` → ${formatDate(b.endDate)}` : " · open-ended"}</>}
                        {b.contractAccepted ? " · ✓ contract" : ""}
                      </div>
                    </div>
                    <div className="flex gap-1">
                      {(["ACTIVE", "ENDED", "CANCELLED"] as const).map((s) => (
                        <form key={s} action={setBookingStatusAction}>
                          <input type="hidden" name="locationId" value={params.locationId} /><input type="hidden" name="bookingId" value={b.id} /><input type="hidden" name="status" value={s} />
                          <button className="rounded bg-slate-50 px-2 py-0.5 text-xs text-slate-600 hover:bg-slate-100">{statusLabel(s, b.stayType)}</button>
                        </form>
                      ))}
                    </div>
                  </div>
                );
              })}
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
