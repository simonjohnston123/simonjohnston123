"use client";

import { useFormState } from "react-dom";
import { SubmitButton } from "@/components/submit-button";
import { adminCreateBusinessAction } from "@/app/admin/actions";

export function AdminAddBusiness({ agencyId }: { agencyId: string }) {
  const [state, action] = useFormState(adminCreateBusinessAction, { error: "", ok: false } as { error: string; ok?: boolean });
  return (
    <form action={action} className="flex flex-wrap items-center gap-2">
      <input type="hidden" name="agencyId" value={agencyId} />
      <input name="name" placeholder="New business name" className="input h-9 max-w-[220px] py-1 text-sm" />
      <SubmitButton className="btn-secondary text-sm">+ Add business</SubmitButton>
      {state?.ok ? <span className="text-xs text-green-600">Added.</span> : null}
      {state?.error ? <span className="text-xs text-red-600">{state.error}</span> : null}
    </form>
  );
}
