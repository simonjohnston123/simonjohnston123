import Link from "next/link";
import { requireLocationAccess } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { PageHeader, Badge } from "@/components/ui";
import { NewForm } from "@/components/new-form";

export const dynamic = "force-dynamic";

export default async function FormsPage({
  params,
  searchParams,
}: {
  params: { locationId: string };
  searchParams?: { type?: string };
}) {
  await requireLocationAccess(params.locationId);

  const forms = await prisma.form.findMany({
    where: { locationId: params.locationId },
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { submissions: true } } },
  });

  const defaultType = searchParams?.type === "survey" ? "SURVEY" : "FORM";
  const fieldCount = (f: unknown) => (Array.isArray(f) ? f.length : 0);

  return (
    <div>
      <PageHeader
        title="Forms & Surveys"
        subtitle="Create a form or survey, share its link, and submissions land in Contacts and your inbox."
        action={<Link href={`/dashboard/l/${params.locationId}/website`} className="btn-ghost text-sm">← Website</Link>}
      />

      <div className="mb-6">
        <NewForm locationId={params.locationId} defaultType={defaultType} />
      </div>

      {forms.length === 0 ? (
        <p className="rounded-xl border border-dashed border-slate-200 p-8 text-center text-sm text-slate-500">
          No forms yet. Describe what you need above and let AI draft it for you.
        </p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {forms.map((f) => (
            <div key={f.id} className="card flex flex-col p-4">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-slate-900">{f.name}</span>
                <Badge color={f.type === "SURVEY" ? "amber" : "blue"}>{f.type === "SURVEY" ? "Survey" : "Form"}</Badge>
              </div>
              <p className="mt-1 text-xs text-slate-500">
                {fieldCount(f.fields)} field{fieldCount(f.fields) === 1 ? "" : "s"} · {f._count.submissions} response{f._count.submissions === 1 ? "" : "s"}
              </p>
              <div className="mt-4 flex items-center gap-2">
                <Link href={`/dashboard/l/${params.locationId}/forms/${f.id}`} className="btn-primary flex-1 text-center text-sm">Edit</Link>
                <Link href={`/f/${f.id}`} target="_blank" className="btn-secondary text-sm">Open ↗</Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
