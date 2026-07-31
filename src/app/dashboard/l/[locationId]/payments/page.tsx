import { requireLocationAccess } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { PageHeader, Badge } from "@/components/ui";
import { ConnectButton, DisconnectButton } from "@/components/integration-connect";
import { ConnectOnboarding } from "@/components/connect-onboarding";
import { isConfigured } from "@/lib/oauth-providers";
import {
  stripeConnectConfigured,
  stripePublishableKey,
  platformFeePercent,
  refreshAccountStatus,
} from "@/lib/stripe-connect";

export const dynamic = "force-dynamic";
export const metadata = { title: "Payments" };

const modules = [
  { icon: "🧾", title: "Invoices", body: "Create, send and track invoices with your ABN/tax and GST automatically applied." },
  { icon: "📝", title: "Estimates & quotes", body: "Send quotes that convert into invoices in a click." },
  { icon: "✍️", title: "Contracts & e-sign", body: "Send documents for a legally-binding signature, stored against the contact." },
  { icon: "🔁", title: "Subscriptions", body: "Recurring billing for memberships and ongoing services." },
  { icon: "📦", title: "Products & services", body: "A catalogue of what you sell, reused across invoices and quotes." },
  { icon: "📊", title: "Transactions", body: "Every payment, refund and payout in one ledger." },
];

export default async function PaymentsPage({ params }: { params: { locationId: string } }) {
  await requireLocationAccess(params.locationId);

  const location = await prisma.location.findUnique({ where: { id: params.locationId } });

  // Branded embedded payments ("Placid Connect payments").
  const [paymentsLive, pubKey] = await Promise.all([stripeConnectConfigured(), stripePublishableKey()]);
  let chargesEnabled = location?.stripeChargesEnabled ?? false;
  let detailsSubmitted = location?.stripeDetailsSubmitted ?? false;
  // If a connected account exists, refresh its live status (best-effort).
  if (paymentsLive && location?.stripeAccountId) {
    try {
      const s = await refreshAccountStatus(params.locationId);
      chargesEnabled = s.charges;
      detailsSubmitted = s.details;
    } catch {
      /* keep cached flags */
    }
  }
  const feePct = await platformFeePercent();

  // Square still connects via the business's own Square login (kept as an option).
  const squareConn = await prisma.connection.findUnique({
    where: { locationId_provider: { locationId: params.locationId, provider: "SQUARE" } },
  }).catch(() => null);
  const squareConnected = squareConn?.status === "CONNECTED";
  const squareOauth = isConfigured("SQUARE");

  return (
    <div>
      <PageHeader title="Payments" subtitle="Accept card payments and get paid — powered by Placid Connect" />

      {/* Placid Connect payments — branded embedded onboarding */}
      <section className="mb-8">
        <div className="card overflow-hidden p-0">
          <div className="bg-brand-gradient px-6 py-5 text-white">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold">Accept payments with Placid Connect</h2>
                <p className="mt-0.5 text-sm text-white/80">
                  Take cards, Apple &amp; Google Pay and pay out to your bank — set up in minutes, no separate accounts.
                </p>
              </div>
              {chargesEnabled ? (
                <Badge color="green">Active</Badge>
              ) : detailsSubmitted ? (
                <Badge color="amber">In review</Badge>
              ) : (
                <Badge color="slate">Not set up</Badge>
              )}
            </div>
          </div>

          <div className="p-6">
            {chargesEnabled ? (
              <div className="rounded-xl bg-green-50 p-4 text-sm text-green-800">
                <p className="font-medium">✓ Your payments are switched on.</p>
                <p className="mt-1">
                  Invoices and paid bookings are charged securely and paid out to your bank. A{" "}
                  <span className="font-semibold">{feePct}%</span> Placid Connect fee applies to each payment.
                </p>
              </div>
            ) : !paymentsLive ? (
              <div className="rounded-xl bg-slate-50 p-4 text-sm text-slate-600">
                <p className="font-medium text-slate-800">Payments are being switched on for your account.</p>
                <p className="mt-1">
                  We&apos;re finishing the final activation step — you&apos;ll be able to set up payouts here shortly.
                </p>
              </div>
            ) : pubKey ? (
              <div>
                <p className="mb-4 max-w-2xl text-sm text-slate-500">
                  Answer a few quick questions to verify your business and connect your bank. It&apos;s all handled
                  right here — you never leave Placid Connect.
                </p>
                <ConnectOnboarding locationId={params.locationId} publishableKey={pubKey} />
              </div>
            ) : null}

            {detailsSubmitted && !chargesEnabled ? (
              <p className="mt-4 text-xs text-slate-500">
                Your details are in — verification usually completes within a few minutes. Refresh this page to check.
              </p>
            ) : null}
          </div>
        </div>
      </section>

      {/* Square — optional alternative gateway (business's own Square login) */}
      <section className="mb-8">
        <h2 className="mb-1 text-sm font-semibold uppercase tracking-wide text-slate-500">Already use Square?</h2>
        <p className="mb-3 max-w-2xl text-sm text-slate-500">
          Prefer to keep taking payments through your existing Square account? Connect it here instead.
        </p>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div className="card flex flex-col p-5">
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-3">
                <span className="grid h-10 w-10 place-items-center rounded-xl bg-slate-100 text-xl">◼️</span>
                <div>
                  <h3 className="font-semibold text-slate-900">Square</h3>
                  {squareConnected && squareConn?.accountLabel ? (
                    <p className="text-xs text-slate-500">{squareConn.accountLabel}</p>
                  ) : null}
                </div>
              </div>
              {squareConnected ? <Badge color="green">Connected</Badge> : <Badge color="amber">Not connected</Badge>}
            </div>
            <p className="mt-3 flex-1 text-sm text-slate-500">
              Take card payments and sync transactions with your own Square account.
            </p>
            <div className="mt-4 flex items-center gap-2">
              <ConnectButton locationId={params.locationId} provider="SQUARE" connected={squareConnected} oauthReady={squareOauth} />
              {squareConnected ? <DisconnectButton locationId={params.locationId} provider="SQUARE" /> : null}
            </div>
          </div>
        </div>
      </section>

      {/* Coming-soon payment features */}
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">Billing tools</h2>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {modules.map((m) => (
          <div key={m.title} className="card p-5">
            <div className="mb-3 flex items-center justify-between">
              <span className="grid h-11 w-11 place-items-center rounded-xl bg-brand-gradient text-lg text-white">{m.icon}</span>
              <Badge color="slate">Coming soon</Badge>
            </div>
            <h3 className="font-semibold text-slate-900">{m.title}</h3>
            <p className="mt-1 text-sm text-slate-500">{m.body}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
