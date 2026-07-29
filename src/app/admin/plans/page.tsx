import { PLANS, FEATURE_LABEL, type FeatureKey } from "@/lib/plans";
import { stripeConfigured } from "@/lib/stripe";

export const dynamic = "force-dynamic";
export const metadata = { title: "Admin — Plans" };

const ALL_FEATURES = Object.keys(FEATURE_LABEL) as FeatureKey[];

export default async function AdminPlans() {
  const charging = stripeConfigured();

  return (
    <div>
      <h1 className="mb-1 text-2xl font-bold text-slate-900">Plans &amp; pricing</h1>
      <p className="mb-6 text-sm text-slate-500">What each plan costs and which features it unlocks. Businesses subscribe from their Billing page.</p>

      <div className={`mb-6 rounded-xl border px-4 py-3 text-sm ${charging ? "border-green-200 bg-green-50 text-green-800" : "border-amber-200 bg-amber-50 text-amber-800"}`}>
        {charging
          ? "✅ Stripe is connected — businesses can be charged for paid plans."
          : "⚠️ Stripe isn't connected yet, so no one can be charged. Add STRIPE_SECRET_KEY + STRIPE_WEBHOOK_SECRET to switch on billing (give me your Stripe key and I'll wire it)."}
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] overflow-hidden rounded-xl border border-slate-200 bg-white text-sm">
          <thead>
            <tr className="border-b border-slate-100 text-left">
              <th className="px-4 py-3 font-semibold text-slate-700">Feature</th>
              {PLANS.map((p) => (
                <th key={p.key} className="px-4 py-3 text-center">
                  <div className="font-bold text-slate-900">{p.name}</div>
                  <div className="text-xs font-medium text-brand-600">{p.priceMonthly === 0 ? "Free" : `$${p.priceMonthly}/mo`}</div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            <tr>
              <td className="px-4 py-2.5 text-slate-600">Businesses included</td>
              {PLANS.map((p) => (
                <td key={p.key} className="px-4 py-2.5 text-center text-slate-700">{p.subAccountLimit >= 9999 ? "Unlimited" : p.subAccountLimit}</td>
              ))}
            </tr>
            {ALL_FEATURES.map((f) => (
              <tr key={f}>
                <td className="px-4 py-2.5 text-slate-600">{FEATURE_LABEL[f]}</td>
                {PLANS.map((p) => (
                  <td key={p.key} className="px-4 py-2.5 text-center">
                    {p.features.includes(f) ? <span className="text-green-600">✓</span> : <span className="text-slate-300">—</span>}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="mt-4 text-xs text-slate-400">
        To change prices, plan names or which features each unlocks, tell me the new structure and I&rsquo;ll update it (an
        in-app plan editor can be built too).
      </p>
    </div>
  );
}
