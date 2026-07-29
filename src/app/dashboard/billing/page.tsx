import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { PLANS, planByKey, FEATURE_LABEL } from "@/lib/plans";
import { stripeConfigured } from "@/lib/stripe";
import { startCheckoutAction, startPortalAction } from "./actions";

export const dynamic = "force-dynamic";
export const metadata = { title: "Billing & plan" };

export default async function BillingPage({ searchParams }: { searchParams: { checkout?: string } }) {
  const user = await requireUser();
  const current = planByKey(user.agency?.plan);
  const configured = stripeConfigured();
  const isOwner = user.globalRole === "SUPER_ADMIN";
  const notice = searchParams.checkout;

  return (
    <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <Link href="/dashboard" className="text-xs font-medium text-slate-400 hover:text-slate-600">← Dashboard</Link>
          <h1 className="mt-1 text-2xl font-bold text-slate-900">Billing &amp; plan</h1>
        </div>
        {user.agency?.stripeCustomerId ? (
          <form action={startPortalAction}>
            <button className="btn-secondary">Manage billing ↗</button>
          </form>
        ) : null}
      </div>

      {notice === "success" ? <Banner ok>You&rsquo;re subscribed — thanks! Your plan is now active.</Banner> : null}
      {notice === "cancel" ? <Banner>Checkout cancelled — no charge was made.</Banner> : null}
      {notice === "downgraded" ? <Banner ok>You&rsquo;re on the Free plan.</Banner> : null}
      {notice === "unconfigured" ? <Banner>Billing isn&rsquo;t connected yet.</Banner> : null}

      {!configured ? (
        <div className="mb-6 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          {isOwner
            ? "Stripe isn't connected yet — set STRIPE_SECRET_KEY (and STRIPE_WEBHOOK_SECRET) on the server to switch on paid subscriptions."
            : "Paid plans aren't available just yet — check back soon."}
        </div>
      ) : null}

      <p className="mb-4 text-sm text-slate-600">
        Current plan: <span className="font-semibold text-slate-900">{current.name}</span>
      </p>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {PLANS.map((p) => {
          const isCurrent = p.key === current.key;
          return (
            <div key={p.key} className={`card flex flex-col p-5 ${isCurrent ? "ring-2 ring-brand-500" : ""}`}>
              <h3 className="text-lg font-bold text-slate-900">{p.name}</h3>
              <div className="mt-1">
                <span className="text-2xl font-bold text-slate-900">${p.priceMonthly}</span>
                <span className="text-sm text-slate-500">/mo</span>
              </div>
              <p className="mt-2 text-sm text-slate-500">{p.blurb}</p>
              <ul className="mt-3 flex-1 space-y-1 text-sm text-slate-600">
                {p.features.length === 0 ? <li>Core CRM & website</li> : p.features.map((f) => <li key={f}>✓ {FEATURE_LABEL[f]}</li>)}
              </ul>
              <div className="mt-4">
                {isCurrent ? (
                  <span className="btn-secondary w-full cursor-default opacity-70">Current plan</span>
                ) : (
                  <form action={startCheckoutAction}>
                    <input type="hidden" name="plan" value={p.key} />
                    <button className="btn-primary w-full" disabled={p.priceMonthly > 0 && !configured}>
                      {p.priceMonthly === 0 ? "Switch to Free" : `Choose ${p.name}`}
                    </button>
                  </form>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </main>
  );
}

function Banner({ children, ok }: { children: React.ReactNode; ok?: boolean }) {
  return (
    <div className={`mb-6 rounded-xl px-4 py-3 text-sm ${ok ? "bg-green-50 text-green-800" : "bg-slate-100 text-slate-700"}`}>
      {children}
    </div>
  );
}
