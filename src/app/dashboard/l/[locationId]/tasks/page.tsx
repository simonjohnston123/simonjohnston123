import Link from "next/link";
import { requireLocationAccess } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { PageHeader, EmptyState, Badge, SegTabs } from "@/components/ui";
import { NewTaskButton } from "@/components/new-task";
import { toggleTaskAction, deleteTaskAction } from "./actions";
import { contactName, formatDateTime } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function TasksPage({ params }: { params: { locationId: string } }) {
  const { location } = await requireLocationAccess(params.locationId);

  const [tasks, contacts, members] = await Promise.all([
    prisma.task.findMany({
      where: { locationId: params.locationId },
      include: { contact: true, assignee: true },
      orderBy: [{ completed: "asc" }, { dueAt: "asc" }, { createdAt: "desc" }],
      take: 300,
    }),
    prisma.contact.findMany({ where: { locationId: params.locationId }, orderBy: { createdAt: "desc" }, take: 200 }),
    prisma.membership.findMany({ where: { locationId: params.locationId }, include: { user: true } }),
  ]);

  const contactOptions = contacts.map((c) => ({ id: c.id, label: contactName(c) }));
  const memberOptions = members.map((m) => ({ id: m.user.id, label: m.user.name }));
  const open = tasks.filter((t) => !t.completed);
  const done = tasks.filter((t) => t.completed);
  const now = new Date();
  const base = `/dashboard/l/${params.locationId}`;

  return (
    <div>
      <PageHeader
        title="Tasks"
        subtitle={`${open.length} open`}
        action={<NewTaskButton locationId={params.locationId} contacts={contactOptions} members={memberOptions} />}
      />

      <SegTabs
        active="tasks"
        items={[
          { key: "contacts", label: "Contacts", href: `${base}/contacts` },
          { key: "pipelines", label: "Deals", href: `${base}/pipelines` },
          { key: "tasks", label: "Tasks", href: `${base}/tasks` },
        ]}
      />

      {tasks.length === 0 ? (
        <EmptyState
          title="No tasks yet"
          body="Create follow-up tasks so nothing slips through the cracks."
          action={<NewTaskButton locationId={params.locationId} contacts={contactOptions} members={memberOptions} />}
        />
      ) : (
        <div className="space-y-6">
          <TaskList
            title="Open"
            tasks={open}
            locationId={params.locationId}
            now={now}
            empty="All caught up 🎉"
          />
          {done.length > 0 ? (
            <TaskList title="Completed" tasks={done} locationId={params.locationId} now={now} empty="" />
          ) : null}
        </div>
      )}
    </div>
  );
}

function TaskList({
  title,
  tasks,
  locationId,
  now,
  empty,
}: {
  title: string;
  tasks: any[];
  locationId: string;
  now: Date;
  empty: string;
}) {
  const base = `/dashboard/l/${locationId}`;
  return (
    <section>
      <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-500">{title}</h2>
      {tasks.length === 0 ? (
        <p className="rounded-lg border border-dashed border-slate-200 p-6 text-center text-sm text-slate-400">{empty}</p>
      ) : (
        <div className="card divide-y divide-slate-100">
          {tasks.map((t) => {
            const overdue = !t.completed && t.dueAt && new Date(t.dueAt) < now;
            return (
              <div key={t.id} className="flex items-start gap-3 px-3 py-3.5">
                <form action={toggleTaskAction} className="shrink-0">
                  <input type="hidden" name="locationId" value={locationId} />
                  <input type="hidden" name="taskId" value={t.id} />
                  <input type="hidden" name="completed" value={String(t.completed)} />
                  <button
                    className={
                      "grid h-6 w-6 place-items-center rounded-lg border text-sm transition " +
                      (t.completed ? "border-green-500 bg-green-500 text-white" : "border-slate-300 hover:border-brand-500")
                    }
                    aria-label={t.completed ? "Mark incomplete" : "Mark complete"}
                  >
                    {t.completed ? "✓" : ""}
                  </button>
                </form>
                <div className="min-w-0 flex-1">
                  <div className={"text-sm font-medium " + (t.completed ? "text-slate-400 line-through" : "text-slate-800")}>
                    {t.title}
                  </div>
                  <div className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                    {t.dueAt ? (
                      <span className={overdue ? "font-medium text-red-600" : ""}>
                        {overdue ? "Overdue · " : "Due "}{formatDateTime(t.dueAt)}
                      </span>
                    ) : null}
                    {t.assignee ? <Badge color="blue">{t.assignee.name}</Badge> : null}
                    {t.contact ? (
                      <Link href={`${base}/contacts/${t.contact.id}`} className="text-brand-600 hover:underline">
                        {contactName(t.contact)}
                      </Link>
                    ) : null}
                  </div>
                  {t.notes ? <p className="mt-1 text-xs text-slate-500">{t.notes}</p> : null}
                </div>
                <form action={deleteTaskAction}>
                  <input type="hidden" name="locationId" value={locationId} />
                  <input type="hidden" name="taskId" value={t.id} />
                  <button className="text-xs text-slate-400 hover:text-red-600">Delete</button>
                </form>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
