import "server-only";
import { prisma } from "@/lib/db";
import type { ActionType, TriggerType, Prisma } from "@prisma/client";
import { TRIGGERS } from "@/lib/automation-catalog";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

type ContactLike = {
  id: string;
  firstName: string | null;
  lastName: string | null;
  email: string | null;
  phone: string | null;
  companyName: string | null;
} | null;

/** Merge-tag rendering: {{firstName}}, {{lastName}}, {{email}}, {{phone}}, {{company}}. */
function render(template: string, contact: ContactLike): string {
  if (!template) return "";
  const map: Record<string, string> = {
    firstName: contact?.firstName ?? "there",
    lastName: contact?.lastName ?? "",
    email: contact?.email ?? "",
    phone: contact?.phone ?? "",
    company: contact?.companyName ?? "",
  };
  return template.replace(/\{\{\s*(\w+)\s*\}\}/g, (_m, k: string) => map[k] ?? "");
}

async function getOrCreateConversation(
  locationId: string,
  contactId: string,
  channel: "EMAIL" | "SMS" | "NOTE",
): Promise<string> {
  const existing = await prisma.conversation.findFirst({
    where: { locationId, contactId, channel },
    orderBy: { lastMessageAt: "desc" },
  });
  if (existing) return existing.id;
  const created = await prisma.conversation.create({
    data: { locationId, contactId, channel },
  });
  return created.id;
}

// ---------------------------------------------------------------------------
// Executor
// ---------------------------------------------------------------------------

type RunContext = {
  contactId?: string | null;
  triggerLabel?: string;
  data?: Record<string, unknown>;
};

/** Run one workflow end-to-end, logging a WorkflowRun + a step record per action. */
export async function runWorkflow(workflowId: string, ctx: RunContext): Promise<{ runId: string; status: "COMPLETED" | "FAILED" }> {
  const workflow = await prisma.workflow.findUnique({
    where: { id: workflowId },
    include: { steps: { orderBy: { position: "asc" } } },
  });
  if (!workflow) throw new Error("Workflow not found");

  const contact: ContactLike = ctx.contactId
    ? await prisma.contact.findFirst({ where: { id: ctx.contactId, locationId: workflow.locationId } })
    : null;

  const run = await prisma.workflowRun.create({
    data: {
      workflowId: workflow.id,
      locationId: workflow.locationId,
      contactId: contact?.id ?? null,
      status: "RUNNING",
      trigger: ctx.triggerLabel ?? TRIGGERS[workflow.triggerType].label,
      context: (ctx.data ?? {}) as Prisma.InputJsonValue,
    },
  });

  let failed = false;
  for (let i = 0; i < workflow.steps.length; i++) {
    const step = workflow.steps[i];
    const cfg = (step.config ?? {}) as Record<string, string>;
    let status = "ok";
    let detail = "";
    try {
      detail = await executeAction(step.actionType, cfg, {
        locationId: workflow.locationId,
        contact,
      });
      if (step.actionType === "WAIT") status = "skipped";
    } catch (err) {
      status = "error";
      detail = err instanceof Error ? err.message : "Action failed";
      failed = true;
    }
    await prisma.workflowRunStep.create({
      data: { runId: run.id, position: i, actionType: step.actionType, status, detail: detail || null },
    });
    if (failed) break;
  }

  const finalStatus = failed ? "FAILED" : "COMPLETED";
  await prisma.workflowRun.update({
    where: { id: run.id },
    data: { status: finalStatus, finishedAt: new Date() },
  });
  return { runId: run.id, status: finalStatus };
}

