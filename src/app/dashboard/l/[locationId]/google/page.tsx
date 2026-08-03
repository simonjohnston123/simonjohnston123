import { requireLocationAccess } from "@/lib/auth";
import { PageHeader } from "@/components/ui";
import { GoogleConnect } from "@/components/google-connect";
import { GOOGLE_SERVICES, googleReady, googleStatus } from "@/lib/google";

export const dynamic = "force-dynamic";
export const metadata = { title: "Google" };

const NOTE: Record<string, string> = {
  connected: "✓ Google connected.",
  denied: "Connection cancelled.",
  failed: "Google didn't return a refresh token — try again and make sure you approve access.",
};

export default async function GooglePage({
  params, searchParams,
}: {
  params: { locationId: string }; searchParams: { g?: string };
}) {
  await requireLocationAccess(params.locationId);
  const status = await googleStatus(params.locationId);
  const note = searchParams.g ? NOTE[searchParams.g] : null;

  const services = GOOGLE_SERVICES.map((s) => ({
    key: s.key, label: s.label, icon: s.icon, blurb: s.blurb, tier: s.tier,
    granted: status.connected && status.services.includes(s.key),
  }));

  return (
    <div>
      <PageHeader title="Google" subtitle="Connect Gmail, Calendar, Business Profile, Merchant Centre, Sheets, Drive and YouTube" />
      {note ? (
        <div className={`mb-4 rounded-lg px-4 py-3 text-sm ${searchParams.g === "connected" ? "bg-emerald-50 text-emerald-800" : "bg-amber-50 text-amber-800"}`}>{note}</div>
      ) : null}
      <GoogleConnect
        locationId={params.locationId}
        connected={status.connected}
        email={status.email}
        status={status.status}
        services={services}
        ready={googleReady()}
      />
    </div>
  );
}
