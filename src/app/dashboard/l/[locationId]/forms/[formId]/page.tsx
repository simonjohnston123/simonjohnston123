import Link from "next/link";
import { notFound } from "next/navigation";
import { requireLocationAccess } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { PageHeader, Badge } from "@/components/ui";
import { FormEditor } from "@/components/form-editor";
import { regenerateFieldsAction, deleteFormAction } from "../actions";

export const dynamic = "force-dynamic";

type Field = { key: string; label: string; type: string; required?: boolean; options?: string[] };

export default async function FormEditPage({ params }: { params: { locationId: string; formId: string } }) {
  await requireLocationAccess(params.locationId);

  const form = await prisma.form.findFirst({
    where: { id: params.formId, locationId: params.locationId },
    include: { submissions: { orderBy: { createdAt: "desc" }, take: 10 }, _count: { select: { submissions: true } } },
  });
  if (!form) notFound();

  const fields = (Array.isArray(form.fields) ? form.fields : []) as Field[];
  const shareUrl = `/f/${form.id}`;

  return (
    <div className="max-w-3xl">
      <PageHeader
        title={form.name}
        subtitle={form.type === "SURVEY" ? "Survey" : "Form"}
        action={<Link href={`/dashboard/l/${params.locationId}/forms`} className="btn-ghost text-sm">← All forms</Link>}
      />

      <div className="mb-6 flex flex-wrap items-center gap-2 rounded-xl border border-brand-100 bg-brand-50 px-4 py-3 text-sm">
        <span className="text-brand-800">Share link:</span>
        <code className="font-mono text-brand-800">{shareUrl}</code>
        <Link href={shareUrl} target="_blank" className="btn-secondary ml-auto text-sm">Open ↗</Link>
        <Badge color="slate">{form._count.submissions} response{form._count.submissions === 1 ? "" : "s"}</Badge>
      </div>

      <div className="card mb-6 p-5">
        <FormEditor
          locationId={params.locationId}
          formId={form.id}
          name={form.name}
          fields={fields}
          submitLabel={form.submitLabel}
          thankYou={form.thankYou}
        />
      </div>

      <div className="card mb-6 p-5">
        <h2 className="text-sm font-semibold text-slate-800">✨ Rebuild the fields with AI</h2>
        <p className="mt-1 text-xs text-slate-500">Describe what this {form.type === "SURVEY" ? "survey" : "form"} should collect and AI will replace the fields.</p>
        <form action={regenerateFieldsAction} className="mt-3 flex flex-col gap-2 sm:flex-row">
          <input type="hidden" name="locationId" value={params.locationId} />
          <input type="hidden" name="formId" value={form.id} />
          <input name="description" defaultValue={form.description ?? ""} placeholder="e.g. Booking request: name, phone, suburb, preferred date" className="input flex-1" />
          <button className="btn-secondary text-sm">Regenerate</button>
        </form>
      </div>

      {form.submissions.length > 0 ? (
        <div className="card mb-6 p-5">
          <h2 className="mb-3 text-sm font-semibold text-slate-800">Recent responses</h2>
          <div className="space-y-3">
            {form.submissions.map((sub) => {
              const data = (sub.data && typeof sub.data === "object" ? sub.data : {}) as Record<string, unknown>;
              return (
                <div key={sub.id} className="rounded-xl border border-slate-100 p-3 text-sm">
                  <p className="mb-1 text-xs text-slate-400">{new Date(sub.createdAt).toLocaleString("en-AU")}</p>
                  {Object.entries(data).map(([k, v]) => (
                    <p key={k} className="text-slate-700"><span className="text-slate-500">{k}:</span> {String(v)}</p>
                  ))}
                </div>
              );
            })}
          </div>
        </div>
      ) : null}

      <form action={deleteFormAction}>
        <input type="hidden" name="locationId" value={params.locationId} />
        <input type="hidden" name="formId" value={form.id} />
        <button className="text-sm text-slate-400 hover:text-red-600">Delete this {form.type === "SURVEY" ? "survey" : "form"}</button>
      </form>
    </div>
  );
}
