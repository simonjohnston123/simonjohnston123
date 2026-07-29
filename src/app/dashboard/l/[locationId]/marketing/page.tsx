import { requireLocationAccess } from "@/lib/auth";
import { PageHeader, Badge } from "@/components/ui";

export const dynamic = "force-dynamic";
export const metadata = { title: "Marketing" };

const modules = [
  { icon: "🔗", title: "Placid Connect", body: "The social side — get your business discovered, run live shows, and let customers find, book, order and buy. The demand engine that feeds your CRM.", soon: true, highlight: true },
  { icon: "📧", title: "Email & SMS campaigns", body: "Send broadcasts and drip campaigns to segments of your contacts." },
  { icon: "📅", title: "Social planner", body: "Schedule and post to Facebook, Instagram and more from one place." },
  { icon: "⭐", title: "Reviews & reputation", body: "Request, monitor and reply to Google & Facebook reviews." },
  { icon: "🎯", title: "Audiences & segments", body: "Build targeted audiences from your contacts and behaviour." },
];

export default async function MarketingPage({ params }: { params: { locationId: string } }) {
  await requireLocationAccess(params.locationId);
  return (
    <div>
      <PageHeader title="Marketing" subtitle="Reach and grow your audience" />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {modules.map((m) => (
          <div key={m.title} className={`card p-5 ${m.highlight ? "ring-2 ring-brand-400" : ""}`}>
            <div className="mb-3 flex items-center justify-between">
              <span className="grid h-11 w-11 place-items-center rounded-xl bg-brand-gradient text-lg text-white">{m.icon}</span>
              <Badge color={m.highlight ? "blue" : "slate"}>Coming soon</Badge>
            </div>
            <h3 className="font-semibold text-slate-900">{m.title}</h3>
            <p className="mt-1 text-sm text-slate-500">{m.body}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
