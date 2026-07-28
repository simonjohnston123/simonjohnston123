import Link from "next/link";
import { notFound } from "next/navigation";
import { requireLocationAccess } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { ContactEditor } from "@/components/contact-editor";
import { NewTaskButton } from "@/components/new-task";
import { Badge } from "@/components/ui";
import { contactName, formatMoney, formatDateTime } from "@/lib/utils";
import { addTagAction, removeTagAction, deleteContactAction } from "../actions";
import { toggleTaskAction } from "../../tasks/actions";

export const dynamic = "force-dynamic";

export default async function ContactDetail({
  params,
}: {
  params: { locationId: string; contactId: string };
}) {
  await requireLocationAccess(params.locationId);

  const contact = await prisma.contact.findFirst({
    where: { id: params.contactId, locationId: params.locationId },
    include: {
      tags: { include: { tag: true } },
      opportunities: { include: { stage: true, pipeline: true } },
      appointments: { orderBy: { startAt: "desc" }, take: 5 },
      tasks: { orderBy: [{ completed: "asc" }, { dueAt: "asc" }] },
    },
  });
  if (!contact) notFound();

  const members = await prisma.membership.findMany({
    where: { locationId: params.locationId },
    include: { user: true },
  });
  const memberOptions = members.map((m) => ({ id: m.user.id, label: m.user.name }));

  const base = `/dashboard/l/${params.locationId}`;

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <div>
          <Link href={`${base}/contacts`} className="text-xs text-slate-400 hover:text-slate-600">← Contacts</Link>
          <h1 className="text-xl font-bold text-slate-900">{contactName(contact)}</h1>
        </div>
        <form action={deleteContactAction}>
          <input type="hidden" name="locationId" value={params.locationId} />
          <input type="hidden" name="contactId" value={contact.id} />
          <button className="btn-ghost text-sm text-red-600 hover:bg-red-50">Delete</button>
        </form>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <ContactEditor locationId={params.locationId} contact={contact} />
        </div>

        <div className="space-y-6">
          <section className="card p-5">
            <h2 className="mb-3 font-semibold text-slate-900">Tags</h2>
            <div className="mb-3 flex flex-wrap gap-2">
              {contact.tags.length === 0 ? (
                <span className="text-sm text-slate-400">No tags</span>
              ) : (
                contact.tags.map((t) => (
                  <span key={t.tagId} className="badge bg-brand-100 text-brand-700">
                    {t.tag.name}
                    <form action={removeTagAction} className="ml-1 inline">
                      <input type="hidden" name="locationId" value={params.locationId} />
                      <input type="hidden" name="contactId" value={contact.id} />
                      <input type="hidden" name="tagId" value={t.tagId} />
                      <button className="ml-1 text-brand-500 hover:text-brand-800" aria-label="Remove tag">×</button>
                    </form>
                  </span>
                ))
              )}
            </div>
            <form action={addTagAction} className="flex gap-2">
              <input type="hidden" name="locationId" value={params.locationId} />
              <input type="hidden" name="contactId" value={contact.id} />
              <input name="tag" placeholder="Add tag…" className="input" />
              <button className="btn-secondary">Add</button>
            </form>
          </section>

          <section className="card p-5">
            <h2 className="mb-3 font-semibold text-slate-900">Opportunities</h2>
            {contact.opportunities.length === 0 ? (
              <p className="text-sm text-slate-400">None yet.</p>
            ) : (
              <ul className="space-y-2">
                {contact.opportunities.map((o) => (
                  <li key={o.id} className="flex items-center justify-between text-sm">
                    <span className="text-slate-700">{o.title}</span>
                    <span className="flex items-center gap-2">
                      <Badge>{o.stage.name}</Badge>
                      <span className="text-slate-500">{formatMoney(o.value)}</span>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="card p-5">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="font-semibold text-slate-900">Tasks</h2>
              <NewTaskButton
                locationId={params.locationId}
                contacts={[{ id: contact.id, label: contactName(contact) }]}
                members={memberOptions}
                defaultContactId={contact.id}
                compact
              />
            </div>
            {contact.tasks.length === 0 ? (
              <p className="text-sm text-slate-400">No tasks yet.</p>
            ) : (
              <ul className="space-y-2">
                {contact.tasks.map((t) => (
                  <li key={t.id} className="flex items-center gap-2 text-sm">
                    <form action={toggleTaskAction}>
                      <input type="hidden" name="locationId" value={params.locationId} />
                      <input type="hidden" name="taskId" value={t.id} />
                      <input type="hidden" name="completed" value={String(t.completed)} />
                      <button
                        className={
                          "flex h-4 w-4 items-center justify-center rounded border text-[10px] " +
                          (t.completed ? "border-green-500 bg-green-500 text-white" : "border-slate-300")
                        }
                        aria-label="Toggle task"
                      >
                        {t.completed ? "✓" : ""}
                      </button>
                    </form>
                    <span className={t.completed ? "text-slate-400 line-through" : "text-slate-700"}>{t.title}</span>
                    {t.dueAt ? <span className="ml-auto text-xs text-slate-400">{formatDateTime(t.dueAt)}</span> : null}
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="card p-5">
            <h2 className="mb-3 font-semibold text-slate-900">Recent appointments</h2>
            {contact.appointments.length === 0 ? (
              <p className="text-sm text-slate-400">None yet.</p>
            ) : (
              <ul className="space-y-2">
                {contact.appointments.map((a) => (
                  <li key={a.id} className="flex items-center justify-between text-sm">
                    <span className="text-slate-700">{a.title}</span>
                    <span className="text-slate-500">{formatDateTime(a.startAt)}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
