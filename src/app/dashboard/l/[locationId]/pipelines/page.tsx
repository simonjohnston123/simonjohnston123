import Link from "next/link";
import { requireLocationAccess } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { PageHeader, EmptyState, Badge, SegTabs } from "@/components/ui";
import { NewOpportunityButton } from "@/components/new-opportunity";
import { NewPipelineButton, StageEditor } from "@/components/pipeline-manager";
import { StageSelect } from "@/components/stage-select";
import { setOpportunityStatusAction, deleteOpportunityAction } from "./actions";
import { formatMoney, contactName } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function PipelinesPage({
  params,
  searchParams,
}: {
  params: { locationId: string };
  searchParams: { pipeline?: string };
}) {
  await requireLocationAccess(params.locationId);

  const pipelines = await prisma.pipeline.findMany({
    where: { locationId: params.locationId },
    include: { stages: { orderBy: { position: "asc" } } },
    orderBy: { createdAt: "asc" },
  });

  if (pipelines.length === 0) {
    return (
      <div>
        <PageHeader
          title="Pipelines"
          action={<NewPipelineButton locationId={params.locationId} />}
        />
        <EmptyState
          title="No pipelines yet"
          body="Create your first pipeline — describe your business and let AI draft the stages, or set them yourself."
        />
      </div>
    );
  }

  const active = pipelines.find((p) => p.id === searchParams.pipeline) ?? pipelines[0];

  const [opportunities, contacts] = await Promise.all([
    prisma.opportunity.findMany({
      where: { locationId: params.locationId, pipelineId: active.id },
      include: { contact: true },
      orderBy: { createdAt: "desc" },
    }),
    prisma.contact.findMany({
      where: { locationId: params.locationId },
      orderBy: { createdAt: "desc" },
      take: 200,
    }),
  ]);

  const contactOptions = contacts.map((c) => ({ id: c.id, label: contactName(c) }));
  const stageOptions = active.stages.map((s) => ({ id: s.id, name: s.name }));
  const base = `/dashboard/l/${params.locationId}`;

  const totalValue = opportunities
    .filter((o) => o.status === "OPEN")
    .reduce((s, o) => s + o.value, 0);

  return (
    <div>
      <PageHeader
        title="Pipelines"
        subtitle={`${active.name} · ${formatMoney(totalValue)} open`}
        action={
          <div className="flex items-center gap-2">
            <StageEditor locationId={params.locationId} pipelineId={active.id} stages={stageOptions} />
            <NewPipelineButton locationId={params.locationId} />
            <NewOpportunityButton
              locationId={params.locationId}
              pipelineId={active.id}
              stages={stageOptions}
              contacts={contactOptions}
            />
          </div>
        }
      />

      <SegTabs
        active="pipelines"
        items={[
          { key: "contacts", label: "Contacts", href: `${base}/contacts` },
          { key: "pipelines", label: "Deals", href: `${base}/pipelines` },
          { key: "tasks", label: "Tasks", href: `${base}/tasks` },
        ]}
      />

      {pipelines.length > 1 ? (
        <div className="mb-4 flex gap-2">
          {pipelines.map((p) => (
            <Link
              key={p.id}
              href={`${base}/pipelines?pipeline=${p.id}`}
              className={p.id === active.id ? "btn-primary text-xs" : "btn-secondary text-xs"}
            >
              {p.name}
            </Link>
          ))}
        </div>
      ) : null}

      {/* Stacks vertically on mobile; on desktop the stages share the page width
          evenly (min 210px each) and only scroll when there are many. */}
      <div className="flex flex-col gap-3 pb-4 lg:flex-row lg:overflow-x-auto">
        {active.stages.map((stage) => {
          const items = opportunities.filter((o) => o.stageId === stage.id);
          const stageValue = items.reduce((s, o) => s + o.value, 0);
          return (
            <div key={stage.id} className="w-full lg:w-auto lg:min-w-[210px] lg:flex-1">
              <div className="mb-2 flex items-center justify-between px-1">
                <h3 className="text-sm font-semibold text-slate-700">{stage.name}</h3>
                <span className="text-xs text-slate-400">{items.length} · {formatMoney(stageValue)}</span>
              </div>
              <div className="space-y-2 rounded-xl bg-slate-100 p-2">
                {items.length === 0 ? (
                  <p className="px-2 py-6 text-center text-xs text-slate-400">Empty</p>
                ) : (
                  items.map((o) => (
                    <div key={o.id} className="card p-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="text-sm font-medium text-slate-800">{o.title}</div>
                        {o.status !== "OPEN" ? (
                          <Badge color={o.status === "WON" ? "green" : "red"}>{o.status}</Badge>
                        ) : null}
                      </div>
                      {o.contact ? (
                        <Link href={`${base}/contacts/${o.contact.id}`} className="text-xs text-brand-600 hover:underline">
                          {contactName(o.contact)}
                        </Link>
                      ) : null}
                      <div className="mt-1 text-sm font-semibold text-slate-900">{formatMoney(o.value)}</div>

                      <div className="mt-2">
                        <StageSelect
                          locationId={params.locationId}
                          opportunityId={o.id}
                          currentStageId={o.stageId}
                          stages={stageOptions}
                        />
                      </div>

                      <div className="mt-2 flex items-center gap-1">
                        <StatusButton locationId={params.locationId} opportunityId={o.id} status="WON" label="Won" />
                        <StatusButton locationId={params.locationId} opportunityId={o.id} status="LOST" label="Lost" />
                        <form action={deleteOpportunityAction} className="ml-auto">
                          <input type="hidden" name="locationId" value={params.locationId} />
                          <input type="hidden" name="opportunityId" value={o.id} />
                          <button className="text-xs text-slate-400 hover:text-red-600" aria-label="Delete">Delete</button>
                        </form>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function StatusButton({
  locationId,
  opportunityId,
  status,
  label,
}: {
  locationId: string;
  opportunityId: string;
  status: "WON" | "LOST";
  label: string;
}) {
  return (
    <form action={setOpportunityStatusAction}>
      <input type="hidden" name="locationId" value={locationId} />
      <input type="hidden" name="opportunityId" value={opportunityId} />
      <input type="hidden" name="status" value={status} />
      <button
        className={
          status === "WON"
            ? "rounded bg-green-50 px-2 py-0.5 text-xs font-medium text-green-700 hover:bg-green-100"
            : "rounded bg-red-50 px-2 py-0.5 text-xs font-medium text-red-700 hover:bg-red-100"
        }
      >
        {label}
      </button>
    </form>
  );
}
