import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

const features = [
  { title: "Multi-business sub-accounts", body: "Run every Placid business — Storage Solutions, Homestead and whatever comes next — from one place, each with its own data." },
  { title: "CRM & pipelines", body: "Contacts, tags, custom fields and drag-free Kanban pipelines to track every opportunity to close." },
  { title: "Unified conversations", body: "One inbox per sub-account for SMS, email and web chat so no lead ever goes cold." },
  { title: "Calendars & booking", body: "Per-business calendars and appointments to keep the schedule full." },
  { title: "Tenant websites", body: "Publish a marketing website for each business straight from the platform." },
  { title: "Add a business in minutes", body: "Spin up a new sub-account whenever you launch something new — no new software." },
];

export default async function HomePage() {
  const user = await getCurrentUser();
  return (
    <main className="min-h-screen bg-slate-900 text-white">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-6">
        <div className="text-xl font-bold tracking-tight">
          Placid<span className="text-brand-400">CRM</span>
        </div>
        <nav className="flex items-center gap-3">
          {user ? (
            <Link href="/dashboard" className="btn-primary">Open dashboard</Link>
          ) : (
            <>
              <Link href="/login" className="btn-ghost text-white hover:bg-white/10">Sign in</Link>
              <Link href="/register" className="btn-primary">Get started</Link>
            </>
          )}
        </nav>
      </header>

      <section className="mx-auto max-w-6xl px-6 pb-16 pt-10 text-center">
        <p className="mb-4 inline-block rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs font-medium text-brand-200">
          The operating system for the Placid group
        </p>
        <h1 className="mx-auto max-w-3xl text-4xl font-bold leading-tight sm:text-5xl">
          One CRM platform. Every Placid business.
        </h1>
        <p className="mx-auto mt-5 max-w-2xl text-lg text-slate-300">
          PlacidCRM brings contacts, pipelines, conversations, calendars and websites together —
          with a separate sub-account for each business, or shared when you want it that way.
        </p>
        <div className="mt-8 flex justify-center gap-3">
          <Link href={user ? "/dashboard" : "/register"} className="btn-primary px-6 py-3 text-base">
            {user ? "Open dashboard" : "Create your account"}
          </Link>
          <Link href="/login" className="btn-secondary px-6 py-3 text-base">Sign in</Link>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 pb-24">
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((f) => (
            <div key={f.title} className="rounded-xl border border-white/10 bg-white/5 p-6">
              <h3 className="text-lg font-semibold">{f.title}</h3>
              <p className="mt-2 text-sm text-slate-300">{f.body}</p>
            </div>
          ))}
        </div>
      </section>

      <footer className="border-t border-white/10 py-8 text-center text-sm text-slate-400">
        © {new Date().getFullYear()} PlacidCRM · placidcrm.com
      </footer>
    </main>
  );
}
