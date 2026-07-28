"use client";

import { useFormState } from "react-dom";
import { updateLocationAction } from "@/app/dashboard/l/[locationId]/settings/actions";
import { SubmitButton } from "@/components/submit-button";

type Location = {
  id: string;
  name: string;
  industry: string | null;
  email: string | null;
  phone: string | null;
  website: string | null;
  timezone: string;
  addressLine: string | null;
  city: string | null;
  state: string | null;
  postalCode: string | null;
  country: string | null;
  slug: string;
};

export function LocationSettingsForm({ location }: { location: Location }) {
  const [state, formAction] = useFormState(updateLocationAction, { error: "", ok: false } as { error: string; ok?: boolean });

  return (
    <form action={formAction} className="card space-y-4 p-5">
      <input type="hidden" name="locationId" value={location.id} />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="name">Business name</label>
          <input id="name" name="name" defaultValue={location.name} className="input" required />
        </div>
        <div>
          <label className="label" htmlFor="industry">Industry</label>
          <input id="industry" name="industry" defaultValue={location.industry ?? ""} className="input" />
        </div>
        <div>
          <label className="label" htmlFor="email">Email</label>
          <input id="email" name="email" type="email" defaultValue={location.email ?? ""} className="input" />
        </div>
        <div>
          <label className="label" htmlFor="phone">Phone</label>
          <input id="phone" name="phone" defaultValue={location.phone ?? ""} className="input" />
        </div>
        <div>
          <label className="label" htmlFor="website">Website</label>
          <input id="website" name="website" defaultValue={location.website ?? ""} className="input" />
        </div>
        <div>
          <label className="label" htmlFor="timezone">Timezone</label>
          <input id="timezone" name="timezone" defaultValue={location.timezone} className="input" />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label className="label" htmlFor="addressLine">Address</label>
          <input id="addressLine" name="addressLine" defaultValue={location.addressLine ?? ""} className="input" />
        </div>
        <div>
          <label className="label" htmlFor="city">City</label>
          <input id="city" name="city" defaultValue={location.city ?? ""} className="input" />
        </div>
        <div>
          <label className="label" htmlFor="state">State</label>
          <input id="state" name="state" defaultValue={location.state ?? ""} className="input" />
        </div>
        <div>
          <label className="label" htmlFor="postalCode">Postcode</label>
          <input id="postalCode" name="postalCode" defaultValue={location.postalCode ?? ""} className="input" />
        </div>
        <div>
          <label className="label" htmlFor="country">Country</label>
          <input id="country" name="country" defaultValue={location.country ?? "Australia"} className="input" />
        </div>
      </div>

      <div className="flex items-center gap-3">
        <SubmitButton className="btn-primary">Save settings</SubmitButton>
        {state?.ok ? <span className="text-sm text-green-600">Saved.</span> : null}
        {state?.error ? <span className="text-sm text-red-600">{state.error}</span> : null}
      </div>
    </form>
  );
}
