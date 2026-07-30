import Link from "next/link";
import { requireLocationAccess } from "@/lib/auth";
import { PageHeader } from "@/components/ui";
import { SetupWizard } from "@/components/setup-wizard";

export const dynamic = "force-dynamic";

export default async function SetupPage({ params }: { params: { locationId: string } }) {
  const { location } = await requireLocationAccess(params.locationId);

  return (
    <div>
      <PageHeader
        title="AI setup"
        subtitle={`Answer a few questions and we'll build ${location.name}'s services, booking questions and forms.`}
        action={<Link href={`/dashboard/l/${params.locationId}/website`} className="btn-ghost text-sm">← Website</Link>}
      />
      <SetupWizard locationId={params.locationId} />
    </div>
  );
}
