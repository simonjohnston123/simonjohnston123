import { Badge } from "@/components/ui";

export const dynamic = "force-static";

function Row({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-10">
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-slate-400">{title}</h2>
      {children}
    </section>
  );
}

export default function DesignSystemPage() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <h1 className="text-3xl font-bold tracking-tight text-slate-900">Placid Connect · Design system</h1>
      <p className="mt-1 text-slate-500">The reusable kit every screen is built from. Brand-locked, mobile-first.</p>

      <div className="mt-10">
        <Row title="Brand colours">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {[
              ["Brand 600", "#8e2de2"],
              ["Brand 500", "#a833e0"],
              ["Magenta", "#c81fd6"],
              ["Accent", "#12dcd0"],
            ].map(([name, hex]) => (
              <div key={hex} className="overflow-hidden rounded-2xl border border-slate-200">
                <div className="h-16" style={{ background: hex }} />
                <div className="px-3 py-2">
                  <p className="text-xs font-medium text-slate-800">{name}</p>
                  <p className="font-mono text-[11px] text-slate-400">{hex}</p>
                </div>
              </div>
            ))}
          </div>
          <div className="mt-2 grid grid-cols-2 gap-2">
            <div className="h-14 rounded-2xl bg-brand-gradient" />
            <div className="h-14 rounded-2xl" style={{ backgroundImage: "linear-gradient(120deg,#c81fd6,#8e2de2 55%,#12dcd0 130%)" }} />
          </div>
        </Row>

        <Row title="Typography">
          <div className="card space-y-2 p-5">
            <p className="text-3xl font-bold tracking-tight text-slate-900">Display · 30/700</p>
            <p className="text-2xl font-semibold text-slate-900">Heading · 24/600</p>
            <p className="text-base text-slate-700">Body · 16/400 — effortless to read on a phone.</p>
            <p className="text-sm text-slate-500">Small · 14/400 — secondary detail.</p>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Label · 11/600</p>
          </div>
        </Row>

        <Row title="Buttons">
          <div className="flex flex-wrap items-center gap-3">
            <button className="btn-primary">Primary action</button>
            <button className="btn-secondary">Secondary</button>
            <button className="btn-ghost">Ghost</button>
          </div>
          <p className="mt-2 text-xs text-slate-400">44px min height · one primary per screen · gradient reserved for the primary.</p>
        </Row>

        <Row title="Fields">
          <div className="card max-w-sm space-y-3 p-5">
            <div>
              <label className="label">Name</label>
              <input className="input" placeholder="e.g. Jane Smith" />
            </div>
            <div>
              <label className="label">Service</label>
              <select className="input"><option>Car roadworthy</option></select>
            </div>
          </div>
        </Row>

        <Row title="Cards & list rows">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="card card-hover p-5">
              <p className="font-semibold text-slate-900">Card</p>
              <p className="mt-1 text-sm text-slate-500">16px radius · soft shadow · brand-tinted hover.</p>
            </div>
            <div className="card p-2">
              {["📅 Booking · 9:00 am", "✓ Follow up call", "👤 New lead"].map((t) => (
                <div key={t} className="list-row">
                  <span className="tile bg-brand-50">{t.split(" ")[0]}</span>
                  <span className="flex-1 text-sm font-medium text-slate-800">{t.slice(2)}</span>
                  <span className="text-slate-300">›</span>
                </div>
              ))}
            </div>
          </div>
        </Row>

        <Row title="Stats & segmented control">
          <div className="grid grid-cols-3 gap-2.5">
            {[["148", "Contacts"], ["$2,140", "This week"], ["6", "Bookings"]].map(([v, l]) => (
              <div key={l} className="stat">
                <p className="stat-num">{v}</p>
                <p className="mt-0.5 text-[11px] text-slate-500">{l}</p>
              </div>
            ))}
          </div>
          <div className="mt-3 seg">
            <span className="seg-item seg-item-active">Contacts</span>
            <span className="seg-item">Deals</span>
            <span className="seg-item">Tasks</span>
          </div>
        </Row>

        <Row title="Badges">
          <div className="flex flex-wrap gap-2">
            <Badge color="green">Connected</Badge>
            <Badge color="amber">Draft</Badge>
            <Badge color="blue">New</Badge>
            <Badge color="slate">Hidden</Badge>
          </div>
        </Row>

        <Row title="Motion & rules">
          <div className="card p-5 text-sm text-slate-600">
            <ul className="list-inside list-disc space-y-1">
              <li>Radius: controls 12px, cards 16px, sheets 24px.</li>
              <li>Shadows: <span className="font-mono text-xs">soft</span> for rest, brand glow for emphasis only.</li>
              <li>Touch targets ≥ 44px; safe-area insets on fixed bars.</li>
              <li>Sheets slide up (spring); pages rise-fade in.</li>
              <li>Every screen: one clear primary action, no horizontal scroll.</li>
            </ul>
          </div>
        </Row>
      </div>
    </main>
  );
}