async function executeAction(
  actionType: ActionType,
  cfg: Record<string, string>,
  env: { locationId: string; contact: ContactLike },
): Promise<string> {
  const { locationId, contact } = env;

  switch (actionType) {
    case "ADD_TAG": {
      if (!contact) throw new Error("No contact to tag");
      const name = (cfg.tag ?? "").trim();
      if (!name) throw new Error("Tag name is empty");
      const tag = await prisma.tag.upsert({
        where: { locationId_name: { locationId, name } },
        create: { locationId, name },
        update: {},
      });
      await prisma.contactTag.upsert({
        where: { contactId_tagId: { contactId: contact.id, tagId: tag.id } },
        create: { contactId: contact.id, tagId: tag.id },
        update: {},
      });
      return `Tagged "${name}"`;
    }

    case "CREATE_TASK": {
      const title = render(cfg.title ?? "", contact).trim() || "Follow up";
      let dueAt: Date | null = null;
      const days = Number(cfg.dueInDays);
      if (!Number.isNaN(days) && days > 0) {
        dueAt = new Date(Date.now() + days * 24 * 60 * 60 * 1000);
      }
      await prisma.task.create({
        data: { locationId, contactId: contact?.id ?? null, title, dueAt },
      });
      return `Task created: "${title}"`;
    }

    case "CREATE_NOTE": {
      if (!contact) throw new Error("No contact for note");
      const body = render(cfg.body ?? "", contact).trim();
      if (!body) throw new Error("Note is empty");
      const conversationId = await getOrCreateConversation(locationId, contact.id, "NOTE");
      await prisma.message.create({
        data: { conversationId, direction: "OUTBOUND", channel: "NOTE", body },
      });
      await prisma.conversation.update({ where: { id: conversationId }, data: { lastMessageAt: new Date() } });
      return "Note added";
    }

    case "SEND_EMAIL": {
      if (!contact) throw new Error("No contact to email");
      const subject = render(cfg.subject ?? "", contact).trim();
      const body = render(cfg.body ?? "", contact).trim();
      if (!body && !subject) throw new Error("Email is empty");
      const conversationId = await getOrCreateConversation(locationId, contact.id, "EMAIL");
      await prisma.message.create({
        data: {
          conversationId,
          direction: "OUTBOUND",
          channel: "EMAIL",
          body: subject ? `Subject: ${subject}\n\n${body}` : body,
        },
      });
      await prisma.conversation.update({ where: { id: conversationId }, data: { lastMessageAt: new Date() } });
      return `Email queued to ${contact.email ?? "contact"} (logged — no provider connected yet)`;
    }

    case "SEND_SMS": {
      if (!contact) throw new Error("No contact to text");
      const body = render(cfg.body ?? "", contact).trim();
      if (!body) throw new Error("Message is empty");
      const conversationId = await getOrCreateConversation(locationId, contact.id, "SMS");
      await prisma.message.create({
        data: { conversationId, direction: "OUTBOUND", channel: "SMS", body },
      });
      await prisma.conversation.update({ where: { id: conversationId }, data: { lastMessageAt: new Date() } });
      return `SMS queued to ${contact.phone ?? "contact"} (logged — no provider connected yet)`;
    }

    case "WAIT": {
      const minutes = Number(cfg.minutes) || 0;
      return `Wait ${minutes}m (recorded — runs instantly in v1)`;
    }

    default:
      throw new Error(`Unknown action ${actionType}`);
  }
}

/**
 * Fire every ACTIVE workflow on a location whose trigger matches.
 * Call from mutation code paths (e.g. contact created). Never throws to the caller.
 */
export async function fireTrigger(
  locationId: string,
  triggerType: TriggerType,
  ctx: RunContext,
): Promise<void> {
  try {
    const workflows = await prisma.workflow.findMany({
      where: { locationId, status: "ACTIVE", triggerType },
      select: { id: true },
    });
    for (const wf of workflows) {
      try {
        await runWorkflow(wf.id, { ...ctx, triggerLabel: ctx.triggerLabel ?? TRIGGERS[triggerType].label });
      } catch {
        /* one workflow failing must not block the others or the caller */
      }
    }
  } catch {
    /* trigger dispatch must never break the originating action */
  }
}
