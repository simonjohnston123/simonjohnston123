import { requireLocationAccess } from "@/lib/auth";
import { PageHeader, EmptyState } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function TeamsPage({ params }: { params: { locationId: string } }) {
  await requireLocationAccess(params.locationId);

  return (
    <div>
      <PageHeader title="Teams" subtitle="Who can log in, and what they're allowed to see and do" />
      <EmptyState
        title="Coming soon"
        body="Role-based accounts (Owner/manager, Front of house, Cleaning & maintenance) with per-section visibility will live here."
      />
    </div>
  );
}
