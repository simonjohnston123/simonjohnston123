import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { formatDate } from "@/lib/utils";
import { setAgencyStatusAction, setAgencyPlanAction } from "../../actions";
import { AdminAddBusiness } from "@/components/admin-add-business";

export const dynamic = "force-dynamic";

export default async function AdminAgencyDetail({ params }: { params: { agencyId: string } }) {
  const agency = await prisma.agency.findUnique({
    where: { id: params.agencyId },
    include: {
      users: { orderBy: { createdAt: "asc" } },
      locations: {
        orderBy: { createdAt: "asc" },
        include: { _count: { select: { contacts: true, orders: true, appointments: true } } },
      },
    },
  });
  if (!agency) notFound();

  const suspended = agency.status === "SUSPENDED";

  return (
    <div>
      <Link href="/admin/businesses" className="mb-3 inline-block text-xs font-medium text-slate-400 hover:text-slate-600">← All businesses</Link>

      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold text-slate-900">{agency.name}</h1>
          <span className={`badge ${suspended ? "bg-red-100 text-red-700" : "bg-green-100 text-green-700"}`}>{agency.status.toLowerCase()}</span>
        </div>
        <div className="flex items-center gap-2">
          <form action={setAgencyPlanAction} className="flex items-center gap-1">
            <input type="hidden" name="agencyId" value={agency.id} />
            <select name="plan" defaultValue={agency.plan} className="input h-9 py-1 text-sm">
              <option value="free">free</option>
              <option value="starter">starter</option>
              <option value="pro">pro</option>
              <option value="agency">agency</option>
            </select>
            <button className="btn-secondary text-sm">Set plan</button>
          </form>
          <form action={setAgencyStatusAction}>
            <input type="hidden" name="agencyId" value={agency.id} />
            <input type="hidden" name="status" value={suspended ? "ACTIVE" : "SUSPENDED"} />
            <button className={suspended ? "btn-primary text-sm" : "btn-secondary text-sm text-red-600"}>
              {suspended ? "Reactivate" : "Suspend"}
            </button>
          </form>
        </div>
      </div>
      <p className="mb-6 text-sm text-slate-500">Plan: <span className="font-medium text-slate-700">{agency.plan}</span> · Joined {formatDate(agency.createdAt)}</p>

      <div className="grid gap-6 lg:grid-cols-2">
        <section>
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Sub-accounts ({agency.locations.length})</h2>
            <AdminAddBusiness agencyId={agency.id} />
          </div>
          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
            {agency.locations.length === 0 ? (
              <p className="p-4 text-sm text-slate-400">No sub-accounts.</p>
            ) : (
              agency.locations.map((l) => (
                <div key={l.id} className="flex items-center justify-between border-b border-slate-100 px-4 py-3 last:border-0">
                  <div>
                    <div className="text-sm font-medium text-slate-800">{l.name}</div>
                    <div className="text-xs text-slate-500">{l._count.contacts} contacts · {l._count.orders} orders · {l._count.appointments} appts</div>
                  </div>
                  <Link href={`/dashboard/l/${l.id}`} className="text-xs text-brand-600 hover:underline">Open →</Link>
                </div>
              ))
            )}
          </div>
        </section>

        <section>
          <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-500">Users ({agency.users.length})</h2>
          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
            {agency.users.map((u) => (
              <div key={u.id} className="flex items-center justify-between border-b border-slate-100 px-4 py-3 last:border-0">
                <div>
                  <div className="text-sm font-medium text-slate-800">{u.name}</div>
                  <div className="text-xs text-slate-500">{u.email}</div>
                </div>
                <span className="badge bg-slate-100 text-slate-600">{u.globalRole === "SUPER_ADMIN" ? "owner" : "user"}</span>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
