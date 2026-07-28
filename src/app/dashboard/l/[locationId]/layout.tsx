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
    <div className="mx-auto flex max-w-7xl gap-6 px-4 py-6 sm:px-6">
      <aside className="hidden w-60 shrink-0 md:block">
        <Link href="/dashboard" className="mb-3 inline-block text-xs font-medium text-slate-400 hover:text-slate-600">
          ← All businesses
        </Link>
        {locations.length > 1 ? (
          <LocationSwitcher current={location.id} locations={locations} />
        ) : (
          <div className="mb-4 truncate rounded-lg bg-white px-3 py-2 text-sm font-semibold text-slate-800 shadow-sm">
            {location.name}
          </div>
        )}
        <LocationNav locationId={location.id} />
      </aside>
      <main className="min-w-0 flex-1">{children}</main>
    </div>
  );
}
