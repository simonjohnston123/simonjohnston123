import { prisma } from "@/lib/db";
import { requireLocationAccess } from "@/lib/auth";
import { PageHeader, Badge } from "@/components/ui";
import { saveVoiceAgentAction } from "./actions";
import type { Turn } from "@/lib/voice";

export const dynamic = "force-dynamic";
export const metadata = { title: "AI Receptionist" };

const VOICES = [
  { id: "Polly.Olivia-Neural", label: "Olivia — Australian, female (recommended)" },
  { id: "Polly.Russell", label: "Russell — Australian, male" },
  { id: "Polly.Aria-Neural", label: "Aria — NZ, female" },
];

export default async function ReceptionistPage({ params }: { params: { locationId: string } }) {
  const locationId = params.locationId;
  await requireLocationAccess(locationId);

  const [agent, calls, location] = await Promise.all([
    prisma.voiceAgent.findUnique({ where: { locationId } }),
    prisma.callLog.findMany({ where: { locationId }, orderBy: { createdAt: "desc" }, take: 20 }),
    prisma.location.findUnique({ where: { id: locationId }, select: { name: true } }),
  ]);
  const base = process.env.APP_URL || "https://placidcrm.com";
  const twilioReady = !!process.env.TWILIO_ACCOUNT_SID;

  return (
    <div>
      <PageHeader title="AI Receptionist" subtitle="An AI that answers this business's phone 24/7 — every call lands in your inbox" />

      {!twilioReady ? (
        <div className="card mb-4 border-l-4 border-amber-400 p-4 text-sm text-slate-600">
          <strong className="text-slate-900">Phone platform not connected yet.</strong> The platform owner needs to add the master telephony credentials before numbers go live. You can configure everything below now — it activates the moment the platform is connected.
        </div>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Config */}
        <form action={saveVoiceAgentAction} className="card space-y-3 p-5">
          <input type="hidden" name="locationId" value={locationId} />
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-slate-900">Receptionist settings</h3>
            <label className="flex items-center gap-2 text-sm text-slate-600"><input type="checkbox" name="enabled" defaultChecked={agent?.enabled ?? true} /> Enabled</label>
          </div>

          <label className="block text-sm">
            <span className="mb-1 block font-medium text-slate-700">Receptionist phone number</span>
            <input name="phoneNumber" defaultValue={agent?.phoneNumber ?? ""} placeholder="+61…" className="w-full rounded-lg border border-slate-200 px-3 py-2 outline-none focus:border-brand-400" />
            <span className="mt-1 block text-xs text-slate-400">The number callers dial. Provisioned by the platform — leave as given.</span>
          </label>

          <label className="block text-sm">
            <span className="mb-1 block font-medium text-slate-700">Greeting</span>
            <textarea name="greeting" rows={2} defaultValue={agent?.greeting ?? ""} placeholder={`Thanks for calling ${location?.name ?? "us"}! How can I help you today?`} className="w-full resize-y rounded-lg border border-slate-200 px-3 py-2 outline-none focus:border-brand-400" />
          </label>

          <div className="grid grid-cols-2 gap-3">
            <label className="block text-sm">
              <span className="mb-1 block font-medium text-slate-700">Opening hours</span>
              <input name="hours" defaultValue={agent?.hours ?? ""} placeholder="Mon–Fri 9–5, Sat 9–12" className="w-full rounded-lg border border-slate-200 px-3 py-2 outline-none focus:border-brand-400" />
            </label>
            <label className="block text-sm">
              <span className="mb-1 block font-medium text-slate-700">Transfer calls to</span>
              <input name="transferTo" defaultValue={agent?.transferTo ?? ""} placeholder="Your mobile, e.g. 04…" className="w-full rounded-lg border border-slate-200 px-3 py-2 outline-none focus:border-brand-400" />
            </label>
          </div>

          <label className="block text-sm">
            <span className="mb-1 block font-medium text-slate-700">What the receptionist should know</span>
            <textarea name="knowledge" rows={5} defaultValue={agent?.knowledge ?? ""} placeholder={"Pricing, common questions, directions, policies…\nIt already knows your products and bookable services."} className="w-full resize-y rounded-lg border border-slate-200 px-3 py-2 outline-none focus:border-brand-400" />
          </label>

          <label className="block text-sm">
            <span className="mb-1 block font-medium text-slate-700">Voice</span>
            <select name="voice" defaultValue={agent?.voice ?? "Polly.Olivia-Neural"} className="w-full rounded-lg border border-slate-200 px-3 py-2 outline-none focus:border-brand-400">
              {VOICES.map((v) => <option key={v.id} value={v.id}>{v.label}</option>)}
            </select>
          </label>

          <button className="rounded-xl bg-brand-gradient px-5 py-2.5 text-sm font-bold text-white">Save settings</button>
        </form>

        {/* Call log */}
        <div className="card p-5">
          <h3 className="mb-3 font-semibold text-slate-900">Recent calls</h3>
          {calls.length === 0 ? <p className="py-10 text-center text-sm text-slate-400">No calls yet — they'll appear here and in your Inbox.</p> : (
            <div className="space-y-2">
              {calls.map((c) => {
                const t = (c.transcript as Turn[]) ?? [];
                return (
                  <details key={c.id} className="rounded-xl border border-slate-100 p-3">
                    <summary className="flex cursor-pointer items-center justify-between text-sm">
                      <span className="font-medium text-slate-800">📞 {c.fromNumber}</span>
                      <span className="flex items-center gap-2 text-xs text-slate-400">
                        {c.durationSec ? `${Math.floor(c.durationSec / 60)}m${c.durationSec % 60}s` : ""}
                        <Badge color={c.status === "filed" ? "green" : c.status === "transferred" ? "blue" : "slate"}>{c.status}</Badge>
                        {new Date(c.createdAt).toLocaleString()}
                      </span>
                    </summary>
                    {c.summary ? <p className="mt-2 rounded-lg bg-amber-50 px-2 py-1 text-xs text-amber-800">📝 {c.summary}</p> : null}
                    <div className="mt-2 space-y-1 text-xs text-slate-600">
                      {t.map((x, i) => <p key={i}><strong>{x.role === "caller" ? "Caller" : "AI"}:</strong> {x.text}</p>)}
                    </div>
                  </details>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Platform wiring reference (visible to whoever configures the number) */}
      <div className="card mt-4 p-4 text-xs text-slate-500">
        <strong className="text-slate-700">Number wiring (platform):</strong> Voice webhook → <code className="rounded bg-slate-100 px-1">{base}/api/voice/inbound</code> (POST) · Status callback → <code className="rounded bg-slate-100 px-1">{base}/api/voice/status</code>
      </div>
    </div>
  );
}
