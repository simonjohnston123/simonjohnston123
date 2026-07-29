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
    <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      <div className="mb-8 flex items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">{user.agency.name}</h1>
          <p className="mt-1 text-sm text-slate-500">
            {locations.length} {locations.length === 1 ? "business" : "businesses"} · pick one to manage, or add a new one.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {user.globalRole === "SUPER_ADMIN" ? (
            <>
              <Link href="/admin" className="btn-secondary">⚙ Admin</Link>
              <Link href="/dashboard/team" className="btn-secondary">Team</Link>
            </>
          ) : null}
          <Link href="/dashboard/billing" className="btn-secondary">Billing</Link>
          <AddBusiness />
        </div>
      </div>

      {locations.length === 0 ? (
        <div className="card flex flex-col items-center justify-center gap-3 p-12 text-center">
          <p className="text-lg font-medium text-slate-800">No businesses yet</p>
          <p className="max-w-md text-sm text-slate-500">
            Add your first business — like Placid Storage Solutions or Placid Homestead — to get a full CRM,
            pipeline, calendar and website.
          </p>
          <AddBusiness />
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {locations.map((loc) => {
            const openValue = loc.opportunities.reduce((sum, o) => sum + o.value, 0);
            return (
              <Link
                key={loc.id}
                href={`/dashboard/l/${loc.id}`}
                className="card group p-5 transition-shadow hover:shadow-md"
              >
                <div className="flex items-center justify-between">
                  <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-brand-50 text-lg font-bold text-brand-700">
                    {loc.name.charAt(0)}
                  </div>
                </div>
                <h3 className="mt-3 font-semibold text-slate-900 group-hover:text-brand-700">{loc.name}</h3>
                <p className="text-xs text-slate-500">{loc.industry || "Business"}</p>
                <div className="mt-4 grid grid-cols-3 gap-2 text-center">
                  <Stat label="Contacts" value={loc._count.contacts} />
                  <Stat label="Deals" value={loc._count.opportunities} />
                  <Stat label="Bookings" value={loc._count.appointments} />
                </div>
                <div className="mt-4 rounded-lg bg-slate-50 px-3 py-2 text-center">
                  <div className="text-xs text-slate-500">Open pipeline value</div>
                  <div className="text-sm font-semibold text-slate-900">{formatMoney(openValue)}</div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </main>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <div className="text-lg font-semibold text-slate-900">{value}</div>
      <div className="text-[11px] uppercase tracking-wide text-slate-400">{label}</div>
    </div>
  );
}
