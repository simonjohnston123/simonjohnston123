"use client";

import { useFormState } from "react-dom";
import { updateContactAction } from "@/app/dashboard/l/[locationId]/contacts/actions";
import { SubmitButton } from "@/components/submit-button";

type Contact = {
  id: string;
  firstName: string | null;
  lastName: string | null;
  email: string | null;
  phone: string | null;
  companyName: string | null;
  source: string | null;
  notes: string | null;
};

export function ContactEditor({ locationId, contact }: { locationId: string; contact: Contact }) {
  const [state, formAction] = useFormState(updateContactAction, { error: "", ok: false } as { error: string; ok?: boolean });

  return (
    <form action={formAction} className="card space-y-4 p-5">
      <input type="hidden" name="locationId" value={locationId} />
      <input type="hidden" name="contactId" value={contact.id} />
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="label" htmlFor="firstName">First name</label>
          <input id="firstName" name="firstName" defaultValue={contact.firstName ?? ""} className="input" />
        </div>
        <div>
          <label className="label" htmlFor="lastName">Last name</label>
          <input id="lastName" name="lastName" defaultValue={contact.lastName ?? ""} className="input" />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="label" htmlFor="email">Email</label>
          <input id="email" name="email" type="email" defaultValue={contact.email ?? ""} className="input" />
        </div>
        <div>
          <label className="label" htmlFor="phone">Phone</label>
          <input id="phone" name="phone" defaultValue={contact.phone ?? ""} className="input" />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="label" htmlFor="companyName">Company</label>
          <input id="companyName" name="companyName" defaultValue={contact.companyName ?? ""} className="input" />
        </div>
        <div>
          <label className="label" htmlFor="source">Source</label>
          <input id="source" name="source" defaultValue={contact.source ?? ""} className="input" />
        </div>
      </div>
      <div>
        <label className="label" htmlFor="notes">Notes</label>
        <textarea id="notes" name="notes" rows={4} defaultValue={contact.notes ?? ""} className="input" />
      </div>
      <div className="flex items-center gap-3">
        <SubmitButton className="btn-primary">Save changes</SubmitButton>
        {state?.ok ? <span className="text-sm text-green-600">Saved.</span> : null}
        {state?.error ? <span className="text-sm text-red-600">{state.error}</span> : null}
      </div>
    </form>
  );
}
