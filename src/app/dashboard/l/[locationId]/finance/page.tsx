import { requireLocationAccess } from "@/lib/auth";
import { PageHeader, EmptyState } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function FinancePage({ params }: { params: { locationId: string } }) {
  await requireLocationAccess(params.locationId);

  return (
    <div>
      <PageHeader title="Finance" subtitle="Payments (bond in/out, rent received) & reporting per room" />
      <EmptyState
        title="Coming soon"
        body="Bond and rent tracking, plus income/costs/profit reporting per room and for the whole property, will live here."
      />
    </div>
  );
}
