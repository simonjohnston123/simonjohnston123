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

  return (
    <div className="min-h-screen">
      {/* App top bar */}
      <header className="sticky top-0 z-30 border-b border-slate-200/70 bg-white/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl items-center gap-3 px-4 py-3 sm:px-6">
          <Link href="/dashboard" className="flex items-center gap-2 text-[15px] font-bold tracking-tight">
            <span className="grid h-7 w-7 place-items-center rounded-lg bg-brand-gradient text-white shadow-[0_4px_12px_-4px_rgba(142,45,226,0.6)]">◆</span>
            <span className="text-slate-900">Placid<span className="bg-gradient-to-r from-brand-600 to-accent-500 bg-clip-text text-transparent">CRM</span></span>
          </Link>
          <span className="hidden text-slate-300 sm:inline">/</span>
          <span className="hidden truncate text-sm font-medium text-slate-600 sm:inline">{location.name}</span>
          <div className="ml-auto flex items-center gap-1.5">
            <Link href="/dashboard/billing" className="btn-ghost text-sm">Billing</Link>
            <Link href="/dashboard" className="btn-secondary text-sm">All businesses</Link>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
        {/* Mobile nav — the sidebar is hidden on phones, so give a scrollable tab bar. */}
        <div className="mb-4 md:hidden">
          {locations.length > 1 ? (
            <div className="mb-2"><LocationSwitcher current={location.id} locations={locations} /></div>
          ) : null}
          <LocationNav locationId={location.id} locationName={location.name} orientation="horizontal" />
        </div>

        <div className="flex gap-6">
          <aside className="hidden w-60 shrink-0 md:block">
            <div className="sticky top-[76px]">
              {locations.length > 1 ? (
                <div className="mb-3"><LocationSwitcher current={location.id} locations={locations} /></div>
              ) : (
                <div className="mb-3 flex items-center gap-2.5 rounded-xl border border-slate-200/80 bg-white px-3 py-2.5 shadow-sm">
                  <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-brand-gradient text-sm font-bold text-white">
                    {location.name.charAt(0).toUpperCase()}
                  </span>
                  <span className="truncate text-sm font-semibold text-slate-800">{location.name}</span>
                </div>
              )}
              <LocationNav locationId={location.id} locationName={location.name} />
            </div>
          </aside>
          <main className="min-w-0 flex-1">{children}</main>
        </div>
      </div>
    </div>
  );
}
