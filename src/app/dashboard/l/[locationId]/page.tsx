import Link from "next/link";
import { requireLocationAccess } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { formatMoney, formatDateTime, contactName } from "@/lib/utils";
import { CommandBar } from "@/components/command-bar";

export const dynamic = "force-dynamic";

function greeting(): string {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

export default async function LocationHome({ params }: { params: { locationId: string } }) {
  const { location } = await requireLocationAccess(params.locationId);
  const id = location.id;
  const base = `/dashboard/l/${id}`;
  const weekAgo = new Date(Date.now() - 7 * 86400000);

  const [contacts, newThisWeek, openOpps, upcoming, tasks] = await Promise.all([
    prisma.contact.count({ where: { locationId: id } }),
    prisma.contact.count({ where: { locationId: id, createdAt: { gte: weekAgo } } }),
    prisma.opportunity.findMany({ where: { locationId: id, status: "OPEN" }, select: { value: true } }),
    prisma.appointment.findMany({
      where: { locationId: id, startAt: { gte: new Date() }, status: "CONFIRMED" },
      orderBy: { startAt: "asc" },
      take: 3,
      include: { contact: true },
    }),
    prisma.task.findMany({
      where: { locationId: id, completed: false },
      orderBy: [{ dueAt: "asc" }, { createdAt: "desc" }],
      take: 3,
      include: { contact: true },
    }),
  ]);

  const openValue = openOpps.reduce((s, o) => s + o.value, 0);
  const hasToday = upcoming.length + tasks.length + newThisWeek > 0;

  return (
    <div className="animate-rise">
      {/* Gradient greeting + AI command bar */}
      <section className="-mx-4 -mt-5 mb-4 bg-brand-gradient px-4 pb-6 pt-6 text-white sm:mx-0 sm:mt-0 sm:rounded-3xl sm:px-6">
        <p className="text-sm text-white/80">{greeting()}</p>
        <h1 className="mt-0.5 text-2xl font-semibold tracking-tight">{location.name}</h1>
        <div className="mt-4">
          <CommandBar base={base} />
        </div>
      </section>

      {/* Glanceable stats */}
      <div className="mb-4 grid grid-cols-3 gap-2.5">
        <Link href={`${base}/contacts`} className="stat">
          <p className="stat-num">{contacts}</p>
          <p className="mt-0.5 text-[11px] text-slate-500">Contacts</p>
        </Link>
        <Link href={`${base}/pipelines`} className="stat">
          <p className="stat-num">{formatMoney(openValue)}</p>
          <p className="mt-0.5 text-[11px] text-slate-500">Open value</p>
        </Link>
        <Link href={`${base}/calendar`} className="stat">
          <p className="stat-num">{upcoming.length}</p>
          <p className="mt-0.5 text-[11px] text-slate-500">Upcoming</p>
        </Link>
      </div>

      {/* Today */}
      <section className="card p-4">
        <div className="mb-1 flex items-center justify-between px-1">
          <h2 className="text-sm font-semibold text-slate-900">Today</h2>
          {hasToday ? <span className="text-xs text-brand-600">{upcoming.length + tasks.length} to do</span> : null}
        </div>

        {!hasToday ? (
          <p className="py-8 text-center text-sm text-slate-400">You&rsquo;re all caught up. ✨</p>
        ) : (
          <div className="divide-y divide-slate-100">
            {upcoming.map((a) => (
              <Link key={a.id} href={`${base}/calendar`} className="list-row">
                <span className="tile bg-brand-50">📅</span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium text-slate-800">{a.title}</span>
                  <span className="block text-xs text-slate-500">{a.contact ? contactName(a.contact) : "No contact"}</span>
                </span>
                <span className="shrink-0 text-xs text-slate-500">{formatDateTime(a.startAt)}</span>
              </Link>
            ))}
            {tasks.map((t) => (
              <Link key={t.id} href={`${base}/tasks`} className="list-row">
                <span className="tile bg-accent-400/15">✓</span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium text-slate-800">{t.title}</span>
                  <span className="block text-xs text-slate-500">{t.contact ? contactName(t.contact) : "Task"}</span>
                </span>
                {t.dueAt ? <span className="shrink-0 text-xs text-slate-500">{formatDateTime(t.dueAt)}</span> : null}
              </Link>
            ))}
            {newThisWeek > 0 ? (
              <Link href={`${base}/contacts`} className="list-row">
                <span className="tile bg-brand-50">👤</span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-medium text-slate-800">{newThisWeek} new lead{newThisWeek === 1 ? "" : "s"} this week</span>
                  <span className="block text-xs text-slate-500">Tap to follow up</span>
                </span>
                <span className="shrink-0 text-slate-300">›</span>
              </Link>
            ) : null}
          </div>
        )}
      </section>

      {/* Jump back in */}
      <section className="mt-4">
        <p className="mb-2 px-1 text-sm font-semibold text-slate-900">Jump back in</p>
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
          {[
            { icon: "✉", label: "Inbox", href: "conversations" },
            { icon: "◍", label: "Customers", href: "contacts" },
            { icon: "❖", label: "Website", href: "website" },
            { icon: "✦", label: "AI setup", href: "setup" },
          ].map((q) => (
            <Link key={q.href} href={`${base}/${q.href}`} className="card card-hover flex items-center gap-3 p-3.5">
              <span className="tile bg-brand-50">{q.icon}</span>
              <span className="text-sm font-medium text-slate-800">{q.label}</span>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
