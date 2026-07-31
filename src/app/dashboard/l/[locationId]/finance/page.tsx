import { requireLocationAccess } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { PageHeader, Badge } from "@/components/ui";
import { RecordPayment } from "@/components/homestead-record-payment";
import { deletePaymentAction } from "./actions";
import { balanceFor, weeklyRentRoll, BALANCE_LABEL, type BalanceStatus } from "@/lib/homestead-finance-rules";
import { formatDate } from "@/lib/utils";

export const dynamic = "force-dynamic";

const money = (n: number) => `$${Math.round(n).toLocaleString()}`;

const balanceColor: Record<BalanceStatus, "green" | "amber" | "red" | "slate" | "blue"> = {
  PAID: "green",
  OWING: "amber",
  ARREARS: "red",
  CREDIT: "blue",
  NOT_STARTED: "slate",
};

const METHOD_LABEL: Record<string, string> = {
  CASH: "Cash",
  BANK_TRANSFER: "Bank transfer",
  CARD: "Card",
  STRIPE: "Stripe",
  OTHER: "Other",
};

export default async function FinancePage({ params }: { params: { locationId: string } }) {
  await requireLocationAccess(params.locationId);

  const [bookings, payments, settings, maintenance] = await Promise.all([
    prisma.homesteadBooking.findMany({
      where: { locationId: params.locationId, status: { not: "CANCELLED" } },
      include: { room: { select: { name: true } } },
      orderBy: { startDate: "asc" },
    }),
    prisma.homesteadPayment.findMany({
      where: { locationId: params.locationId },
      include: { booking: { select: { guestName: true } } },
      orderBy: { paidAt: "desc" },
      take: 100,
    }),
    prisma.homesteadSettings.findUnique({ where: { locationId: params.locationId } }),
    prisma.homesteadOpsTask.findMany({
      where: { locationId: params.locationId, type: "MAINTENANCE", cost: { not: null } },
      select: { id: true, title: true, cost: true, status: true, createdAt: true },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  const depositWeeks = settings?.depositWeeks ?? 1;
  const asOf = new Date();

  const paymentsByBooking = new Map<string, { amount: number }[]>();
  for (const p of payments) {
    const list = paymentsByBooking.get(p.bookingId) ?? [];
    list.push({ amount: p.amount });
    paymentsByBooking.set(p.bookingId, list);
  }

  const rows = bookings.map((b) => ({
    booking: b,
    balance: balanceFor(b, paymentsByBooking.get(b.id) ?? [], asOf, depositWeeks),
  }));

  const residents = rows.filter((r) => r.booking.stayType === "WEEKLY");
  const guests = rows.filter((r) => r.booking.stayType === "NIGHTLY");

  const rentRoll = weeklyRentRoll(bookings);
  const totalOwed = rows.reduce((s, r) => s + Math.max(0, r.balance.balance), 0);
  const inArrears = rows.filter((r) => r.balance.status === "ARREARS");
  const collected = payments.reduce((s, p) => s + p.amount, 0);
  const maintenanceSpend = maintenance.reduce((s, m) => s + (m.cost ?? 0), 0);

  const stats = [
    { label: "Weekly rent roll", value: money(rentRoll), tone: "" },
    { label: "Outstanding", value: money(totalOwed), tone: totalOwed > 0 ? "text-amber-600" : "" },
    { label: "In arrears", value: String(inArrears.length), tone: inArrears.length ? "text-red-600" : "" },
    { label: "Collected", value: money(collected), tone: "" },
    { label: "Maintenance", value: money(maintenanceSpend), tone: "" },
  ];

  // Pre-fill the payment form with what each stay actually owes.
  const payers = rows
    .filter((r) => r.booking.status === "PENDING" || r.booking.status === "ACTIVE")
    .map((r) => ({
      id: r.booking.id,
      label: `${r.booking.guestName} — ${r.booking.room?.name ?? "no room"}${r.balance.balance > 0 ? ` (owes ${money(r.balance.balance)})` : ""}`,
      suggested: Math.max(0, Math.round(r.balance.balance)),
    }));

  return (
    <div>
      <PageHeader title="Finance" subtitle="Rent roll, arrears and takings — residents and nightly guests" />

      <div className="mb-6 grid gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {stats.map((s) => (
          <div key={s.label} className="card p-4">
            <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">{s.label}</div>
            <div className={`mt-1 text-2xl font-bold tabular-nums ${s.tone || "text-slate-900"}`}>{s.value}</div>
          </div>
        ))}
      </div>

      {inArrears.length > 0 ? (
        <div className="mb-6 rounded-2xl border border-red-200 bg-red-50 p-4">
          <h2 className="text-sm font-semibold text-red-800">
            {inArrears.length} {inArrears.length === 1 ? "stay is" : "stays are"} a full week or more behind
          </h2>
          <ul className="mt-2 space-y-1">
            {inArrears.map((r) => (
              <li key={r.booking.id} className="text-sm text-red-700">
                {r.booking.guestName} — {money(r.balance.balance)} outstanding
                {r.balance.weeksBehind > 0 ? ` · ${r.balance.weeksBehind} week${r.balance.weeksBehind === 1 ? "" : "s"} behind` : ""}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <div className="space-y-6">
          {/* Rent roll */}
          <section>
            <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-500">Rent roll — residents</h2>
            {residents.length === 0 ? (
              <div className="card p-6 text-center text-sm text-slate-400">No residents yet.</div>
            ) : (
              <div className="overflow-x-auto">
                <div className="card min-w-[640px]">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-slate-200 text-left text-[11px] uppercase tracking-wide text-slate-400">
                        <th className="px-4 py-2 font-semibold">Resident</th>
                        <th className="px-4 py-2 font-semibold">Rate</th>
                        <th className="px-4 py-2 text-right font-semibold">Expected</th>
                        <th className="px-4 py-2 text-right font-semibold">Paid</th>
                        <th className="px-4 py-2 text-right font-semibold">Balance</th>
                        <th className="px-4 py-2 font-semibold">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {residents.map(({ booking: b, balance }) => (
                        <tr key={b.id}>
                          <td className="px-4 py-2.5">
                            <div className="font-medium text-slate-800">{b.guestName}</div>
                            <div className="text-xs text-slate-400">
                              {b.room?.name ?? "—"} · from {formatDate(b.startDate)}
                              {balance.weeksAccrued > 0 ? ` · ${balance.weeksAccrued} wk` : ""}
                            </div>
                          </td>
                          <td className="px-4 py-2.5 tabular-nums text-slate-600">{money(b.weeklyPrice)}/wk</td>
                          <td className="px-4 py-2.5 text-right tabular-nums text-slate-600">{money(balance.expected)}</td>
                          <td className="px-4 py-2.5 text-right tabular-nums text-slate-600">{money(balance.paid)}</td>
                          <td className={`px-4 py-2.5 text-right font-semibold tabular-nums ${balance.balance > 0 ? "text-red-600" : "text-slate-500"}`}>
                            {money(balance.balance)}
                          </td>
                          <td className="px-4 py-2.5"><Badge color={balanceColor[balance.status]}>{BALANCE_LABEL[balance.status]}</Badge></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </section>

          {/* Nightly stays */}
          {guests.length > 0 ? (
            <section>
              <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-500">Nightly stays</h2>
              <div className="card divide-y divide-slate-100">
                {guests.map(({ booking: b, balance }) => (
                  <div key={b.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-slate-800">{b.guestName}</span>
                        <Badge color={balanceColor[balance.status]}>{BALANCE_LABEL[balance.status]}</Badge>
                      </div>
                      <div className="text-xs text-slate-400">
                        {b.room?.name ?? "—"} · {formatDate(b.startDate)}
                        {b.endDate ? ` → ${formatDate(b.endDate)}` : ""}
                      </div>
                    </div>
                    <div className="text-right text-sm tabular-nums">
                      <div className="text-slate-500">{money(balance.paid)} of {money(balance.expected)}</div>
                      {balance.balance > 0 ? <div className="text-xs font-semibold text-red-600">{money(balance.balance)} due</div> : null}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          ) : null}

          {/* Maintenance costs, carried over from Operations */}
          {maintenance.length > 0 ? (
            <section>
              <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-500">Maintenance costs</h2>
              <div className="card divide-y divide-slate-100">
                {maintenance.map((m) => (
                  <div key={m.id} className="flex items-center justify-between gap-3 px-4 py-2.5">
                    <div className="min-w-0">
                      <div className="truncate text-sm text-slate-700">{m.title}</div>
                      <div className="text-xs text-slate-400">{m.status === "DONE" ? "Completed" : "Open"} · {formatDate(m.createdAt)}</div>
                    </div>
                    <span className="shrink-0 text-sm font-semibold tabular-nums text-slate-700">{money(m.cost ?? 0)}</span>
                  </div>
                ))}
              </div>
            </section>
          ) : null}

          {/* Ledger */}
          <section>
            <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-500">Payments received</h2>
            {payments.length === 0 ? (
              <div className="card p-6 text-center text-sm text-slate-400">Nothing recorded yet.</div>
            ) : (
              <div className="card divide-y divide-slate-100">
                {payments.map((p) => (
                  <div key={p.id} className="flex items-center justify-between gap-3 px-4 py-2.5">
                    <div className="min-w-0">
                      <div className="text-sm text-slate-700">{p.booking.guestName}</div>
                      <div className="text-xs text-slate-400">
                        {formatDate(p.paidAt)} · {METHOD_LABEL[p.method] ?? p.method}
                        {p.reference ? ` · ${p.reference}` : ""}
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <span className="text-sm font-semibold tabular-nums text-green-700">{money(p.amount)}</span>
                      <form action={deletePaymentAction}>
                        <input type="hidden" name="locationId" value={params.locationId} />
                        <input type="hidden" name="paymentId" value={p.id} />
                        <button className="rounded px-1.5 py-0.5 text-xs text-slate-300 hover:text-red-600">✕</button>
                      </form>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>

        <div className="space-y-2">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Record a payment</h2>
          <RecordPayment locationId={params.locationId} payers={payers} />
          <p className="px-1 text-xs text-slate-400">
            Rent accrues weekly from move-in. {depositWeeks} week{depositWeeks === 1 ? "" : "s"} charged in advance — change that in Rooms → Booking rules.
          </p>
        </div>
      </div>
    </div>
  );
}
