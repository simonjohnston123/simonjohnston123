import Link from "next/link";
import { requireLocationAccess } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { PageHeader, EmptyState, Badge } from "@/components/ui";
import { NewContactButton } from "@/components/contact-form";
import { contactName, formatDate } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function ContactsPage({
  params,
  searchParams,
}: {
  params: { locationId: string };
  searchParams: { q?: string };
}) {
  await requireLocationAccess(params.locationId);
  const q = (searchParams.q ?? "").trim();

  const contacts = await prisma.contact.findMany({
    where: {
      locationId: params.locationId,
      ...(q
        ? {
            OR: [
              { firstName: { contains: q, mode: "insensitive" } },
              { lastName: { contains: q, mode: "insensitive" } },
              { email: { contains: q, mode: "insensitive" } },
              { phone: { contains: q, mode: "insensitive" } },
              { companyName: { contains: q, mode: "insensitive" } },
            ],
          }
        : {}),
    },
    orderBy: { createdAt: "desc" },
    include: { tags: { include: { tag: true } } },
    take: 200,
  });

  const base = `/dashboard/l/${params.locationId}`;

  return (
    <div>
      <PageHeader
        title="Contacts"
        subtitle={`${contacts.length} contact${contacts.length === 1 ? "" : "s"}`}
        action={<NewContactButton locationId={params.locationId} />}
      />

      <form className="mb-4" action={`${base}/contacts`}>
        <input
          name="q"
          defaultValue={q}
          placeholder="Search by name, email, phone or company…"
          className="input max-w-md"
        />
      </form>

      {contacts.length === 0 ? (
        <EmptyState
          title={q ? "No matching contacts" : "No contacts yet"}
          body={q ? "Try a different search." : "Add your first contact to start building this business's CRM."}
          action={<NewContactButton locationId={params.locationId} />}
        />
      ) : (
        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Email</th>
                <th className="px-4 py-3">Phone</th>
                <th className="hidden px-4 py-3 sm:table-cell">Tags</th>
                <th className="hidden px-4 py-3 lg:table-cell">Added</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {contacts.map((c) => (
                <tr key={c.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3">
                    <Link href={`${base}/contacts/${c.id}`} className="font-medium text-slate-800 hover:text-brand-700">
                      {contactName(c)}
                    </Link>
                    {c.companyName ? <div className="text-xs text-slate-400">{c.companyName}</div> : null}
                  </td>
                  <td className="px-4 py-3 text-slate-600">{c.email || "—"}</td>
                  <td className="px-4 py-3 text-slate-600">{c.phone || "—"}</td>
                  <td className="hidden px-4 py-3 sm:table-cell">
                    <div className="flex flex-wrap gap-1">
                      {c.tags.slice(0, 3).map((t) => (
                        <Badge key={t.tagId} color="blue">{t.tag.name}</Badge>
                      ))}
                    </div>
                  </td>
                  <td className="hidden px-4 py-3 text-slate-500 lg:table-cell">{formatDate(c.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
