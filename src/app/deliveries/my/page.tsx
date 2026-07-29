import { requireDriver } from "@/lib/driver-auth";
import { prisma } from "@/lib/db";
import { formatMoney } from "@/lib/utils";
import { updateJobStatusAction } from "../actions";

export const dynamic = "force-dynamic";
export const metadata = { title: "My deliveries" };

const STATUS_LABEL: Record<string, string> = {
  ACCEPTED: "Accepted",
  PICKED_UP: "Picked up",
  DELIVERED: "Delivered",
};

export default async function MyDeliveriesPage() {
  const driver = await requireDriver();

  const jobs = await prisma.deliveryJob.findMany({
    where: { driverId: driver.id, status: { in: ["ACCEPTED", "PICKED_UP", "DELIVERED"] } },
    include: { location: { select: { name: true } } },
    orderBy: { acceptedAt: "desc" },
    take: 100,
  });

  const active = jobs.filter((j) => j.status !== "DELIVERED");
  const done = jobs.filter((j) => j.status === "DELIVERED");

  const Card = ({ j }: { j: (typeof jobs)[number] }) => (
    <div className="card p-5">
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold text-slate-800">{j.location.name}</span>
        <span className="text-lg font-bold text-brand-700">{formatMoney(j.fee)}</span>
      </div>
      <div className="mt-3 space-y-1.5 text-sm">
        <div><span className="text-slate-400">Pick up:</span> {j.pickupAddress}</div>
        <div><span className="text-slate-400">Drop off:</span> {j.dropoffAddress}</div>
        {j.customerName || j.customerPhone ? (
          <div><span className="text-slate-400">Customer:</span> {j.customerName} {j.customerPhone}</div>
        ) : null}
      </div>
      <div className="mt-3 flex items-center gap-2">
        <span className="badge bg-brand-100 text-brand-700">{STATUS_LABEL[j.status]}</span>
        {j.status === "ACCEPTED" ? (
          <>
            <StatusBtn jobId={j.id} status="PICKED_UP" label="Mark picked up" primary />
            <StatusBtn jobId={j.id} status="CANCELLED" label="Release" />
          </>
        ) : j.status === "PICKED_UP" ? (
          <StatusBtn jobId={j.id} status="DELIVERED" label="Mark delivered" primary />
        ) : null}
      </div>
    </div>
  );

  return (
    <div>
      <h1 className="mb-5 text-2xl font-bold text-slate-900">My deliveries</h1>
      {jobs.length === 0 ? (
        <div className="card p-10 text-center text-sm text-slate-500">You haven&rsquo;t accepted any deliveries yet.</div>
      ) : (
        <div className="space-y-6">
          <section>
            <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-500">Active</h2>
            {active.length ? <div className="grid gap-4 sm:grid-cols-2">{active.map((j) => <Card key={j.id} j={j} />)}</div> : <p className="text-sm text-slate-400">Nothing active.</p>}
          </section>
          {done.length ? (
            <section>
              <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-500">Completed</h2>
              <div className="grid gap-4 sm:grid-cols-2">{done.map((j) => <Card key={j.id} j={j} />)}</div>
            </section>
          ) : null}
        </div>
      )}
    </div>
  );
}

function StatusBtn({ jobId, status, label, primary }: { jobId: string; status: string; label: string; primary?: boolean }) {
  return (
    <form action={updateJobStatusAction}>
      <input type="hidden" name="jobId" value={jobId} />
      <input type="hidden" name="status" value={status} />
      <button className={primary ? "btn-primary text-sm" : "btn-secondary text-sm"}>{label}</button>
    </form>
  );
}
