import { requireDriver } from "@/lib/driver-auth";
import { prisma } from "@/lib/db";
import { formatMoney, formatDateTime } from "@/lib/utils";
import { acceptJobAction } from "../actions";

export const dynamic = "force-dynamic";
export const metadata = { title: "Available deliveries" };

export default async function JobsPage() {
  await requireDriver();

  const jobs = await prisma.deliveryJob.findMany({
    where: { status: "POSTED", scope: "SHARED", driverId: null },
    include: { location: { select: { name: true } } },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  return (
    <div>
      <h1 className="mb-1 text-2xl font-bold text-slate-900">Available deliveries</h1>
      <p className="mb-5 text-sm text-slate-500">{jobs.length} job{jobs.length === 1 ? "" : "s"} up for grabs.</p>

      {jobs.length === 0 ? (
        <div className="card p-10 text-center text-sm text-slate-500">No deliveries available right now — check back soon.</div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {jobs.map((j) => (
            <div key={j.id} className="card flex flex-col p-5">
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-slate-800">{j.location.name}</span>
                <span className="text-lg font-bold text-brand-700">{formatMoney(j.fee)}</span>
              </div>
              <div className="mt-3 space-y-1.5 text-sm">
                <div><span className="text-slate-400">Pick up:</span> {j.pickupAddress}</div>
                <div><span className="text-slate-400">Drop off:</span> {j.dropoffAddress}</div>
                {j.notes ? <div className="text-slate-500">{j.notes}</div> : null}
              </div>
              <div className="mt-3 text-xs text-slate-400">Posted {formatDateTime(j.createdAt)}</div>
              <form action={acceptJobAction} className="mt-4">
                <input type="hidden" name="jobId" value={j.id} />
                <button className="btn-primary w-full">Accept delivery</button>
              </form>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
