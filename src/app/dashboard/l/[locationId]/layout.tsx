import Link from "next/link";
import { requireLocationAccess, getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { LocationNav } from "@/components/location-nav";
import { LocationSwitcher } from "@/components/location-switcher";

export const dynamic = "force-dynamic";

export default async function LocationLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: { locationId: string };
}) {
  const { location } = await requireLocationAccess(params.locationId);
  const user = await getCurrentUser();

  const where =
    user?.globalRole === "SUPER_ADMIN"
      ? { agencyId: location.agencyId }
      : { memberships: { some: { userId: user?.id } } };
  const locations = await prisma.location.findMany({
    where,
    select: { id: true, name: true },
    orderBy: { createdAt: "asc" },
  });

  const BusinessChip = () => (
    <div className="flex items-center gap-2.5 rounded-xl border border-slate-200/80 bg-white px-3 py-2.5 shadow-sm">
      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-brand-gradient text-sm font-bold text-white">
        {location.name.charAt(0).toUpperCase()}
      </span>
      <span className="truncate text-sm font-semibold text-slate-800">{location.name}</span>
    </div>
  );

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
      <Link href="/dashboard" className="mb-4 inline-flex items-center gap-1 text-xs font-medium text-slate-400 hover:text-slate-600">
        ← All businesses
      </Link>

      {/* Mobile nav — the sidebar is hidden on phones, so give a scrollable tab bar. */}
      <div className="mb-4 md:hidden">
        <div className="mb-2">
          {locations.length > 1 ? <LocationSwitcher current={location.id} locations={locations} /> : <BusinessChip />}
        </div>
        <LocationNav locationId={location.id} locationName={location.name} orientation="horizontal" />
      </div>

      <div className="flex gap-6">
        <aside className="hidden w-60 shrink-0 md:block">
          <div className="sticky top-[72px]">
            <div className="mb-3">
              {locations.length > 1 ? <LocationSwitcher current={location.id} locations={locations} /> : <BusinessChip />}
            </div>
            <LocationNav locationId={location.id} locationName={location.name} />
          </div>
        </aside>
        <main className="min-w-0 flex-1">{children}</main>
      </div>
    </div>
  );
}
