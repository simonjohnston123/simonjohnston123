import Link from "next/link";
import { notFound } from "next/navigation";
import { requireLocationAccess } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { Badge } from "@/components/ui";
import { AddStepForm, TestRunForm } from "@/components/automation-builder";
import {
  updateTriggerAction,
  setStatusAction,
  deleteStepAction,
  moveStepAction,
  deleteWorkflowAction,
} from "../actions";
import { ACTIONS, TRIGGERS, TRIGGER_KEYS, type ActionKey, type TriggerKey } from "@/lib/automation-catalog";
import { contactName, formatDateTime } from "@/lib/utils";

export const dynamic = "force-dynamic";

const STATUS_COLOR: Record<string, "green" | "amber" | "slate"> = {
  ACTIVE: "green",
  PAUSED: "amber",
  DRAFT: "slate",
};

function summarize(actionType: ActionKey, config: Record<string, string>): string {
  switch (actionType) {
    case "ADD_TAG":
      return config.tag ? `“${config.tag}”` : "—";
    case "CREATE_TASK":
      return config.title ?? "Follow up";
    case "SEND_EMAIL":
      return config.subject || config.body?.slice(0, 60) || "—";
    case "SEND_SMS":
    case "CREATE_NOTE":
      return config.body?.slice(0, 60) ?? "—";
    case "WAIT":
      return `${config.minutes ?? 0} min`;
    default:
      return "";
  }
}

