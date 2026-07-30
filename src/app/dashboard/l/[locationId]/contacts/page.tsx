import Link from "next/link";
import { requireLocationAccess } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { PageHeader, EmptyState, Badge, SegTabs } from "@/components/ui";
import { NewContactButton } from "@/components/contact-form";
import { ImportContactsButton } from "@/components/import-contacts";
import { contactName, formatDate } from "@/lib/utils";

export const dynamic = "force-dynamic";

function initials(name: string): string {
  return (
    name
      .split(" ")
      .filter(Boolean)
      .slice(0, 2)
      .map((w) => w[0]?.toUpperCase() ?? "")
      .join("") || "?"
  );
}

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
        title="Customers"
        subtitle={`${contacts.length} contact${contacts.length === 1 ? "" : "s"}`}
        action={
          <div className="flex items-center gap-2">
            <ImportContactsButton locationId={params.locationId} />
            <NewContactButton locationId={params.locationId} />
          </div>
        }
      />

      <SegTabs
        active="contacts"
        items={[
          { key: "contacts", label: "Contacts", href: `${base}/contacts` },
          { key: "pipelines", label: "Deals", href: `${base}/pipelines` },
          { key: "tasks", label: "Tasks", href: `${base}/tasks` },
        ]}
      />

      <form className="mb-4" action={`${base}/contacts`}>
        <input name="q" defaultValue={q} placeholder="Search name, email, phone or company…" className="input" />
      </form>

      {contacts.length === 0 ? (
        <EmptyState
          title={q ? "No matching contacts" : "No contacts yet"}
          body={q ? "Try a different search." : "Add your first contact to start building this business's CRM."}
          action={<NewContactButton locationId={params.locationId} />}
        />
      ) : (
        <div className="card overflow-hidden p-1.5">
          {contacts.map((c) => {
            const name = contactName(c);
            return (
              <Link key={c.id} href={`${base}/contacts/${c.id}`} className="list-row">
                <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-brand-gradient text-sm font-semibold text-white">
                  {initials(name)}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-2">
                    <span className="truncate text-sm font-semibold text-slate-800">{name}</span>
                    {c.tags[0] ? <Badge color="blue">{c.tags[0].tag.name}</Badge> : null}
                  </span>
                  <span className="mt-0.5 block truncate text-xs text-slate-500">
                    {c.email || c.phone || c.companyName || "No contact details"}
                  </span>
                </span>
                <span className="hidden shrink-0 text-xs text-slate-400 sm:block">{formatDate(c.createdAt)}</span>
                <span className="shrink-0 text-slate-300">›</span>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
