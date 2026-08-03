import { requireLocationAccess } from "@/lib/auth";
import { PageHeader } from "@/components/ui";
import { SourcingBrowser } from "@/components/sourcing-browser";
import { dzReady } from "@/lib/dropshipzone";

export const dynamic = "force-dynamic";
export const metadata = { title: "Product Sourcing" };

export default async function SourcingPage({ params }: { params: { locationId: string } }) {
  await requireLocationAccess(params.locationId);
  return (
    <div>
      <PageHeader title="Product Sourcing" subtitle="Browse the Placid supplier range and import products straight into your catalogue" />
      <SourcingBrowser locationId={params.locationId} ready={dzReady()} />
    </div>
  );
}
