import { requireLocationAccess } from "@/lib/auth";
import { PageHeader, Badge } from "@/components/ui";

export const dynamic = "force-dynamic";
export const metadata = { title: "Payments" };

const modules = [
  { icon: "🧾", title: "Invoices", body: "Create, send and track invoices with your ABN/tax and GST automatically applied." },
  { icon: "📝", title: "Estimates & quotes", body: "Send quotes that convert into invoices in a click." },
  { icon: "✍️", title: "Contracts & e-sign", body: "Send documents for a legally-binding signature, stored against the contact." },
  { icon: "🔁", title: "Subscriptions", body: "Recurring billing for memberships and ongoing services." },
  { icon: "📦", title: "Products & services", body: "A catalogue of what you sell, reused across invoices and quotes." },
  { icon: "💳", title: "Payment gateways", body: "Connect your own Stripe or Square to get paid by card, Apple & Google Pay." },
  { icon: "📊", title: "Transactions", body: "Every payment, refund and payout in one ledger." },
];

export default async function PaymentsPage({ params }: { params: { locationId: string } }) {
  await requireLocationAccess(params.locationId);
  return (
    <div>
      <PageHeader title="Payments" subtitle="Invoices, contracts, subscriptions & getting paid" />
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
