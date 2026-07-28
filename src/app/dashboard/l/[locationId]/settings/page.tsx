import { requireLocationAccess } from "@/lib/auth";
import { PageHeader } from "@/components/ui";
import { LocationSettingsForm } from "@/components/location-settings-form";

export const dynamic = "force-dynamic";

export default async function SettingsPage({ params }: { params: { locationId: string } }) {
  const { location } = await requireLocationAccess(params.locationId);

  return (
    <div>
      <PageHeader title="Settings" subtitle="Business details for this sub-account" />
      <div className="max-w-3xl">
        <LocationSettingsForm location={location} />
        <p className="mt-3 text-xs text-slate-400">
          Sub-account ID: <code className="font-mono">{location.id}</code> · public slug:{" "}
          <code className="font-mono">{location.slug}</code>
        </p>
      </div>
    </div>
  );
}