export default async function WorkflowBuilderPage({
  params,
}: {
  params: { locationId: string; workflowId: string };
}) {
  const { locationId, workflowId } = params;
  await requireLocationAccess(locationId);

  const workflow = await prisma.workflow.findFirst({
    where: { id: workflowId, locationId },
    include: { steps: { orderBy: { position: "asc" } } },
  });
  if (!workflow) notFound();

  const [contacts, runs] = await Promise.all([
    prisma.contact.findMany({ where: { locationId }, orderBy: { createdAt: "desc" }, take: 100 }),
    prisma.workflowRun.findMany({
      where: { workflowId },
      orderBy: { startedAt: "desc" },
      take: 8,
      include: { steps: { orderBy: { position: "asc" } } },
    }),
  ]);

  const contactOptions = contacts.map((c) => ({ id: c.id, label: contactName(c) }));
  const triggerCfg = (workflow.triggerConfig ?? {}) as Record<string, string>;
  const triggerMeta = TRIGGERS[workflow.triggerType as TriggerKey];
  const base = `/dashboard/l/${locationId}/automations`;
  const canActivate = workflow.steps.length > 0;

  return (
    <div>
      <Link href={base} className="mb-3 inline-block text-xs font-medium text-slate-400 hover:text-slate-600">
        ← All automations
      </Link>

      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-bold text-slate-900">{workflow.name}</h1>
          <Badge color={STATUS_COLOR[workflow.status]}>{workflow.status.toLowerCase()}</Badge>
        </div>
        <div className="flex items-center gap-2">
          {workflow.status === "ACTIVE" ? (
            <form action={setStatusAction}>
              <input type="hidden" name="locationId" value={locationId} />
              <input type="hidden" name="workflowId" value={workflow.id} />
              <input type="hidden" name="status" value="PAUSED" />
              <button className="btn-secondary text-sm">⏸ Pause</button>
            </form>
          ) : (
            <form action={setStatusAction} title={canActivate ? "" : "Add a step first"}>
              <input type="hidden" name="locationId" value={locationId} />
              <input type="hidden" name="workflowId" value={workflow.id} />
              <input type="hidden" name="status" value="ACTIVE" />
              <button className="btn-primary text-sm disabled:opacity-40" disabled={!canActivate}>
                ▶ Activate
              </button>
            </form>
          )}
          <form action={deleteWorkflowAction}>
            <input type="hidden" name="locationId" value={locationId} />
            <input type="hidden" name="workflowId" value={workflow.id} />
            <button className="btn-ghost text-sm text-slate-400 hover:text-red-600">Delete</button>
          </form>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Builder column */}
        <div className="space-y-6 lg:col-span-2">
          {/* Trigger */}
          <section className="card p-5">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Trigger</h2>
            <p className="mt-1 text-xs text-slate-400">What starts this automation.</p>
            <form action={updateTriggerAction} className="mt-3 flex flex-wrap items-end gap-3">
              <input type="hidden" name="locationId" value={locationId} />
              <input type="hidden" name="workflowId" value={workflow.id} />
              <div className="min-w-[220px] flex-1">
                <select name="triggerType" defaultValue={workflow.triggerType} className="input">
                  {TRIGGER_KEYS.map((k) => (
                    <option key={k} value={k}>
                      {TRIGGERS[k].label}
                      {TRIGGERS[k].live ? "" : " (coming soon)"}
                    </option>
                  ))}
                </select>
              </div>
              <div className="min-w-[160px] flex-1">
                <input
                  name="triggerTag"
                  defaultValue={triggerCfg.tag ?? ""}
                  className="input"
                  placeholder="Tag (only for Tag added)"
                />
              </div>
              <button className="btn-secondary text-sm">Save</button>
            </form>
            {triggerMeta && !triggerMeta.live ? (
              <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
                This trigger isn’t wired to fire automatically yet — use “Test run” to try the actions. Live triggers so
                far: Contact created and Manual.
              </p>
            ) : (
              <p className="mt-2 text-xs text-slate-400">{triggerMeta?.description}</p>
            )}
          </section>

          {/* Steps */}
          <section className="card p-5">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
              Steps ({workflow.steps.length})
            </h2>
            {workflow.steps.length === 0 ? (
              <p className="mt-3 rounded-lg border border-dashed border-slate-200 p-6 text-center text-sm text-slate-400">
                No steps yet. Add the first action below.
              </p>
            ) : (
              <ol className="mt-3 space-y-2">
                {workflow.steps.map((s, i) => {
                  const def = ACTIONS[s.actionType as ActionKey];
                  const cfg = (s.config ?? {}) as Record<string, string>;
                  return (
                    <li key={s.id} className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50/60 px-4 py-3">
                      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-brand-gradient text-sm text-white">
                        {def?.icon ?? "•"}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-medium text-slate-800">
                          {i + 1}. {def?.label ?? s.actionType}
                        </div>
                        <div className="truncate text-xs text-slate-500">{summarize(s.actionType as ActionKey, cfg)}</div>
                      </div>
                      <div className="flex items-center gap-1">
                        {[["up", "↑", i === 0], ["down", "↓", i === workflow.steps.length - 1]].map(
                          ([dir, glyph, disabled]) => (
                            <form key={dir as string} action={moveStepAction}>
                              <input type="hidden" name="locationId" value={locationId} />
                              <input type="hidden" name="workflowId" value={workflow.id} />
                              <input type="hidden" name="stepId" value={s.id} />
                              <input type="hidden" name="dir" value={dir as string} />
                              <button
                                className="h-7 w-7 rounded text-slate-400 hover:bg-slate-200 disabled:opacity-30"
                                disabled={disabled as boolean}
                                aria-label={`Move ${dir}`}
                              >
                                {glyph as string}
                              </button>
                            </form>
                          ),
                        )}
                        <form action={deleteStepAction}>
                          <input type="hidden" name="locationId" value={locationId} />
                          <input type="hidden" name="workflowId" value={workflow.id} />
                          <input type="hidden" name="stepId" value={s.id} />
                          <button className="h-7 w-7 rounded text-slate-400 hover:bg-red-100 hover:text-red-600" aria-label="Delete step">
                            ×
                          </button>
                        </form>
                      </div>
                    </li>
                  );
                })}
              </ol>
            )}

            <div className="mt-5 border-t border-slate-100 pt-5">
              <h3 className="mb-3 text-sm font-semibold text-slate-700">Add a step</h3>
              <AddStepForm locationId={locationId} workflowId={workflow.id} />
            </div>
          </section>
        </div>

        {/* Side column: test + history */}
        <div className="space-y-6">
          <section className="card p-5">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Test</h2>
            <p className="mb-3 mt-1 text-xs text-slate-400">Fire the actions now against a real contact.</p>
            <TestRunForm locationId={locationId} workflowId={workflow.id} contacts={contactOptions} />
          </section>

          <section className="card p-5">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Run history</h2>
            {runs.length === 0 ? (
              <p className="mt-3 text-sm text-slate-400">No runs yet.</p>
            ) : (
              <ul className="mt-3 space-y-3">
                {runs.map((r) => (
                  <li key={r.id} className="rounded-xl border border-slate-200 p-3">
                    <div className="flex items-center justify-between gap-2">
                      <Badge color={r.status === "COMPLETED" ? "green" : r.status === "FAILED" ? "red" : "amber"}>
                        {r.status.toLowerCase()}
                      </Badge>
                      <span className="text-xs text-slate-400">{formatDateTime(r.startedAt)}</span>
                    </div>
                    <p className="mt-1 text-xs text-slate-500">{r.trigger}</p>
                    <ul className="mt-2 space-y-1">
                      {r.steps.map((st) => (
                        <li key={st.id} className="flex items-start gap-2 text-xs">
                          <span className={st.status === "error" ? "text-red-500" : st.status === "skipped" ? "text-amber-500" : "text-green-600"}>
                            {st.status === "error" ? "✕" : st.status === "skipped" ? "⏱" : "✓"}
                          </span>
                          <span className="text-slate-500">
                            {ACTIONS[st.actionType as ActionKey]?.label ?? st.actionType}
                            {st.detail ? ` — ${st.detail}` : ""}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
