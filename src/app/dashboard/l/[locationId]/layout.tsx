import Link from "next/link";
import { requireLocationAccess, getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { LocationNav } from "@/components/location-nav";
import { MobileNav } from "@/components/mobile-nav";
import { LocationSwitcher } from "@/components/location-switcher";
import { AssistantPanel } from "@/components/assistant-panel";

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
    <div className="mx-auto max-w-7xl px-4 py-5 sm:px-6 sm:py-6">
      {/* Mobile top bar — business identity only; navigation lives in the bottom bar. */}
      <div className="mb-4 flex items-center justify-between gap-2 md:hidden">
        <div className="min-w-0 flex-1">
          {locations.length > 1 ? <LocationSwitcher current={location.id} locations={locations} /> : <BusinessChip />}
        </div>
        <Link href="/dashboard" className="shrink-0 rounded-lg px-2 py-1 text-xs font-medium text-slate-400" aria-label="All businesses">⌄</Link>
      </div>

      <Link href="/dashboard" className="mb-4 hidden items-center gap-1 text-xs font-medium text-slate-400 hover:text-slate-600 md:inline-flex">
        ← All businesses
      </Link>

      <div className="flex gap-6">
        <aside className="hidden w-60 shrink-0 md:block">
          <div className="sticky top-[72px]">
            <div className="mb-3">
              {locations.length > 1 ? <LocationSwitcher current={location.id} locations={locations} /> : <BusinessChip />}
            </div>
            <LocationNav locationId={location.id} locationName={location.name} />
          </div>
        </aside>
        {/* Extra bottom padding on mobile so content clears the fixed nav. */}
        <main className="min-w-0 flex-1 pb-28 md:pb-0">{children}</main>
      </div>

      <MobileNav locationId={location.id} locationName={location.name} />
      <AssistantPanel locationId={location.id} />
    </div>
  );
}
