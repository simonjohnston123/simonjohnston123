import Link from "next/link";
import { requireLocationAccess } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { PageHeader } from "@/components/ui";
import { formatMoney, formatDateTime, contactName } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function LocationHome({ params }: { params: { locationId: string } }) {
  const { location } = await requireLocationAccess(params.locationId);
  const id = location.id;

  const [contacts, openOpps, wonOpps, upcoming, recentContacts] = await Promise.all([
    prisma.contact.count({ where: { locationId: id } }),
    prisma.opportunity.findMany({ where: { locationId: id, status: "OPEN" }, select: { value: true } }),
    prisma.opportunity.findMany({ where: { locationId: id, status: "WON" }, select: { value: true } }),
    prisma.appointment.findMany({
      where: { locationId: id, startAt: { gte: new Date() }, status: "CONFIRMED" },
      orderBy: { startAt: "asc" },
      take: 5,
      include: { contact: true },
    }),
    prisma.contact.findMany({ where: { locationId: id }, orderBy: { createdAt: "desc" }, take: 5 }),
  ]);

  const openValue = openOpps.reduce((s, o) => s + o.value, 0);
  const wonValue = wonOpps.reduce((s, o) => s + o.value, 0);
  const base = `/dashboard/l/${id}`;

  return (
    <div>
      <PageHeader title={location.name} subtitle={location.industry || "Business overview"} />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <MetricCard label="Contacts" value={String(contacts)} href={`${base}/contacts`} />
        <MetricCard label="Open deals" value={String(openOpps.length)} href={`${base}/pipelines`} />
        <MetricCard label="Open value" value={formatMoney(openValue)} href={`${base}/pipelines`} />
        <MetricCard label="Won value" value={formatMoney(wonValue)} href={`${base}/pipelines`} />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <section className="card p-5">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-semibold text-slate-900">Upcoming appointments</h2>
            <Link href={`${base}/calendar`} className="text-sm text-brand-600 hover:underline">View all</Link>
          </div>
          {upcoming.length === 0 ? (
            <p className="py-6 text-center text-sm text-slate-400">Nothing booked yet.</p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {upcoming.map((a) => (
                <li key={a.id} className="flex items-center justify-between py-2.5">
                  <div>
                    <div className="text-sm font-medium text-slate-800">{a.title}</div>
                    <div className="text-xs text-slate-500">{a.contact ? contactName(a.contact) : "No contact"}</div>
                  </div>
                  <div className="text-xs text-slate-500">{formatDateTime(a.startAt)}</div>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="card p-5">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-semibold text-slate-900">Newest contacts</h2>
            <Link href={`${base}/contacts`} className="text-sm text-brand-600 hover:underline">View all</Link>
          </div>
          {recentContacts.length === 0 ? (
            <p className="py-6 text-center text-sm text-slate-400">No contacts yet.</p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {recentContacts.map((c) => (
                <li key={c.id} className="py-2.5">
                  <Link href={`${base}/contacts/${c.id}`} className="flex items-center justify-between hover:text-brand-700">
                    <span className="text-sm font-medium text-slate-800">{contactName(c)}</span>
                    <span className="text-xs text-slate-500">{c.email || c.phone || ""}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}

function MetricCard({ label, value, href }: { label: string; value: string; href: string }) {
  return (
    <Link href={href} className="card p-4 transition-shadow hover:shadow-md">
      <div className="text-xs uppercase tracking-wide text-slate-400">{label}</div>
      <div className="mt-1 text-2xl font-bold text-slate-900">{value}</div>
    </Link>
  );
}
