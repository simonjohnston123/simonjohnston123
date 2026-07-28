import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

type Pool = { available: number; capacity: number; occupied: number };

async function getStorage(): Promise<{ car: Pool | null; container: Pool | null }> {
  try {
    const res = await fetch("https://placidstoragesolutions.com.au/api/availability", {
      cache: "no-store",
    });
    if (!res.ok) return { car: null, container: null };
    const data = (await res.json()) as { pools?: { car?: Pool; container?: Pool } };
    return { car: data.pools?.car ?? null, container: data.pools?.container ?? null };
  } catch {
    return { car: null, container: null };
  }
}

const businesses = [
  {
    name: "Placid Storage Solutions",
    tag: "Flagship · Live",
    body: "Self-storage units, lockers and secure car bays at 27 Toolooa St, South Gladstone — booked, paid and gated online.",
    href: "https://placidstoragesolutions.com.au",
    glow: true,
  },
  {
    name: "Placid Homestead",
    tag: "Property",
    body: "Rural and residential property arm of the Placid group.",
    href: "#",
  },
  {
    name: "Placid Deals",
    tag: "Retail",
    body: "Online marketplace and dropship storefront across thousands of products.",
    href: "#",
  },
  {
    name: "Placid Auto Group",
    tag: "Automotive",
    body: "Vehicle sales and automotive services under the Placid banner.",
    href: "#",
  },
];

const platform = [
  { icon: "◍", title: "Contacts & CRM", body: "Every customer, lead and tenant across every business — tags, custom fields, full history." },
  { icon: "▤", title: "Pipelines", body: "Track each opportunity from first enquiry to close with visual, per-business pipelines." },
  { icon: "✉", title: "Unified inbox", body: "SMS, email and web chat land in one conversation stream so no lead ever goes cold." },
  { icon: "◷", title: "Calendars & booking", body: "Per-business scheduling and appointments that keep the yard and the calendar full." },
  { icon: "⚡", title: "Automations", body: "Trigger follow-ups, reminders and workflows the moment something happens." },
  { icon: "❖", title: "Sites & funnels", body: "Publish a marketing site or landing funnel for any business, straight from the platform." },
];

