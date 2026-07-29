import { requireLocationAccess } from "@/lib/auth";
import { PageHeader, Badge } from "@/components/ui";
import { LocationSettingsForm } from "@/components/location-settings-form";
import { emailConfigured, smsConfigured } from "@/lib/comms";

export const dynamic = "force-dynamic";

export default async function SettingsPage({ params }: { params: { locationId: string } }) {
  const { location } = await requireLocationAccess(params.locationId);
  const email = emailConfigured();
  const sms = smsConfigured();
  const inboundAddress = `${location.slug}@${process.env.INBOUND_DOMAIN || "inbox.placid.group"}`;
  const inboundLive = Boolean(process.env.RESEND_WEBHOOK_SECRET);

  return (
    <div>
      <PageHeader title="Settings" subtitle="Business details for this sub-account" />
      <div className="max-w-3xl space-y-6">
        <LocationSettingsForm location={location} />

        <section className="card p-5">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Sending — automations & messages</h2>
          <p className="mt-1 text-xs text-slate-400">
            Powers the Send email / Send SMS actions in Automations. Until a channel is connected, those actions are
            recorded in Conversations but not actually delivered.
          </p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <div className="rounded-xl border border-slate-200 p-4">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-slate-800">Email (Resend)</span>
                {email ? <Badge color="green">Connected</Badge> : <Badge color="amber">Not connected</Badge>}
              </div>
              <p className="mt-2 text-xs text-slate-500">
                {email
                  ? "Emails from automations are delivered live."
                  : "Add RESEND_API_KEY and EMAIL_FROM to the server to switch on real delivery."}
              </p>
            </div>
            <div className="rounded-xl border border-slate-200 p-4">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-slate-800">SMS (Twilio)</span>
                {sms ? <Badge color="green">Connected</Badge> : <Badge color="amber">Not connected</Badge>}
              </div>
              <p className="mt-2 text-xs text-slate-500">
                {sms
                  ? "Text messages from automations are delivered live."
                  : "Add TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN and TWILIO_FROM to switch on real delivery."}
              </p>
            </div>
          </div>

          <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50/60 p-4">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-slate-800">Inbox address</span>
              {inboundLive ? <Badge color="green">Receiving</Badge> : <Badge color="amber">Not receiving yet</Badge>}
            </div>
            <p className="mt-2 text-xs text-slate-500">
              Emails sent to{" "}
              <code className="rounded bg-white px-1.5 py-0.5 font-mono text-slate-700">{inboundAddress}</code>{" "}
              land in this business&rsquo;s Conversations. {inboundLive
                ? "Give this address to customers, or set it as the reply-to on your forms."
                : "Activates once the inbound MX + webhook are connected (final email step)."}
            </p>
          </div>
        </section>

        <p className="text-xs text-slate-400">
          Sub-account ID: <code className="font-mono">{location.id}</code> · public slug:{" "}
          <code className="font-mono">{location.slug}</code>
        </p>
      </div>
    </div>
  );
}
