import Link from "next/link";
import { getDriver } from "@/lib/driver-auth";

export const dynamic = "force-dynamic";
export const metadata = { title: "Drive with Placid Deliveries" };

const steps = [
  { icon: "📝", title: "Sign up", body: "Create a free driver account in a minute." },
  { icon: "📦", title: "Accept jobs", body: "See nearby deliveries and grab the ones that suit you." },
  { icon: "💸", title: "Get paid", body: "Complete deliveries and earn on your own schedule." },
];

export default async function DeliveriesLanding() {
  const driver = await getDriver();
  return (
    <div>
      <section className="rounded-2xl bg-brand-gradient px-6 py-14 text-center text-white">
        <h1 className="mx-auto max-w-2xl text-3xl font-bold sm:text-4xl">Drive with Placid Deliveries</h1>
        <p className="mx-auto mt-3 max-w-xl text-white/90">
          Earn money delivering for local businesses — on your schedule, in your own vehicle.
        </p>
        <div className="mt-7 flex justify-center gap-3">
          {driver ? (
            <Link href="/deliveries/jobs" className="rounded-lg bg-white px-6 py-3 font-semibold text-brand-700">See available jobs</Link>
          ) : (
            <>
              <Link href="/deliveries/signup" className="rounded-lg bg-white px-6 py-3 font-semibold text-brand-700">Sign up to drive</Link>
              <Link href="/deliveries/login" className="rounded-lg border border-white/40 px-6 py-3 font-semibold">Log in</Link>
            </>
          )}
        </div>
      </section>

      <section className="mt-10 grid gap-4 sm:grid-cols-3">
        {steps.map((s) => (
          <div key={s.title} className="card p-6">
            <div className="mb-3 text-2xl">{s.icon}</div>
            <h3 className="font-semibold text-slate-900">{s.title}</h3>
            <p className="mt-1 text-sm text-slate-600">{s.body}</p>
          </div>
        ))}
      </section>
    </div>
  );
}
