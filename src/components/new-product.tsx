"use client";

import { useState } from "react";
import { useFormState } from "react-dom";
import { SubmitButton } from "@/components/submit-button";
import { createProductAction } from "@/app/dashboard/l/[locationId]/products/actions";

const INIT = { error: "" };

export function NewProduct({ locationId }: { locationId: string }) {
  const [state, action] = useFormState(createProductAction, INIT);
  const [useAi, setUseAi] = useState(true);

  return (
    <form action={action} className="card space-y-3 p-5">
      <input type="hidden" name="locationId" value={locationId} />
      <div className="flex flex-wrap items-center gap-2">
        <input name="name" placeholder="Product name" className="input h-10 flex-1" />
        <input name="price" placeholder="Price $" inputMode="decimal" className="input h-10 w-28" />
      </div>
      <label className="label flex items-center gap-2">
        <input type="checkbox" name="useAi" checked={useAi} onChange={(e) => setUseAi(e.target.checked)} />
        <span>✨ Write the description with AI</span>
      </label>
      {useAi ? (
        <input name="hint" placeholder="Optional details for the AI (materials, size, who it's for…)" className="input" />
      ) : null}
      {state.error ? <p className="text-sm text-red-600">{state.error}</p> : null}
      <div className="flex justify-end">
        <SubmitButton className="btn-primary">Add product</SubmitButton>
      </div>
    </form>
  );
}
