import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { PublicForm, type PublicField } from "@/components/public-form";

export const dynamic = "force-dynamic";

export default async function PublicFormPage({ params }: { params: { formId: string } }) {
  const form = await prisma.form.findUnique({
    where: { id: params.formId },
    include: { location: { include: { site: true } } },
  });
  if (!form) notFound();

  const primaryColor = form.location.site?.primaryColor || "#1d5df5";
  const fields = (Array.isArray(form.fields) ? form.fields : []) as PublicField[];

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-12">
      <div className="mx-auto max-w-xl">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
          <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: primaryColor }}>
            {form.location.name}
          </p>
          <h1 className="mt-1 text-2xl font-bold text-slate-900">{form.name}</h1>
          {form.description ? <p className="mt-2 text-slate-600">{form.description}</p> : null}
          <div className="mt-6">
            <PublicForm
              formId={form.id}
              fields={fields}
              submitLabel={form.submitLabel}
              thankYou={form.thankYou}
              primaryColor={primaryColor}
            />
          </div>
        </div>
        <p className="mt-4 text-center text-xs text-slate-400">Powered by PlacidCRM</p>
      </div>
    </main>
  );
}
