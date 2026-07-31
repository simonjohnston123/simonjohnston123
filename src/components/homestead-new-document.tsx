"use client";

import { useState } from "react";
import { useFormState } from "react-dom";
import { SubmitButton } from "@/components/submit-button";
import { addDocumentAction } from "@/app/dashboard/l/[locationId]/documents/actions";

const EMPTY = { message: "", error: "" };

/**
 * Files a document.
 *
 * What it attaches to depends on the category: a compliance certificate covers
 * the building, a condition report covers one room, an agreement or ID belongs
 * to one stay. Showing the wrong attachment picker invites filing an insurance
 * policy against a single guest, so the form follows the category.
 */
export function NewDocument({
  locationId,
  rooms,
  stays,
  prefillTitle,
  prefillCategory,
}: {
  locationId: string;
  rooms: { id: string; name: string }[];
  stays: { id: string; label: string }[];
  prefillTitle?: string;
  prefillCategory?: string;
}) {
  const [state, action] = useFormState(addDocumentAction, EMPTY);
  const [category, setCategory] = useState(prefillCategory ?? "COMPLIANCE");

  const attachesToStay = category === "AGREEMENT" || category === "IDENTITY" || category === "BOND";
  const attachesToRoom = category === "CONDITION_REPORT";
  const expects = category !== "IDENTITY" && category !== "CONDITION_REPORT";

  return (
    <form action={action} className="card space-y-3 p-4">
      <input type="hidden" name="locationId" value={locationId} />

      <div>
        <label className="label">Document name</label>
        <input name="title" required className="input" defaultValue={prefillTitle} placeholder="Smoke alarm compliance certificate" />
      </div>

      <div>
        <label className="label">Category</label>
        <select name="category" className="input" value={category} onChange={(e) => setCategory(e.target.value)}>
          <option value="COMPLIANCE">Compliance</option>
          <option value="INSURANCE">Insurance</option>
          <option value="REGISTRATION">Registration</option>
          <option value="AGREEMENT">Agreement</option>
          <option value="IDENTITY">Identity</option>
          <option value="BOND">Bond</option>
          <option value="CONDITION_REPORT">Condition report</option>
          <option value="OTHER">Other</option>
        </select>
      </div>

      {attachesToStay ? (
        <div>
          <label className="label">Whose stay?</label>
          <select name="bookingId" className="input" defaultValue="">
            <option value="">Not tied to a stay</option>
            {stays.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
          </select>
        </div>
      ) : null}

      {attachesToRoom ? (
        <div>
          <label className="label">Which room?</label>
          <select name="roomId" className="input" defaultValue="">
            <option value="">Whole property</option>
            {rooms.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
          </select>
        </div>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2">
        <div><label className="label">Issued</label><input name="issuedAt" type="date" className="input" /></div>
        <div>
          <label className="label">Expires</label>
          <input name="expiresAt" type="date" className="input" />
          {expects ? <p className="mt-1 text-[11px] text-slate-400">Leave blank if it doesn&rsquo;t expire.</p> : null}
        </div>
      </div>

      <div><label className="label">Link</label><input name="fileUrl" className="input" placeholder="https://… (direct upload coming soon)" /></div>
      <div><label className="label">Reference</label><input name="reference" className="input" placeholder="Certificate or policy number" /></div>

      {state.error ? <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</p> : null}
      {state.message ? <p className="rounded-lg bg-green-50 px-3 py-2 text-sm text-green-700">{state.message}</p> : null}

      <SubmitButton className="btn-primary">File document</SubmitButton>
    </form>
  );
}
