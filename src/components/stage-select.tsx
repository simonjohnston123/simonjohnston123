"use client";

import { moveOpportunityAction } from "@/app/dashboard/l/[locationId]/pipelines/actions";

export function StageSelect({
  locationId,
  opportunityId,
  currentStageId,
  stages,
}: {
  locationId: string;
  opportunityId: string;
  currentStageId: string;
  stages: { id: string; name: string }[];
}) {
  return (
    <form action={moveOpportunityAction}>
      <input type="hidden" name="locationId" value={locationId} />
      <input type="hidden" name="opportunityId" value={opportunityId} />
      <select
        name="stageId"
        defaultValue={currentStageId}
        onChange={(e) => e.currentTarget.form?.requestSubmit()}
        className="w-full rounded border border-slate-200 bg-white px-2 py-1 text-xs text-slate-600"
      >
        {stages.map((s) => (
          <option key={s.id} value={s.id}>
            Move to: {s.name}
          </option>
        ))}
      </select>
    </form>
  );
}
