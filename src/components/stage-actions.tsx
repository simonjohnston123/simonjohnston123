"use client";

import { useState } from "react";
import { createStageActionAction, deleteStageActionAction } from "@/app/dashboard/l/[locationId]/pipelines/actions";

type Action = { id: string; type: string; config: Record<string, string> };

const TYPES = [
  { v: "SEND_EMAIL", label: "Send email" },
  { v: "SEND_SMS", label: "Send SMS" },
  { v: "ADD_TAG", label: "Add tag" },
  { v: "CREATE_TASK", label: "Create task" },
];

function describe(type: string, cfg: Record<string, string>): string {
  switch (type) {
    case "SEND_EMAIL":
      return `✉️ Send email${cfg.subject ? `: “${cfg.subject}”` : ""}`;
    case "SEND_SMS":
      return `💬 Send SMS${cfg.body ? `: “${cfg.body.slice(0, 28)}…”` : ""}`;
    case "ADD_TAG":
      return `🏷 Add tag “${cfg.tag || "?"}”`;
    case "CREATE_TASK":
      return `✅ Create task “${cfg.title || "Follow up"}”`;
    default:
      return type;
  }
}

export function StageActionsButton({
  locationId,
  stageId,
  stageName,
  actions,
}: {
  locationId: string;
  stageId: string;
  stageName: string;
  actions: Action[];
}) {
  const [open, setOpen] = useState(false);
  const [type, setType] = useState("SEND_EMAIL");

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        title="Automations for this stage"
        className={`grid h-6 w-6 place-items-center rounded-md text-xs hover:bg-slate-200 ${
          actions.length > 0 ? "text-amber-500" : "text-slate-400"
        }`}
      >
        ⚡{actions.length > 0 ? actions.length : ""}
      </button>

      {open ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4" onClick={() => setOpen(false)}>
          <div className="card max-h-[85vh] w-full max-w-md overflow-y-auto p-5" onClick={(e) => e.stopPropagation()}>
            <div className="mb-1 flex items-start justify-between gap-2">
              <h3 className="font-semibold text-slate-900">⚡ When a deal enters “{stageName}”</h3>
              <button type="button" onClick={() => setOpen(false)} className="text-slate-400 hover:text-slate-700">✕</button>
            </div>
            <p className="mb-3 text-xs text-slate-500">These run automatically the moment a card lands in this stage.</p>

            {actions.length === 0 ? (
              <p className="rounded-lg bg-slate-50 px-3 py-3 text-sm text-slate-400">No automations yet — add one below.</p>
            ) : (
              <div className="space-y-1.5">
                {actions.map((a) => (
                  <div key={a.id} className="flex items-center justify-between gap-2 rounded-lg border border-slate-100 px-3 py-2">
                    <span className="text-sm text-slate-700">{describe(a.type, a.config)}</span>
                    <form action={deleteStageActionAction}>
                      <input type="hidden" name="locationId" value={locationId} />
                      <input type="hidden" name="actionId" value={a.id} />
                      <button className="text-xs text-slate-400 hover:text-rose-600">Remove</button>
                    </form>
                  </div>
                ))}
              </div>
            )}

            <form action={createStageActionAction} className="mt-4 space-y-2 border-t border-slate-100 pt-4">
              <input type="hidden" name="locationId" value={locationId} />
              <input type="hidden" name="stageId" value={stageId} />
              <select name="type" value={type} onChange={(e) => setType(e.target.value)} className="input w-full text-sm">
                {TYPES.map((t) => (
                  <option key={t.v} value={t.v}>
                    {t.label}
                  </option>
                ))}
              </select>

              {type === "SEND_EMAIL" ? (
                <>
                  <input name="subject" placeholder="Email subject" className="input w-full text-sm" />
                  <textarea name="body" placeholder="Email message… (use {{first_name}})" rows={3} className="input w-full text-sm" />
                </>
              ) : null}
              {type === "SEND_SMS" ? (
                <textarea name="body" placeholder="Text message… (use {{first_name}})" rows={2} className="input w-full text-sm" />
              ) : null}
              {type === "ADD_TAG" ? <input name="tag" placeholder="Tag name, e.g. Ordered" className="input w-full text-sm" /> : null}
              {type === "CREATE_TASK" ? (
                <input name="title" placeholder="Task title, e.g. Pack {{first_name}}'s order" className="input w-full text-sm" />
              ) : null}

              <button className="btn-primary w-full text-sm">Add automation</button>
            </form>
          </div>
        </div>
      ) : null}
    </>
  );
}