export default async function HomePage() {
  const user = await getCurrentUser();
  const { car, container } = await getStorage();

  return (
    <main className="dark-scroll relative min-h-screen overflow-hidden bg-ink-950 text-white">
      {/* Aurora + grid backdrop */}
      <div className="pointer-events-none absolute inset-0 -z-10 bg-aurora" />
      <div className="pointer-events-none absolute inset-0 -z-10 animate-drift bg-aurora opacity-60" />
      <div
        className="pointer-events-none absolute inset-0 -z-10 bg-grid opacity-[0.35]"
        style={{ backgroundSize: "56px 56px", maskImage: "radial-gradient(circle at 50% 0%, black, transparent 75%)" }}
      />

      {/* Nav */}
      <header className="sticky top-0 z-20">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-2 text-lg font-bold tracking-tight">
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-brand-gradient shadow-glow">◆</span>
            Placid<span className="text-gradient">CRM</span>
          </div>
          <nav className="flex items-center gap-2">
            {user ? (
              <Link href="/dashboard" className="btn-primary">Open dashboard</Link>
            ) : (
              <>
                <Link href="/login" className="btn-glass">Sign in</Link>
                <Link href="/register" className="btn-primary">Get started</Link>
              </>
            )}
          </nav>
        </div>
      </header>

      {/* Hero */}
      <section className="mx-auto max-w-6xl px-6 pb-20 pt-16 text-center sm:pt-24">
        <p className="animate-rise mb-6 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-4 py-1.5 text-xs font-medium text-brand-200 backdrop-blur-md">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-accent-400" />
          The operating system for the Placid group
        </p>
        <h1 className="animate-rise mx-auto max-w-4xl text-5xl font-bold leading-[1.05] tracking-tight sm:text-7xl">
          One platform.<br />
          <span className="text-gradient">Every Placid business.</span>
        </h1>
        <p className="animate-rise mx-auto mt-6 max-w-2xl text-lg text-slate-300">
          Contacts, pipelines, conversations, calendars, automations and websites — with a
          dedicated sub-account for each business. Storage, Homestead, Deals and Auto Group,
          all run from one command centre.
        </p>
        <div className="animate-rise mt-9 flex flex-wrap justify-center gap-3">
          <Link href={user ? "/dashboard" : "/register"} className="btn-primary px-7 py-3 text-base">
            {user ? "Open dashboard" : "Launch the platform"}
          </Link>
          <a href="https://placidstoragesolutions.com.au" className="btn-glass px-7 py-3 text-base">
            Book storage now ↗
          </a>
        </div>
      </section>

      {/* Live flagship strip */}
      <section className="mx-auto max-w-6xl px-6 pb-16">
        <div className="glass-card animate-float overflow-hidden p-1">
          <div className="rounded-[15px] bg-ink-900/60 p-7 sm:p-9">
            <div className="flex flex-col items-start justify-between gap-6 sm:flex-row sm:items-center">
              <div>
                <span className="badge bg-accent-500/15 text-accent-400">● Live now</span>
                <h2 className="mt-3 text-2xl font-bold">Placid Storage Solutions</h2>
                <p className="mt-1 max-w-md text-sm text-slate-300">
                  The flagship — secure units, lockers and car bays, booked and gated online. Real-time availability from the live yard:
                </p>
              </div>
              <div className="flex gap-4">
                <LiveStat label="Storage units / lockers" pool={container} />
                <LiveStat label="Car bays" pool={car} />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* The empire */}
      <section className="mx-auto max-w-6xl px-6 pb-16">
        <h3 className="mb-6 text-sm font-semibold uppercase tracking-widest text-slate-400">The Placid group</h3>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {businesses.map((b) => (
            <a
              key={b.name}
              href={b.href}
              className={`glass-card group flex flex-col p-6 ${b.glow ? "shadow-glow" : ""}`}
            >
              <span className={`badge w-fit ${b.glow ? "bg-brand-500/20 text-brand-200" : "bg-white/10 text-slate-300"}`}>
                {b.tag}
              </span>
              <h4 className="mt-3 text-lg font-semibold">{b.name}</h4>
              <p className="mt-2 flex-1 text-sm text-slate-400">{b.body}</p>
              <span className="mt-4 text-sm font-medium text-brand-300 opacity-0 transition group-hover:opacity-100">
                Open ↗
              </span>
            </a>
          ))}
        </div>
      </section>

      {/* Platform capabilities */}
      <section className="mx-auto max-w-6xl px-6 pb-24">
        <div className="mb-8 text-center">
          <h3 className="text-3xl font-bold sm:text-4xl">Everything runs in one place</h3>
          <p className="mx-auto mt-3 max-w-xl text-slate-400">
            The CRM core — built to grow into the full command centre for the whole group.
          </p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {platform.map((f) => (
            <div key={f.title} className="glass-card p-6">
              <div className="mb-4 grid h-11 w-11 place-items-center rounded-xl bg-brand-gradient text-lg shadow-glow">
                {f.icon}
              </div>
              <h4 className="text-lg font-semibold">{f.title}</h4>
              <p className="mt-2 text-sm text-slate-400">{f.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="mx-auto max-w-4xl px-6 pb-24">
        <div className="glass-card relative overflow-hidden p-10 text-center sm:p-14">
          <div className="pointer-events-none absolute inset-0 -z-10 bg-brand-gradient opacity-20 blur-2xl" />
          <h3 className="text-3xl font-bold sm:text-4xl">Run the whole group from one login.</h3>
          <p className="mx-auto mt-3 max-w-lg text-slate-300">
            Create your account and bring every Placid business into a single command centre.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Link href={user ? "/dashboard" : "/register"} className="btn-primary px-7 py-3 text-base">
              {user ? "Open dashboard" : "Create your account"}
            </Link>
            <Link href="/login" className="btn-glass px-7 py-3 text-base">Sign in</Link>
          </div>
        </div>
      </section>

      <footer className="border-t border-white/10 py-8 text-center text-sm text-slate-500">
        © {new Date().getFullYear()} PlacidCRM · Placid Group Australia Pty Ltd · placidcrm.com
      </footer>
    </main>
  );
}

function LiveStat({ label, pool }: { label: string; pool: Pool | null }) {
  return (
    <div className="min-w-[130px] rounded-xl border border-white/10 bg-white/5 p-4 text-center">
      <div className="text-3xl font-bold">
        {pool ? <span className="text-gradient">{pool.available}</span> : <span className="text-slate-500">—</span>}
      </div>
      <div className="mt-1 text-[11px] font-medium uppercase tracking-wide text-slate-400">{label}</div>
      <div className="text-[11px] text-slate-500">{pool ? "available now" : "checking…"}</div>
    </div>
  );
}
