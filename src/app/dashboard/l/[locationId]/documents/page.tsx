import { requireLocationAccess } from "@/lib/auth";
import { PageHeader, EmptyState } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function DocumentsPage({ params }: { params: { locationId: string } }) {
  await requireLocationAccess(params.locationId);

  return (
    <div>
      <PageHeader title="Documents" subtitle="Guest guides, lease agreements, contracts & templates" />
      <EmptyState
        title="Coming soon"
        body="Templates like the guest guide and lease agreement, plus each guest's signed copies, will live here."
      />
    </div>
  );
}
