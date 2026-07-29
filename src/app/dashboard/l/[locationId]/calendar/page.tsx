import Link from "next/link";
import { requireLocationAccess } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { PageHeader, EmptyState, Badge } from "@/components/ui";
import { NewAppointmentButton } from "@/components/new-appointment";
import { CalendarSettings, NewCalendarForm } from "@/components/calendar-settings";
import { setAppointmentStatusAction, deleteAppointmentAction } from "./actions";
import { contactName, formatDateTime } from "@/lib/utils";

export const dynamic = "force-dynamic";

const statusColor: Record<string, "green" | "red" | "amber" | "slate"> = {
  CONFIRMED: "green",
  CANCELLED: "red",
  COMPLETED: "slate",
  NO_SHOW: "amber",
};

export default async function CalendarPage({ params }: { params: { locationId: string } }) {
  await requireLocationAccess(params.locationId);

  const [calendars, contacts, appointments] = await Promise.all([
    prisma.calendar.findMany({ where: { locationId: params.locationId }, orderBy: { createdAt: "asc" } }),
    prisma.contact.findMany({ where: { locationId: params.locationId }, orderBy: { createdAt: "desc" }, take: 200 }),
    prisma.appointment.findMany({
      where: { locationId: params.locationId },
      include: { contact: true, calendar: true },
      orderBy: { startAt: "asc" },
      take: 200,
    }),
  ]);

  const contactOptions = contacts.map((c) => ({ id: c.id, label: contactName(c) }));
  const now = new Date();
  const upcoming = appointments.filter((a) => a.startAt >= now);
  const past = appointments.filter((a) => a.startAt < now).reverse();
  const base = `/dashboard/l/${params.locationId}`;

  return (
    <div>
      <PageHeader
        title="Calendar"
        subtitle={`${upcoming.length} upcoming`}
        action={
          <NewAppointmentButton
            locationId={params.locationId}
            calendars={calendars.map((c) => ({ id: c.id, name: c.name, durationMinutes: c.durationMinutes }))}
            contacts={contactOptions}
          />
        }
      />

      {appointments.length === 0 ? (
        <EmptyState
          title="No appointments yet"
          body="Book your first appointment for this business."
          action={
            <NewAppointmentButton
              locationId={params.locationId}
              calendars={calendars.map((c) => ({ id: c.id, name: c.name, durationMinutes: c.durationMinutes }))}
              contacts={contactOptions}
            />
          }
        />
      ) : (
        <div className="space-y-8">
          <Section title="Upcoming" items={upcoming} base={base} locationId={params.locationId} empty="Nothing upcoming." />
          <Section title="Past" items={past} base={base} locationId={params.locationId} empty="No past appointments." />
        </div>
      )}

      <section className="mt-10">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Services & booking options</h2>
          <NewCalendarForm locationId={params.locationId} />
        </div>
        <p className="mb-3 text-xs text-slate-500">
          Each calendar is a bookable <span className="font-medium">service</span> — give it a price, description and availability. Add a <span className="font-medium">Calendar</span> widget to your website and pick the service; customers only see open times.
        </p>
        <div className="space-y-4">
          {calendars.map((c) => (
            <CalendarSettings
              key={c.id}
              locationId={params.locationId}
              calendar={{ id: c.id, name: c.name, description: c.description, price: c.price, active: c.active, durationMinutes: c.durationMinutes, bookingWindowDays: c.bookingWindowDays, availability: c.availability }}
            />
          ))}
        </div>
      </section>
    </div>
  );
}

function Section({
  title,
  items,
  base,
  locationId,
  empty,
}: {
  title: string;
  items: any[];
  base: string;
  locationId: string;
  empty: string;
}) {
  return (
    <section>
      <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-500">{title}</h2>
      {items.length === 0 ? (
        <p className="rounded-lg border border-dashed border-slate-200 p-6 text-center text-sm text-slate-400">{empty}</p>
      ) : (
        <div className="card divide-y divide-slate-100">
          {items.map((a) => (
            <div key={a.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-medium text-slate-800">{a.title}</span>
                  <Badge color={statusColor[a.status]}>{a.status}</Badge>
                </div>
                <div className="text-xs text-slate-500">
                  {formatDateTime(a.startAt)} · {a.calendar.name}
                  {a.contact ? (
                    <>
                      {" · "}
                      <Link href={`${base}/contacts/${a.contact.id}`} className="text-brand-600 hover:underline">
                        {contactName(a.contact)}
                      </Link>
                    </>
                  ) : null}
                </div>
              </div>
              <div className="flex items-center gap-1">
                <StatusForm locationId={locationId} appointmentId={a.id} status="COMPLETED" label="Complete" />
                <StatusForm locationId={locationId} appointmentId={a.id} status="NO_SHOW" label="No-show" />
                <StatusForm locationId={locationId} appointmentId={a.id} status="CANCELLED" label="Cancel" />
                <form action={deleteAppointmentAction}>
                  <input type="hidden" name="locationId" value={locationId} />
                  <input type="hidden" name="appointmentId" value={a.id} />
                  <button className="rounded px-2 py-0.5 text-xs text-slate-400 hover:text-red-600">Delete</button>
                </form>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function StatusForm({
  locationId,
  appointmentId,
  status,
  label,
}: {
  locationId: string;
  appointmentId: string;
  status: string;
  label: string;
}) {
  return (
    <form action={setAppointmentStatusAction}>
      <input type="hidden" name="locationId" value={locationId} />
      <input type="hidden" name="appointmentId" value={appointmentId} />
      <input type="hidden" name="status" value={status} />
      <button className="rounded bg-slate-50 px-2 py-0.5 text-xs font-medium text-slate-600 hover:bg-slate-100">{label}</button>
    </form>
  );
}
