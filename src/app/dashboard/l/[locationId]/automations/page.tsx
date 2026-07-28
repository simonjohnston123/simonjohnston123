import Link from "next/link";
import { requireLocationAccess } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { PageHeader, Badge } from "@/components/ui";
import { NewWorkflowForm } from "@/components/automation-builder";
import { TRIGGERS, type TriggerKey } from "@/lib/automation-catalog";
import { formatDateTime } from "@/lib/utils";

export const dynamic = "force-dynamic";

const STATUS_COLOR: Record<string, "green" | "amber" | "slate"> = {
  ACTIVE: "green",
  PAUSED: "amber",
  DRAFT: "slate",
};

export default async function AutomationsPage({ params }: { params: { locationId: string } }) {
  const { locationId } = params;
  await requireLocationAccess(locationId);

  const workflows = await prisma.workflow.findMany({
    where: { locationId },
    orderBy: { updatedAt: "desc" },
    include: {
      _count: { select: { steps: true, runs: true } },
      runs: { orderBy: { startedAt: "desc" }, take: 1 },
    },
  });

  const base = `/dashboard/l/${locationId}/automations`;
  const active = workflows.filter((w) => w.status === "ACTIVE").length;

  return (
    <div>
      <PageHeader
        title="Automations"
        subtitle={`${workflows.length} automation${workflows.length === 1 ? "" : "s"} · ${active} active`}
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-3 lg:col-span-2">
          {workflows.length === 0 ? (
            <div className="card p-10 text-center">
              <p className="text-base font-medium text-slate-800">No automations yet</p>
              <p className="mx-auto mt-1 max-w-md text-sm text-slate-500">
                Automations run a chain of actions whenever something happens — a new contact, a booking, a tag.
                Create your first one on the right.
              </p>
            </div>
          ) : (
            workflows.map((w) => {
              const lastRun = w.runs[0];
              return (
                <Link key={w.id} href={`${base}/${w.id}`} className="card block p-5 transition hover:border-brand-300">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="truncate text-base font-semibold text-slate-900">{w.name}</h3>
                        <Badge color={STATUS_COLOR[w.status]}>{w.status.toLowerCase()}</Badge>
                      </div>
                      <p className="mt-1 text-sm text-slate-500">
                        <span className="font-medium text-slate-600">When:</span>{" "}
                        {TRIGGERS[w.triggerType as TriggerKey]?.label ?? w.triggerType}
                      </p>
                    </div>
                    <span className="text-slate-300">›</span>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-4 text-xs text-slate-500">
                    <span>{w._count.steps} step{w._count.steps === 1 ? "" : "s"}</span>
                    <span>{w._count.runs} run{w._count.runs === 1 ? "" : "s"}</span>
                    {lastRun ? <span>Last run {formatDateTime(lastRun.startedAt)}</span> : <span>Never run</span>}
                  </div>
                </Link>
              );
            })
          )}
        </div>

        <div>
          <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-500">New automation</h2>
          <NewWorkflowForm locationId={locationId} />
        </div>
      </div>
    </div>
  );
}
