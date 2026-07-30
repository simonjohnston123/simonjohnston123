import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { Logo } from "@/components/logo";

export const dynamic = "force-dynamic";

type Pool = { available: number; capacity: number; occupied: number };

async function getStorageProof(): Promise<number | null> {
  try {
    const res = await fetch("https://placidstoragesolutions.com.au/api/availability", { cache: "no-store" });
    if (!res.ok) return null;
    const data = (await res.json()) as { pools?: { car?: Pool; container?: Pool } };
    const a = data.pools?.car?.available ?? 0;
    const b = data.pools?.container?.available ?? 0;
    return a + b;
  } catch {
    return null;
  }
}

// The SaaS side — what a business gets.
const business = [
  { icon: "◍", title: "CRM & contacts", body: "Every lead and customer in one place — tags, custom fields, full history." },
  { icon: "▤", title: "Pipelines", body: "Track every deal from first enquiry to close with visual pipelines." },
  { icon: "✉", title: "Unified inbox", body: "SMS, email and web chat in one stream so no message is missed." },
  { icon: "◷", title: "Calendars & booking", body: "Let customers book your services online, around your availability." },
  { icon: "⚡", title: "Automations", body: "Triggers → actions: welcome new leads, chase quotes, send reminders — hands-free." },
  { icon: "❖", title: "Sites & storefront", body: "Publish a marketing site, booking funnel or product store — no separate tools." },
];

// The consumer side — Placid Connect, the demand engine.
const connect = [
  { icon: "🔎", title: "Get discovered", body: "Customers find your business and services in the Placid Connect app." },
  { icon: "📅", title: "Book services", body: "One tap to book — the appointment lands straight in your calendar." },
  { icon: "🚚", title: "Order & deliver", body: "Take delivery orders from nearby customers without building an app." },
  { icon: "🛍", title: "Buy products", body: "Sell your products in the marketplace and to your own audience." },
  { icon: "🔴", title: "Live sales shows", body: "Go live, showcase products and sell in real time to a ready audience." },
];

export default async function HomePage() {
  const user = await getCurrentUser();
  const proof = await getStorageProof();

  return (
    <main className="dark-scroll relative min-h-screen overflow-hidden bg-ink-950 text-white">
      <div className="pointer-events-none absolute inset-0 -z-10 bg-aurora" />
      <div className="pointer-events-none absolute inset-0 -z-10 animate-drift bg-aurora opacity-60" />
      <div
        className="pointer-events-none absolute inset-0 -z-10 bg-grid opacity-[0.35]"
        style={{ backgroundSize: "56px 56px", maskImage: "radial-gradient(circle at 50% 0%, black, transparent 75%)" }}
      />

      {/* Nav */}
      <header className="sticky top-0 z-20">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <Logo dark markClass="h-8 w-8" textClass="text-lg" />
          <nav className="flex items-center gap-2">
            {user ? (
              <Link href="/dashboard" className="btn-primary">Open dashboard</Link>
            ) : (
              <>
                <Link href="/login" className="btn-glass">Sign in</Link>
                <Link href="/register" className="btn-primary">Start free</Link>
              </>
            )}
          </nav>
        </div>
      </header>

      {/* Hero */}
      <section className="mx-auto max-w-6xl px-6 pb-16 pt-16 text-center sm:pt-24">
        <p className="animate-rise mb-6 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-4 py-1.5 text-xs font-medium text-brand-200 backdrop-blur-md">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-accent-400" />
          The all-in-one platform for growing businesses
        </p>
        <h1 className="animate-rise mx-auto max-w-4xl text-5xl font-bold leading-[1.05] tracking-tight sm:text-7xl">
          Run your whole business.<br />
          <span className="text-gradient">Get found by new customers.</span>
        </h1>
        <p className="animate-rise mx-auto mt-6 max-w-2xl text-lg text-slate-300">
          Placid Connect gives any business one place to manage customers, bookings, payments, automations and an online
          storefront — while <span className="font-semibold text-white">Placid Connect</span> puts you in front of
          people ready to book, order and buy.
        </p>
        <div className="animate-rise mt-9 flex flex-wrap justify-center gap-3">
          <Link href={user ? "/dashboard" : "/register"} className="btn-primary px-7 py-3 text-base">
            {user ? "Open dashboard" : "Start free"}
          </Link>
          <Link href="/login" className="btn-glass px-7 py-3 text-base">See how it works</Link>
        </div>
        {proof !== null ? (
          <p className="mt-6 text-xs text-slate-500">
            Real businesses already run on Placid — live right now, {proof} storage spaces bookable at Placid Storage Solutions.
          </p>
        ) : null}
      </section>

      {/* Two-sided platform */}
      <section className="mx-auto max-w-6xl px-6 pb-8">
        <div className="grid gap-4 md:grid-cols-2">
          <div className="glass-card p-6">
            <span className="badge bg-brand-500/20 text-brand-200">For your business</span>
            <h3 className="mt-3 text-xl font-bold">Placid Connect — your command centre</h3>
            <p className="mt-1 text-sm text-slate-400">Everything to run and grow, without stitching ten tools together.</p>
          </div>
          <div className="glass-card p-6 shadow-glow-accent">
            <span className="badge bg-accent-500/15 text-accent-400">For your customers</span>
            <h3 className="mt-3 text-xl font-bold">Placid Connect — the demand engine</h3>
            <p className="mt-1 text-sm text-slate-400">A social marketplace that sends ready-to-buy customers your way.</p>
          </div>
        </div>
      </section>

      {/* Business capabilities */}
      <section className="mx-auto max-w-6xl px-6 pb-12">
        <h4 className="mb-5 text-sm font-semibold uppercase tracking-widest text-slate-400">Run your business</h4>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {business.map((f) => (
            <div key={f.title} className="glass-card p-6">
              <div className="mb-4 grid h-11 w-11 place-items-center rounded-xl bg-brand-gradient text-lg shadow-glow">{f.icon}</div>
              <h5 className="text-lg font-semibold">{f.title}</h5>
              <p className="mt-2 text-sm text-slate-400">{f.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Placid Connect */}
      <section className="mx-auto max-w-6xl px-6 pb-16">
        <h4 className="mb-5 text-sm font-semibold uppercase tracking-widest text-accent-400">Grow with Placid Connect</h4>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {connect.map((f) => (
            <div key={f.title} className="glass-card p-5">
              <div className="mb-3 text-2xl">{f.icon}</div>
              <h5 className="text-base font-semibold">{f.title}</h5>
              <p className="mt-1.5 text-sm text-slate-400">{f.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="mx-auto max-w-4xl px-6 pb-24">
        <div className="glass-card relative overflow-hidden p-10 text-center sm:p-14">
          <div className="pointer-events-none absolute inset-0 -z-10 bg-brand-accent opacity-20 blur-2xl" />
          <h3 className="text-3xl font-bold sm:text-4xl">One platform to run it and grow it.</h3>
          <p className="mx-auto mt-3 max-w-lg text-slate-300">
            Bring your customers, bookings, payments and storefront together — and get discovered on Placid Connect.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Link href={user ? "/dashboard" : "/register"} className="btn-primary px-7 py-3 text-base">
              {user ? "Open dashboard" : "Start free"}
            </Link>
            <Link href="/login" className="btn-glass px-7 py-3 text-base">Sign in</Link>
          </div>
        </div>
      </section>

      <footer className="border-t border-white/10 py-8 text-center text-sm text-slate-500">
        © {new Date().getFullYear()} Placid Connect · Placid Group Australia Pty Ltd · placidcrm.com
      </footer>
    </main>
  );
}
