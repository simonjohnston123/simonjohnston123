import { requireSuperAdmin } from "@/lib/auth";
import { getSetting, SETTING_KEYS } from "@/lib/platform-settings";
import { stripeConnectConfigured, platformFeePercent } from "@/lib/stripe-connect";
import { PaymentsForm } from "./payments-form";

export const dynamic = "force-dynamic";
export const metadata = { title: "Admin — Payments" };

export default async function AdminPaymentsPage() {
  await requireSuperAdmin();

  const [secret, publishable, feeRaw, live, fee] = await Promise.all([
    getSetting(SETTING_KEYS.stripeSecretKey),
    getSetting(SETTING_KEYS.stripePublishableKey),
    getSetting(SETTING_KEYS.platformFeePercent),
    stripeConnectConfigured(),
    platformFeePercent(),
  ]);

  return (
    <div className="max-w-xl">
      <h1 className="mb-1 text-2xl font-bold text-slate-900">Payments</h1>
      <p className="mb-6 text-sm text-slate-500">
        Connect your platform Stripe account. Once both keys are set, businesses can accept card payments through Placid
        Connect and you earn your platform fee on every transaction.
      </p>

      <div
        className={`mb-6 rounded-xl border p-4 ${live ? "border-green-200 bg-green-50" : "border-amber-200 bg-amber-50"}`}
      >
        {live ? (
          <p className="text-sm font-medium text-green-800">
            ● Payments are LIVE — {fee}% platform fee on every transaction.
          </p>
        ) : (
          <p className="text-sm font-medium text-amber-800">
            ● Payments are not live yet — enter both Stripe keys below to switch on.
          </p>
        )}
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-5">
        <PaymentsForm
          secretSet={Boolean(secret)}
          publishableSet={Boolean(publishable)}
          feePercent={feeRaw ?? String(fee)}
        />
      </div>

      <p className="mt-4 text-xs text-slate-400">
        Keys come from your Placid Connect Stripe account → Developers → API keys. The secret key is stored encrypted and
        used server-side only; it&apos;s never sent to the browser.
      </p>
    </div>
  );
}
