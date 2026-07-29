import { requireLocationAccess } from "@/lib/auth";
import { BuilderShell } from "@/components/builder/builder-shell";

export const dynamic = "force-dynamic";

export default async function BuildPage({ params }: { params: { locationId: string } }) {
  const { location } = await requireLocationAccess(params.locationId);
  return <BuilderShell locationId={location.id} locationName={location.name} slug={location.slug} />;
}
