"use client";

import { useState } from "react";
import { useFormState } from "react-dom";
import { createBusinessAction } from "@/app/dashboard/actions";
import { SubmitButton } from "@/components/submit-button";

const TIMEZONES = [
  "Australia/Brisbane",
  "Australia/Sydney",
  "Australia/Melbourne",
  "Australia/Adelaide",
  "Australia/Perth",
  "Australia/Darwin",
  "Australia/Hobart",
  "Pacific/Auckland",
  "UTC",
  "Europe/London",
  "America/New_York",
  "America/Los_Angeles",
];

const AU_STATES = ["QLD", "NSW", "VIC", "SA", "WA", "TAS", "NT", "ACT"];

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <fieldset className="space-y-3">
      <legend className="text-xs font-semibold uppercase tracking-wide text-slate-500">{title}</legend>
      {children}
    </fieldset>
  );
}

export function AddBusiness() {
  const [open, setOpen] = useState(false);
  const [state, formAction] = useFormState(createBusinessAction, { error: "" } as { error: string });

  return (
    <>
      <button className="btn-primary" onClick={() => setOpen(true)}>+ Add business</button>
      {open ? (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-900/50 p-4" onClick={() => setOpen(false)}>
          <div className="card my-6 w-full max-w-2xl p-6" onClick={(e) => e.stopPropagation()}>
            <div className="mb-1 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-slate-900">Add a business</h2>
              <button className="btn-ghost" onClick={() => setOpen(false)} aria-label="Close">✕</button>
            </div>
            <p className="mb-5 text-sm text-slate-500">
              Set up a new sub-account. The more you add now, the more that pre-fills across invoices, booking pages
              and your website. You can edit any of it later in Settings.
            </p>
            <form action={formAction} className="space-y-6">
              <Section title="Business">
                <div>
                  <label className="label" htmlFor="name">Business name *</label>
                  <input id="name" name="name" required className="input" placeholder="Placid Homestead" />
                </div>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div>
                    <label className="label" htmlFor="industry">Industry / niche</label>
                    <input id="industry" name="industry" className="input" placeholder="Self storage" />
                  </div>
                  <div>
                    <label className="label" htmlFor="website">Website</label>
                    <input id="website" name="website" className="input" placeholder="https://…" />
                  </div>
                </div>
              </Section>

              <Section title="Contact">
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div>
                    <label className="label" htmlFor="email">Business email</label>
                    <input id="email" name="email" type="email" className="input" placeholder="hello@business.com" />
                  </div>
                  <div>
                    <label className="label" htmlFor="phone">Phone</label>
                    <input id="phone" name="phone" className="input" placeholder="07 1234 5678" />
                  </div>
                </div>
              </Section>

              <Section title="Address">
                <div>
                  <label className="label" htmlFor="addressLine">Street address</label>
                  <input id="addressLine" name="addressLine" className="input" placeholder="27 Toolooa Street" />
                </div>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  <div className="col-span-2 sm:col-span-1">
                    <label className="label" htmlFor="city">City / suburb</label>
                    <input id="city" name="city" className="input" placeholder="South Gladstone" />
                  </div>
                  <div>
                    <label className="label" htmlFor="state">State</label>
                    <input id="state" name="state" className="input" list="au-states" placeholder="QLD" />
                    <datalist id="au-states">
                      {AU_STATES.map((s) => (
                        <option key={s} value={s} />
                      ))}
                    </datalist>
                  </div>
                  <div>
                    <label className="label" htmlFor="postalCode">Postcode</label>
                    <input id="postalCode" name="postalCode" className="input" placeholder="4680" />
                  </div>
                  <div className="col-span-2 sm:col-span-1">
                    <label className="label" htmlFor="country">Country</label>
                    <input id="country" name="country" className="input" defaultValue="Australia" />
                  </div>
                </div>
              </Section>

              <Section title="Localisation">
                <div>
                  <label className="label" htmlFor="timezone">Timezone</label>
                  <select id="timezone" name="timezone" className="input" defaultValue="Australia/Brisbane">
                    {TIMEZONES.map((tz) => (
                      <option key={tz} value={tz}>{tz.replace("_", " ")}</option>
                    ))}
                  </select>
                </div>
              </Section>

              {state?.error ? (
                <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</p>
              ) : null}

              <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
                <button type="button" className="btn-secondary" onClick={() => setOpen(false)}>Cancel</button>
                <SubmitButton className="btn-primary">Create business →</SubmitButton>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </>
  );
}
