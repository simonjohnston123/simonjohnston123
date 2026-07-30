"use client";

import Link from "next/link";
import { useFormState } from "react-dom";
import { SubmitButton } from "@/components/submit-button";
import type { BusinessSetup, FormFieldSpec } from "@/lib/ai";
import { generateSetupAction, applySetupAction } from "@/app/dashboard/l/[locationId]/setup/actions";

type FieldLike = Pick<FormFieldSpec, "key" | "label" | "required">;

const GEN_INIT = { error: "" as string, setup: undefined as BusinessSetup | undefined };
const APPLY_INIT = { error: "" as string, ok: undefined as boolean | undefined, summary: undefined as string | undefined };

function FieldChips({ fields }: { fields: FieldLike[] }) {
  if (!fields?.length) return null;
  return (
    <div className="mt-2 flex flex-wrap gap-1.5">
      {fields.map((f) => (
        <span key={f.key} className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs text-slate-600">
          {f.label}{f.required ? " *" : ""}
        </span>
      ))}
    </div>
  );
}

export function SetupWizard({ locationId }: { locationId: string }) {
  const [genState, generate] = useFormState(generateSetupAction, GEN_INIT);
  const [applyState, apply] = useFormState(applySetupAction, APPLY_INIT);

  const setup = genState.setup;

  if (applyState.ok) {
    return (
      <div className="card p-6 text-center">
        <p className="text-2xl">✅</p>
        <h2 className="mt-2 text-lg font-semibold text-slate-900">Your setup is live</h2>
        <p className="mt-1 text-sm text-slate-500">{applyState.summary}</p>
        <div className="mt-4 flex justify-center gap-2">
          <Link href={`/dashboard/l/${locationId}/calendar`} className="btn-primary text-sm">View services</Link>
          <Link href={`/dashboard/l/${locationId}/website`} className="btn-secondary text-sm">Website hub</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      {/* Questions */}
      <form action={generate} className="card space-y-4 self-start p-5">
        <input type="hidden" name="locationId" value={locationId} />
        <div>
          <label className="label">What does the business do?</label>
          <textarea name="business" rows={2} required placeholder="e.g. Mobile roadworthy inspections for cars, trailers and motorbikes." className="input" />
        </div>
        <div>
          <label className="label">What services do you offer? <span className="text-xs font-normal text-slate-400">optional</span></label>
          <textarea name="services" rows={2} placeholder="e.g. Car safety certificate $150, trailer/motorbike $140." className="input" />
        </div>
        <div>
          <label className="label">What do you need from a customer when they book? <span className="text-xs font-normal text-slate-400">optional</span></label>
          <textarea name="bookingInfo" rows={2} placeholder="e.g. Rego number, car make & model, and the address to come to." className="input" />
        </div>
        <div>
          <label className="label">Location / service area <span className="text-xs font-normal text-slate-400">optional</span></label>
          <input name="area" placeholder="e.g. Lockyer Valley, QLD" className="input" />
        </div>
        {genState.error ? <p className="text-sm text-red-600">{genState.error}</p> : null}
        <SubmitButton className="btn-primary w-full">{setup ? "↻ Regenerate" : "✨ Build it with AI"}</SubmitButton>
        <p className="text-center text-xs text-slate-400">AI drafts everything — you review before anything goes live.</p>
      </form>

      {/* Live preview */}
      <div className="space-y-4">
        {!setup ? (
          <div className="grid h-full min-h-[16rem] place-items-center rounded-2xl border border-dashed border-slate-200 p-6 text-center text-sm text-slate-400">
            Answer a couple of questions and your services, booking questions and forms appear here — ready to go live.
          </div>
        ) : (
          <>
            <div className="card p-5">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Site copy</p>
              <p className="mt-1 font-semibold text-slate-900">{setup.tagline}</p>
              {setup.about ? <p className="mt-1 text-sm text-slate-600">{setup.about}</p> : null}
            </div>

            <div className="card p-5">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Services &amp; booking questions</p>
              <div className="mt-3 space-y-4">
                {setup.services.map((s, i) => (
                  <div key={i} className="rounded-xl border border-slate-100 p-3">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-semibold text-slate-900">{s.name}</span>
                      <span className="text-sm text-slate-500">
                        {s.price != null ? `$${s.price} · ` : ""}{s.durationMinutes} min
                      </span>
                    </div>
                    {s.description ? <p className="mt-1 text-sm text-slate-600">{s.description}</p> : null}
                    {s.intakeFields?.length ? (
                      <>
                        <p className="mt-2 text-xs font-medium text-slate-500">Asks at booking:</p>
                        <FieldChips fields={s.intakeFields} />
                      </>
                    ) : null}
                  </div>
                ))}
              </div>
            </div>

            {setup.forms?.length ? (
              <div className="card p-5">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Forms</p>
                <div className="mt-3 space-y-3">
                  {setup.forms.map((f, i) => (
                    <div key={i} className="rounded-xl border border-slate-100 p-3">
                      <span className="font-semibold text-slate-900">{f.name}</span>
                      <span className="ml-2 text-xs text-slate-400">{f.type === "SURVEY" ? "Survey" : "Form"}</span>
                      <FieldChips fields={f.fields} />
                    </div>
                  ))}
                </div>
              </div>
            ) : null}

            <form action={apply} className="card flex items-center justify-between gap-3 p-4">
              <input type="hidden" name="locationId" value={locationId} />
              <input type="hidden" name="setup" value={JSON.stringify(setup)} />
              <p className="text-sm text-slate-600">Looks good? This creates the services, booking questions and forms for real.</p>
              <SubmitButton className="btn-primary shrink-0">Build it live →</SubmitButton>
            </form>
            {applyState.error ? <p className="text-sm text-red-600">{applyState.error}</p> : null}
          </>
        )}
      </div>
    </div>
  );
}
