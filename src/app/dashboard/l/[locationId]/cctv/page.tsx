import { requireLocationAccess } from "@/lib/auth";
import { PageHeader, Badge } from "@/components/ui";

export const dynamic = "force-dynamic";
export const metadata = { title: "CCTV" };

const modules = [
  { icon: "📹", title: "Live camera wall", body: "View all yard & facility cameras in one grid, in real time." },
  { icon: "🗺", title: "Camera-to-bay mapping", body: "Link each camera to the bays it covers, so a booking opens the right feed." },
  { icon: "⏺", title: "Recordings & playback", body: "Scrub back through footage by camera, date and time." },
  { icon: "🔔", title: "Motion & access alerts", body: "Get notified on motion, gate access or after-hours activity." },
  { icon: "🔗", title: "Connect your system", body: "Bring in RTSP / ONVIF cameras or an existing NVR/cloud CCTV provider." },
  { icon: "👥", title: "Share access", body: "Give staff or a customer a time-limited view of their own bay's camera." },
];

export default async function CctvPage({ params }: { params: { locationId: string } }) {
  await requireLocationAccess(params.locationId);
  return (
    <div>
      <PageHeader title="CCTV" subtitle="Security cameras for the yard & facility" />

      <div className="mb-5 rounded-xl border border-slate-200 bg-slate-50 p-5">
        <p className="text-sm text-slate-600">
          Connect your site&rsquo;s cameras to monitor bays, gates and common areas from inside the CRM — and
          tie feeds to bookings so you can see who&rsquo;s accessing which unit.
        </p>
        <p className="mt-2 text-xs text-slate-400">
          To wire this up we&rsquo;ll need your CCTV details — provider (e.g. Hikvision, Reolink, UniFi Protect,
          or a cloud NVR), and either RTSP/ONVIF stream URLs or API access.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {modules.map((m) => (
          <div key={m.title} className="card p-5">
            <div className="mb-3 flex items-center justify-between">
              <span className="grid h-11 w-11 place-items-center rounded-xl bg-brand-gradient text-lg text-white">{m.icon}</span>
              <Badge color="slate">Coming soon</Badge>
            </div>
            <h3 className="font-semibold text-slate-900">{m.title}</h3>
            <p className="mt-1 text-sm text-slate-500">{m.body}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
