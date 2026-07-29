import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { AddBusiness } from "@/components/add-business";
import { formatMoney } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function AgencyDashboard() {
  const user = await requireUser();

  // SUPER_ADMIN sees every business in the agency; others see only theirs.
  const where =
    user.globalRole === "SUPER_ADMIN"
      ? { agencyId: user.agencyId }
      : { agencyId: user.agencyId, memberships: { some: { userId: user.id } } };

  const locations = await prisma.location.findMany({
    where,
    orderBy: { createdAt: "asc" },
    include: {
      _count: { select: { contacts: true, opportunities: true, appointments: true } },
      opportunities: { where: { status: "OPEN" }, select: { value: true } },
    },
  });

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-30 border-b border-slate-200/70 bg-white/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-3 sm:px-6">
          <Link href="/dashboard" className="flex items-center gap-2 text-[15px] font-bold tracking-tight">
            <span className="grid h-7 w-7 place-items-center rounded-lg bg-brand-gradient text-white shadow-[0_4px_12px_-4px_rgba(142,45,226,0.6)]">◆</span>
            <span className="text-slate-900">Placid<span className="bg-gradient-to-r from-brand-600 to-accent-500 bg-clip-text text-transparent">CRM</span></span>
          </Link>
          <div className="ml-auto flex items-center gap-1.5">
            {user.globalRole === "SUPER_ADMIN" ? (
              <>
                <Link href="/admin" className="btn-ghost text-sm">⚙ Admin</Link>
                <Link href="/dashboard/team" className="btn-ghost text-sm">Team</Link>
              </>
            ) : null}
            <Link href="/dashboard/billing" className="btn-ghost text-sm">Billing</Link>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
        <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">{user.agency.name}</h1>
            <p className="mt-1 text-sm text-slate-500">
              {locations.length} {locations.length === 1 ? "business" : "businesses"} · pick one to manage, or add a new one.
            </p>
          </div>
          <AddBusiness />
        </div>

        {locations.length === 0 ? (
          <div className="card flex flex-col items-center justify-center gap-3 p-14 text-center">
            <div className="grid h-14 w-14 place-items-center rounded-2xl bg-brand-gradient text-2xl text-white shadow-[0_8px_24px_-8px_rgba(142,45,226,0.6)]">◆</div>
            <p className="text-lg font-semibold text-slate-800">No businesses yet</p>
            <p className="max-w-md text-sm text-slate-500">
              Add your first business to get a full CRM — contacts, pipelines, calendar, automations and a website.
            </p>
            <AddBusiness />
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {locations.map((loc) => {
              const openValue = loc.opportunities.reduce((sum, o) => sum + o.value, 0);
              return (
                <Link key={loc.id} href={`/dashboard/l/${loc.id}`} className="card card-hover group flex flex-col p-5">
                  <div className="flex items-center gap-3">
                    <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-brand-gradient text-lg font-bold text-white shadow-[0_4px_12px_-4px_rgba(142,45,226,0.55)]">
                      {loc.name.charAt(0).toUpperCase()}
                    </span>
                    <div className="min-w-0">
                      <h3 className="truncate font-semibold text-slate-900 group-hover:text-brand-700">{loc.name}</h3>
                      <p className="truncate text-xs text-slate-500">{loc.industry || "Business"}</p>
                    </div>
                    <span className="ml-auto text-slate-300 transition group-hover:translate-x-0.5 group-hover:text-brand-500">→</span>
                  </div>
                  <div className="mt-4 grid grid-cols-3 gap-2 text-center">
                    <Stat label="Contacts" value={loc._count.contacts} />
                    <Stat label="Deals" value={loc._count.opportunities} />
                    <Stat label="Bookings" value={loc._count.appointments} />
                  </div>
                  <div className="mt-4 flex items-center justify-between rounded-xl bg-slate-50 px-3.5 py-2.5">
                    <span className="text-xs text-slate-500">Open pipeline</span>
                    <span className="text-sm font-bold text-slate-900">{formatMoney(openValue)}</span>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg bg-slate-50/70 py-2">
      <div className="text-lg font-bold text-slate-900">{value}</div>
      <div className="text-[10px] font-medium uppercase tracking-wide text-slate-400">{label}</div>
    </div>
  );
}
