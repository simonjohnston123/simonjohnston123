import { requireLocationAccess } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { PageHeader, Badge } from "@/components/ui";
import { GenerateTurnovers, NewOpsTask } from "@/components/homestead-ops-forms";
import { setOpsTaskStatusAction, deleteOpsTaskAction } from "./actions";
import { OPS_TYPE_LABEL, OPS_STATUS_LABEL, PRIORITY_RANK } from "@/lib/homestead-ops";
import { startOfDay } from "@/lib/homestead-dates";
import { formatDate } from "@/lib/utils";
import type { OpsPriority, OpsTaskStatus } from "@prisma/client";

export const dynamic = "force-dynamic";

const priorityColor: Record<OpsPriority, "red" | "amber" | "slate" | "blue"> = {
  URGENT: "red",
  HIGH: "amber",
  NORMAL: "slate",
  LOW: "slate",
};

const COLUMNS: OpsTaskStatus[] = ["TODO", "IN_PROGRESS", "BLOCKED", "DONE"];

export default async function OperationsPage({ params }: { params: { locationId: string } }) {
  await requireLocationAccess(params.locationId);

  const [tasks, rooms] = await Promise.all([
    prisma.homesteadOpsTask.findMany({
      where: { locationId: params.locationId },
      include: { room: { select: { name: true } }, booking: { select: { guestName: true, stayType: true } } },
      orderBy: [{ dueAt: "asc" }, { createdAt: "desc" }],
      take: 200,
    }),
    prisma.homesteadRoom.findMany({
      where: { locationId: params.locationId },
      select: { id: true, name: true },
      orderBy: { createdAt: "asc" },
    }),
  ]);

  const today = startOfDay(new Date());
  const open = tasks.filter((t) => t.status !== "DONE");

  const overdue = open.filter((t) => t.dueAt && startOfDay(t.dueAt) < today);
  const dueToday = open.filter((t) => t.dueAt && startOfDay(t.dueAt).getTime() === today.getTime());
  const urgent = open.filter((t) => t.priority === "URGENT");
  const maintenanceSpend = tasks
    .filter((t) => t.type === "MAINTENANCE" && t.cost)
    .reduce((sum, t) => sum + (t.cost ?? 0), 0);

  // Urgent first, then by due date — the order someone should actually work in.
  const sorted = [...open].sort((a, b) => {
    const p = PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority];
    if (p !== 0) return p;
    const ad = a.dueAt ? startOfDay(a.dueAt).getTime() : Infinity;
    const bd = b.dueAt ? startOfDay(b.dueAt).getTime() : Infinity;
    return ad - bd;
  });

  const stats = [
    { label: "Open", value: open.length, tone: "" },
    { label: "Urgent", value: urgent.length, tone: urgent.length ? "text-red-600" : "" },
    { label: "Overdue", value: overdue.length, tone: overdue.length ? "text-amber-600" : "" },
    { label: "Due today", value: dueToday.length, tone: "" },
    { label: "Maintenance spend", value: `$${maintenanceSpend.toLocaleString()}`, tone: "" },
  ];

  return (
    <div>
      <PageHeader
        title="Operations"
        subtitle="Cleaning, inspections and maintenance — driven by the booking calendar"
        action={<GenerateTurnovers locationId={params.locationId} />}
      />

      <div className="mb-6 grid gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {stats.map((s) => (
          <div key={s.label} className="card p-4">
            <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">{s.label}</div>
            <div className={`mt-1 text-2xl font-bold tabular-nums ${s.tone || "text-slate-900"}`}>{s.value}</div>
          </div>
        ))}
      </div>

      {urgent.length > 0 ? (
        <div className="mb-6 rounded-2xl border border-red-200 bg-red-50 p-4">
          <h2 className="text-sm font-semibold text-red-800">
            {urgent.length} urgent {urgent.length === 1 ? "job" : "jobs"} — a guest arrives the same day
          </h2>
          <ul className="mt-2 space-y-1">
            {urgent.map((t) => (
              <li key={t.id} className="text-sm text-red-700">
                {t.title}{t.dueAt ? <span className="text-red-500"> · due {formatDate(t.dueAt)}</span> : null}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <div className="space-y-6">
          {/* Work queue */}
          <section>
            <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-500">Work queue</h2>
            {sorted.length === 0 ? (
              <div className="card p-8 text-center text-sm text-slate-400">
                Nothing outstanding. Use <b className="text-slate-600">Generate from departures</b> to pull cleans out of the booking calendar.
              </div>
            ) : (
              <div className="card divide-y divide-slate-100">
                {sorted.map((t) => {
                  const isOverdue = t.dueAt && startOfDay(t.dueAt) < today;
                  return (
                    <div key={t.id} className="flex flex-wrap items-start justify-between gap-3 px-4 py-3">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-medium text-slate-800">{t.title}</span>
                          <Badge color={priorityColor[t.priority]}>{t.priority === "NORMAL" ? OPS_TYPE_LABEL[t.type] : t.priority}</Badge>
                          {t.status !== "TODO" ? <Badge color="blue">{OPS_STATUS_LABEL[t.status]}</Badge> : null}
                        </div>
                        <div className="mt-0.5 text-xs text-slate-500">
                          {t.room?.name ?? "Whole property"}
                          {t.dueAt ? <> · due <span className={isOverdue ? "font-semibold text-amber-600" : ""}>{formatDate(t.dueAt)}</span></> : null}
                          {t.cost ? <> · ${t.cost.toLocaleString()}</> : null}
                          {t.booking ? <> · after {t.booking.guestName}</> : null}
                        </div>
                        {t.notes ? <p className="mt-1 text-xs text-slate-400">{t.notes}</p> : null}
                      </div>

                      <div className="flex shrink-0 flex-wrap gap-1">
                        {COLUMNS.filter((s) => s !== t.status).map((s) => (
                          <form key={s} action={setOpsTaskStatusAction}>
                            <input type="hidden" name="locationId" value={params.locationId} />
                            <input type="hidden" name="taskId" value={t.id} />
                            <input type="hidden" name="status" value={s} />
                            <button className="rounded bg-slate-50 px-2 py-0.5 text-xs text-slate-600 hover:bg-slate-100">
                              {OPS_STATUS_LABEL[s]}
                            </button>
                          </form>
                        ))}
                        <form action={deleteOpsTaskAction}>
                          <input type="hidden" name="locationId" value={params.locationId} />
                          <input type="hidden" name="taskId" value={t.id} />
                          <button className="rounded px-2 py-0.5 text-xs text-slate-300 hover:text-red-600">✕</button>
                        </form>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          {/* Recently completed */}
          {tasks.some((t) => t.status === "DONE") ? (
            <section>
              <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-500">Completed</h2>
              <div className="card divide-y divide-slate-100">
                {tasks.filter((t) => t.status === "DONE").slice(0, 10).map((t) => (
                  <div key={t.id} className="flex items-center justify-between gap-3 px-4 py-2.5">
                    <div className="min-w-0">
                      <span className="text-sm text-slate-500 line-through">{t.title}</span>
                      <div className="text-xs text-slate-400">
                        {t.room?.name ?? "Whole property"}
                        {t.completedAt ? <> · done {formatDate(t.completedAt)}</> : null}
                      </div>
                    </div>
                    <form action={setOpsTaskStatusAction} className="shrink-0">
                      <input type="hidden" name="locationId" value={params.locationId} />
                      <input type="hidden" name="taskId" value={t.id} />
                      <input type="hidden" name="status" value="TODO" />
                      <button className="rounded bg-slate-50 px-2 py-0.5 text-xs text-slate-600 hover:bg-slate-100">Reopen</button>
                    </form>
                  </div>
                ))}
              </div>
            </section>
          ) : null}
        </div>

        {/* New task */}
        <div className="space-y-2">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Add a job</h2>
          <NewOpsTask locationId={params.locationId} rooms={rooms} />
        </div>
      </div>
    </div>
  );
}
