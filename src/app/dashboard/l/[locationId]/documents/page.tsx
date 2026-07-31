import { requireLocationAccess } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { PageHeader, Badge } from "@/components/ui";
import { NewDocument } from "@/components/homestead-new-document";
import { deleteDocumentAction } from "./actions";
import {
  complianceGaps,
  expiryState,
  daysUntilExpiry,
  EXPIRY_LABEL,
  EXPIRY_RANK,
  CATEGORY_LABEL,
  DEFAULT_WARN_DAYS,
  type ExpiryState,
} from "@/lib/homestead-documents-rules";
import { formatDate } from "@/lib/utils";
import type { DocumentCategory } from "@prisma/client";

export const dynamic = "force-dynamic";

const expiryColor: Record<ExpiryState, "green" | "amber" | "red" | "slate"> = {
  VALID: "green",
  EXPIRING_SOON: "amber",
  EXPIRED: "red",
  NO_EXPIRY: "slate",
};

export default async function DocumentsPage({ params }: { params: { locationId: string } }) {
  await requireLocationAccess(params.locationId);

  const [documents, rooms, bookings] = await Promise.all([
    prisma.homesteadDocument.findMany({
      where: { locationId: params.locationId },
      include: { room: { select: { name: true } }, booking: { select: { guestName: true } } },
      orderBy: { createdAt: "desc" },
    }),
    prisma.homesteadRoom.findMany({
      where: { locationId: params.locationId },
      select: { id: true, name: true },
      orderBy: { createdAt: "asc" },
    }),
    prisma.homesteadBooking.findMany({
      where: { locationId: params.locationId, status: { in: ["PENDING", "ACTIVE"] } },
      include: { room: { select: { name: true } } },
      orderBy: { startDate: "desc" },
    }),
  ]);

  const asOf = new Date();
  const withState = documents.map((d) => ({
    doc: d,
    state: expiryState(d.expiresAt, asOf),
    daysLeft: d.expiresAt ? daysUntilExpiry(d.expiresAt, asOf) : null,
  }));

  const expired = withState.filter((d) => d.state === "EXPIRED");
  const expiring = withState.filter((d) => d.state === "EXPIRING_SOON");
  const checklist = complianceGaps(documents, asOf);
  const missing = checklist.filter((c) => c.state === "MISSING");

  // Stays that accepted terms at booking but have no agreement on file. The
  // digital acceptance is recorded on the booking; this flags the paper trail.
  const agreementBookingIds = new Set(
    documents.filter((d) => d.category === "AGREEMENT" && d.bookingId).map((d) => d.bookingId)
  );
  const unpapered = bookings.filter((b) => b.contractAccepted && !agreementBookingIds.has(b.id));

  const stats = [
    { label: "On file", value: documents.length, tone: "" },
    { label: "Expired", value: expired.length, tone: expired.length ? "text-red-600" : "" },
    { label: "Expiring soon", value: expiring.length, tone: expiring.length ? "text-amber-600" : "" },
    { label: "Checklist gaps", value: missing.length, tone: missing.length ? "text-amber-600" : "" },
  ];

  // Problems first, then soonest to lapse.
  const sorted = [...withState].sort((a, b) => {
    const r = EXPIRY_RANK[a.state] - EXPIRY_RANK[b.state];
    if (r !== 0) return r;
    return (a.daysLeft ?? Infinity) - (b.daysLeft ?? Infinity);
  });

  const stays = bookings.map((b) => ({
    id: b.id,
    label: `${b.guestName} — ${b.room?.name ?? "no room"}`,
  }));

  return (
    <div>
      <PageHeader title="Documents" subtitle="Agreements, IDs and certificates — with an eye on what's about to lapse" />

      <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((s) => (
          <div key={s.label} className="card p-4">
            <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">{s.label}</div>
            <div className={`mt-1 text-2xl font-bold tabular-nums ${s.tone || "text-slate-900"}`}>{s.value}</div>
          </div>
        ))}
      </div>

      {expired.length > 0 || expiring.length > 0 ? (
        <div className={`mb-6 rounded-2xl border p-4 ${expired.length ? "border-red-200 bg-red-50" : "border-amber-200 bg-amber-50"}`}>
          <h2 className={`text-sm font-semibold ${expired.length ? "text-red-800" : "text-amber-800"}`}>
            {expired.length > 0
              ? `${expired.length} document${expired.length === 1 ? " has" : "s have"} expired`
              : `${expiring.length} document${expiring.length === 1 ? "" : "s"} expiring within ${DEFAULT_WARN_DAYS} days`}
          </h2>
          <ul className="mt-2 space-y-1">
            {[...expired, ...expiring].map(({ doc, daysLeft }) => (
              <li key={doc.id} className={`text-sm ${expired.length ? "text-red-700" : "text-amber-700"}`}>
                {doc.title}
                {doc.expiresAt ? (
                  <span className="opacity-80">
                    {" · "}
                    {daysLeft !== null && daysLeft < 0
                      ? `expired ${Math.abs(daysLeft)} day${Math.abs(daysLeft) === 1 ? "" : "s"} ago`
                      : `${daysLeft} day${daysLeft === 1 ? "" : "s"} left`}
                    {" · "}{formatDate(doc.expiresAt)}
                  </span>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <div className="space-y-6">
          {/* Compliance checklist */}
          <section>
            <h2 className="mb-1 text-sm font-semibold uppercase tracking-wide text-slate-500">Compliance checklist</h2>
            <p className="mb-2 max-w-2xl text-xs text-slate-400">
              A starting list of paperwork accommodation businesses commonly keep — a prompt to check, not legal
              advice. Requirements vary by state and council; ignore the rows that don&rsquo;t apply to you.
            </p>
            <div className="card divide-y divide-slate-100">
              {checklist.map((c) => (
                <div key={c.key} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-medium text-slate-800">{c.label}</span>
                      {c.state === "MISSING"
                        ? <Badge color="slate">Nothing on file</Badge>
                        : <Badge color={expiryColor[c.state as ExpiryState]}>{EXPIRY_LABEL[c.state as ExpiryState]}</Badge>}
                    </div>
                    <div className="mt-0.5 text-xs text-slate-400">
                      {c.matched
                        ? <>{c.matched.title}{c.matched.expiresAt ? ` · expires ${formatDate(c.matched.expiresAt)}` : ""}</>
                        : c.hint}
                    </div>
                  </div>
                  {c.daysLeft !== null && c.state !== "MISSING" ? (
                    <span className={`shrink-0 text-xs tabular-nums ${c.daysLeft < 0 ? "font-semibold text-red-600" : c.daysLeft <= DEFAULT_WARN_DAYS ? "font-semibold text-amber-600" : "text-slate-400"}`}>
                      {c.daysLeft < 0 ? `${Math.abs(c.daysLeft)}d overdue` : `${c.daysLeft}d`}
                    </span>
                  ) : null}
                </div>
              ))}
            </div>
          </section>

          {/* Stays without a filed agreement */}
          {unpapered.length > 0 ? (
            <section>
              <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-500">Accepted terms, no agreement filed</h2>
              <div className="card divide-y divide-slate-100">
                {unpapered.map((b) => (
                  <div key={b.id} className="flex items-center justify-between gap-3 px-4 py-2.5">
                    <div>
                      <span className="text-sm text-slate-700">{b.guestName}</span>
                      <div className="text-xs text-slate-400">
                        {b.room?.name ?? "—"} · signed &ldquo;{b.signature ?? "—"}&rdquo; on booking
                      </div>
                    </div>
                    <Badge color="amber">No copy on file</Badge>
                  </div>
                ))}
              </div>
            </section>
          ) : null}

          {/* Everything on file */}
          <section>
            <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-500">All documents</h2>
            {sorted.length === 0 ? (
              <div className="card p-8 text-center text-sm text-slate-400">Nothing filed yet.</div>
            ) : (
              <div className="card divide-y divide-slate-100">
                {sorted.map(({ doc, state, daysLeft }) => (
                  <div key={doc.id} className="flex flex-wrap items-start justify-between gap-3 px-4 py-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        {doc.fileUrl ? (
                          <a href={doc.fileUrl} target="_blank" rel="noopener noreferrer" className="text-sm font-medium text-brand-700 underline-offset-2 hover:underline">
                            {doc.title} ↗
                          </a>
                        ) : (
                          <span className="text-sm font-medium text-slate-800">{doc.title}</span>
                        )}
                        <Badge color="slate">{CATEGORY_LABEL[doc.category as DocumentCategory]}</Badge>
                        {state !== "NO_EXPIRY" ? <Badge color={expiryColor[state]}>{EXPIRY_LABEL[state]}</Badge> : null}
                      </div>
                      <div className="mt-0.5 text-xs text-slate-400">
                        {doc.booking ? `${doc.booking.guestName} · ` : doc.room ? `${doc.room.name} · ` : "Whole property · "}
                        {doc.issuedAt ? `issued ${formatDate(doc.issuedAt)}` : "no issue date"}
                        {doc.expiresAt ? ` · expires ${formatDate(doc.expiresAt)}` : ""}
                        {doc.reference ? ` · ${doc.reference}` : ""}
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      {daysLeft !== null ? (
                        <span className={`text-xs tabular-nums ${daysLeft < 0 ? "font-semibold text-red-600" : daysLeft <= DEFAULT_WARN_DAYS ? "font-semibold text-amber-600" : "text-slate-400"}`}>
                          {daysLeft < 0 ? `${Math.abs(daysLeft)}d overdue` : `${daysLeft}d`}
                        </span>
                      ) : null}
                      <form action={deleteDocumentAction}>
                        <input type="hidden" name="locationId" value={params.locationId} />
                        <input type="hidden" name="documentId" value={doc.id} />
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
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">File a document</h2>
          <NewDocument
            locationId={params.locationId}
            rooms={rooms}
            stays={stays}
            prefillTitle={missing[0]?.label}
            prefillCategory={missing[0]?.category}
          />
        </div>
      </div>
    </div>
  );
}
