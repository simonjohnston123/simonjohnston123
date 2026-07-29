import { requireLocationAccess } from "@/lib/auth";
import { PageHeader } from "@/components/ui";

export const dynamic = "force-dynamic";

const STORAGE = process.env.STORAGE_URL || "https://placidstoragesolutions.com.au";

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
    /* offline */
  }

  const Stat = ({ label, pool }: { label: string; pool: Pool | null }) => (
    <div className="card p-4">
      <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</div>
      {pool ? (
        <>
          <div className="mt-1 text-2xl font-bold text-slate-900">{pool.occupied}/{pool.capacity}</div>
          <div className="text-sm font-medium text-brand-600">{pool.available} available</div>
        </>
      ) : (
        <div className="mt-1 text-sm text-slate-400">—</div>
      )}
    </div>
  );

  return (
    <div>
      <PageHeader
        title="Storage yard"
        subtitle="Placid Storage Solutions — 27 Toolooa Street, South Gladstone"
        action={
          <a className="btn-secondary text-sm" href={`${STORAGE}/admin`} target="_blank" rel="noopener noreferrer">
            Open full-screen ↗
          </a>
        }
      />

      <div className="mb-4 grid gap-3 sm:grid-cols-2">
        <Stat label="Car bays" pool={car} />
        <Stat label="Units / lockers" pool={container} />
      </div>

      {/* The full yard admin — bookings, occupancy grid, PINs, waitlist, service requests — embedded here. */}
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <iframe
          src={`${STORAGE}/admin`}
          title="Placid Storage yard admin"
          className="h-[78vh] w-full"
        />
      </div>
      <p className="mt-2 text-xs text-slate-400">
        The full yard admin runs live above. If it asks you to log in and won&rsquo;t hold the session (some browsers block
        embedded logins), use <span className="font-medium">Open full-screen ↗</span>.
      </p>
    </div>
  );
}
