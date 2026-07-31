import "server-only";
import { prisma } from "@/lib/db";
import { deliverForLocation } from "@/lib/comms-location";

// Runs a stage's automations when a deal lands in it. Fail-soft: one action
// erroring never blocks the others or the stage move.

export const STAGE_ACTION_TYPES = ["SEND_EMAIL", "SEND_SMS", "ADD_TAG", "CREATE_TASK"] as const;
export type StageActionType = (typeof STAGE_ACTION_TYPES)[number];

function fill(tpl: string, ctx: { name: string; first: string }): string {
  return (tpl || "")
    .replace(/\{\{\s*name\s*\}\}/gi, ctx.name)
    .replace(/\{\{\s*first_name\s*\}\}/gi, ctx.first);
}

export async function runStageActions(opportunityId: string, stageId: string): Promise<void> {
  const [actions, opp] = await Promise.all([
    prisma.stageAction.findMany({ where: { stageId }, orderBy: { position: "asc" } }),
    prisma.opportunity.findUnique({
      where: { id: opportunityId },
      include: { contact: true, location: { select: { name: true, email: true } } },
    }),
  ]);
  if (!opp || actions.length === 0) return;

  const contact = opp.contact;
  const name = contact
    ? [contact.firstName, contact.lastName].filter(Boolean).join(" ") || contact.email || "there"
    : "there";
  const first = contact?.firstName || name.split(" ")[0] || "there";
  const ctx = { name, first };
  const locationId = opp.locationId;

  for (const a of actions) {
    const cfg = (a.config as Record<string, string>) || {};
    try {
      if (a.type === "SEND_EMAIL" && contact) {
        await deliverForLocation(locationId, {
          channel: "EMAIL",
          contact: { email: contact.email, phone: contact.phone },
          subject: fill(cfg.subject || "", ctx),
          body: fill(cfg.body || "", ctx),
          fromName: opp.location?.name,
          replyTo: opp.location?.email,
        });
      } else if (a.type === "SEND_SMS" && contact) {
        await deliverForLocation(locationId, {
          channel: "SMS",
          contact: { email: contact.email, phone: contact.phone },
          body: fill(cfg.body || "", ctx),
        });
      } else if (a.type === "ADD_TAG" && contact && cfg.tag) {
        const tag = await prisma.tag.upsert({
          where: { locationId_name: { locationId, name: cfg.tag } },
          create: { locationId, name: cfg.tag },
          update: {},
        });
        await prisma.contactTag.upsert({
          where: { contactId_tagId: { contactId: contact.id, tagId: tag.id } },
          create: { contactId: contact.id, tagId: tag.id },
          update: {},
        });
      } else if (a.type === "CREATE_TASK") {
        await prisma.task.create({
          data: { locationId, contactId: opp.contactId, title: fill(cfg.title || "Follow up", ctx) },
        });
      }
    } catch (e) {
      console.error(`[stage-actions] ${a.type} failed:`, e instanceof Error ? e.message : e);
    }
  }
}

/** Human-readable summary of an action for the UI. */
export function describeStageAction(type: string, config: Record<string, string>): string {
  switch (type) {
    case "SEND_EMAIL":
      return `Send email${config.subject ? `: “${config.subject}”` : ""}`;
    case "SEND_SMS":
      return `Send SMS${config.body ? `: “${config.body.slice(0, 30)}…”` : ""}`;
    case "ADD_TAG":
      return `Add tag “${config.tag || "?"}”`;
    case "CREATE_TASK":
      return `Create task “${config.title || "Follow up"}”`;
    default:
      return type;
  }
}
