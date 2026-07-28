import { requireLocationAccess } from "@/lib/auth";
import { PageHeader } from "@/components/ui";

export const dynamic = "force-dynamic";

const STORAGE = "https://placidstoragesolutions.com.au";

type Pool = { available: number; capacity: number; occupied: number };

export default async function StoragePage({ params }: { params: { locationId: string } }) {
  await requireLocationAccess(params.locationId);

  let car: Pool | null = null;
  let container: Pool | null = null;
  try {
    const res = await fetch(`${STORAGE}/api/availability`, { cache: "no-store" });
    if (res.ok) {
      const data = (await res.json()) as { pools?: { car?: Pool; container?: Pool } };
      car = data.pools?.car ?? null;
      container = data.pools?.container ?? null;
    }
  } catch {
    /* storage site unreachable — show links only */
  }

  const Stat = ({ label, pool }: { label: string; pool: Pool | null }) => (
    <div className="card p-5">
      <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</div>
      {pool ? (
        <>
          <div className="mt-1 text-3xl font-bold text-slate-900">
            {pool.occupied}/{pool.capacity}
          </div>
          <div className="text-sm text-brand-600 font-medium">{pool.available} available now</div>
        </>
      ) : (
        <div className="mt-1 text-sm text-slate-400">Live data unavailable</div>
      )}
    </div>
  );

  return (
    <div>
      <PageHeader
        title="Storage"
        subtitle="Placid Storage Solutions — the live yard at 27 Toolooa Street, South Gladstone"
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-2">
        <Stat label="Car bays" pool={car} />
        <Stat label="Storage units / lockers" pool={container} />
      </div>

      <div className="card p-6">
        <h3 className="text-base font-semibold text-slate-900">Manage the yard</h3>
        <p className="mt-1 text-sm text-slate-600">
          Bookings, payments, gate PINs, occupancy grid, waitlist, service requests, terms &amp;
          signatures — everything for the storage business runs in the full admin.
        </p>
        <div className="mt-4 flex flex-wrap gap-3">
          <a className="btn-primary" href={`${STORAGE}/admin`} target="_blank" rel="noopener noreferrer">
            Open Storage Admin ↗
          </a>
          <a className="btn-secondary" href={`${STORAGE}/admin/bookings`} target="_blank" rel="noopener noreferrer">
            Bookings &amp; customers ↗
          </a>
          <a className="btn-ghost" href={STORAGE} target="_blank" rel="noopener noreferrer">
            View public site ↗
          </a>
        </div>
      </div>
    </div>
  );
}
