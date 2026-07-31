"use client";

import { useRef } from "react";
import { setOrderRouteAction } from "@/app/dashboard/l/[locationId]/pipelines/actions";

type StageOpt = { pipelineId: string; pipelineName: string; stageId: string; stageName: string };

/** Compact "new orders drop into…" picker. Flattens every track→stage into one
 *  select; changing it saves immediately (no extra button to hunt for). */
export function OrderRoutingSelect({
  locationId,
  options,
  currentStageId,
}: {
  locationId: string;
  options: StageOpt[];
  currentStageId: string | null;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const current = currentStageId
    ? options.find((o) => o.stageId === currentStageId)
    : undefined;

  return (
    <form
      ref={formRef}
      action={setOrderRouteAction}
      className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
    >
      <input type="hidden" name="locationId" value={locationId} />
      <span className="text-slate-500">🛒 New eBay &amp; Shopify orders drop into</span>
      <select
        name="route"
        defaultValue={current ? `${current.pipelineId}:${current.stageId}` : ""}
        onChange={() => formRef.current?.requestSubmit()}
        className="input h-8 w-auto max-w-[240px] py-0 text-sm"
      >
        <option value="">— don&rsquo;t auto-route —</option>
        {options.map((o) => (
          <option key={o.stageId} value={`${o.pipelineId}:${o.stageId}`}>
            {o.pipelineName} → {o.stageName}
          </option>
        ))}
      </select>
      {current ? (
        <span className="text-xs text-green-600">
          ✓ routing on — that stage&rsquo;s actions fire on each new order
        </span>
      ) : null}
    </form>
  );
}
