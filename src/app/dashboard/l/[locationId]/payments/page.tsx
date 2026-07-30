import { requireLocationAccess } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { PageHeader, Badge } from "@/components/ui";
import { ConnectButton, DisconnectButton } from "@/components/integration-connect";
import { isConfigured } from "@/lib/oauth-providers";

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

  const conns = await prisma.connection.findMany({
    where: { locationId: params.locationId, provider: { in: ["STRIPE", "SQUARE"] } },
  });
  const stripeConn = conns.find((c) => c.provider === "STRIPE");
  const squareConn = conns.find((c) => c.provider === "SQUARE");
  const stripeConnected = stripeConn?.status === "CONNECTED";
  const squareConnected = squareConn?.status === "CONNECTED";
  const squareOauth = isConfigured("SQUARE"); // one-click when the Square app is set up

  return (
    <div>
      <PageHeader title="Payments" subtitle="Connect a gateway, then invoice and get paid" />

      {/* Payment gateways — each business connects its OWN account */}
      <section className="mb-8">
        <h2 className="mb-1 text-sm font-semibold uppercase tracking-wide text-slate-500">Payment gateways</h2>
        <p className="mb-3 max-w-2xl text-sm text-slate-500">
          Connect your own payment account so money from invoices and bookings lands directly in it. Your keys are
          encrypted and never shared.
        </p>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {/* Stripe — connectable now */}
          <div className="card flex flex-col p-5">
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-3">
                <span className="grid h-10 w-10 place-items-center rounded-xl bg-slate-100 text-xl">💳</span>
                <div>
                  <h3 className="font-semibold text-slate-900">Stripe</h3>
                  {stripeConnected && stripeConn?.accountLabel ? (
                    <p className="text-xs text-slate-500">{stripeConn.accountLabel}</p>
                  ) : null}
                </div>
              </div>
              {stripeConnected ? <Badge color="green">Connected</Badge> : <Badge color="amber">Not connected</Badge>}
            </div>
            <p className="mt-3 flex-1 text-sm text-slate-500">
              Take card payments, Apple &amp; Google Pay, subscriptions and invoices with your own Stripe account.
            </p>
            <div className="mt-4 flex items-center gap-2">
              <ConnectButton locationId={params.locationId} provider="STRIPE" connected={stripeConnected} oauthReady={false} />
              {stripeConnected ? <DisconnectButton locationId={params.locationId} provider="STRIPE" /> : null}
            </div>
          </div>

          {/* Square — connectable now */}
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
        {stripeConnected ? (
          <p className="mt-3 text-xs text-green-700">
            ✓ Stripe connected — invoices and paid bookings from this business will be charged into your Stripe account.
          </p>
        ) : (
          <p className="mt-3 text-xs text-slate-400">
            Find your keys at <span className="font-mono">dashboard.stripe.com → Developers → API keys</span>. A restricted key
            (with Checkout, Payments &amp; Invoices write access) is safest.
          </p>
        )}
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
