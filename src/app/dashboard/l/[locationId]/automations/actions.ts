"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireLocationAccess } from "@/lib/auth";
import { runWorkflow } from "@/lib/automations";
import { ACTIONS, TRIGGERS, type ActionKey, type TriggerKey } from "@/lib/automation-catalog";
import type { ActionType, TriggerType } from "@prisma/client";

function path(locationId: string, extra = "") {
  return `/dashboard/l/${locationId}/automations${extra}`;
}

export async function createWorkflowAction(_prev: unknown, formData: FormData) {
  const locationId = String(formData.get("locationId") ?? "");
  await requireLocationAccess(locationId);

  const name = String(formData.get("name") ?? "").trim();
  const triggerType = String(formData.get("triggerType") ?? "MANUAL") as TriggerKey;
  if (!name) return { error: "Give the automation a name." };
  if (!TRIGGERS[triggerType]) return { error: "Pick a valid trigger." };

  const wf = await prisma.workflow.create({
    data: { locationId, name, triggerType: triggerType as TriggerType, status: "DRAFT" },
  });
  revalidatePath(path(locationId));
  redirect(path(locationId, `/${wf.id}`));
}

export async function updateTriggerAction(formData: FormData) {
  const locationId = String(formData.get("locationId") ?? "");
  const workflowId = String(formData.get("workflowId") ?? "");
  const triggerType = String(formData.get("triggerType") ?? "MANUAL") as TriggerKey;
  await requireLocationAccess(locationId);
  if (!TRIGGERS[triggerType]) return;

  const tag = String(formData.get("triggerTag") ?? "").trim();
  await prisma.workflow.update({
    where: { id: workflowId, locationId },
    data: {
      triggerType: triggerType as TriggerType,
      triggerConfig: triggerType === "TAG_ADDED" && tag ? { tag } : {},
    },
  });
  revalidatePath(path(locationId, `/${workflowId}`));
}

export async function setStatusAction(formData: FormData) {
  const locationId = String(formData.get("locationId") ?? "");
  const workflowId = String(formData.get("workflowId") ?? "");
  const status = String(formData.get("status") ?? "DRAFT");
  await requireLocationAccess(locationId);
  if (!["DRAFT", "ACTIVE", "PAUSED"].includes(status)) return;

  // Don't let an empty workflow go live.
  if (status === "ACTIVE") {
    const count = await prisma.workflowStep.count({ where: { workflowId } });
    if (count === 0) return;
  }
  await prisma.workflow.update({
    where: { id: workflowId, locationId },
    data: { status: status as "DRAFT" | "ACTIVE" | "PAUSED" },
  });
  revalidatePath(path(locationId, `/${workflowId}`));
  revalidatePath(path(locationId));
}

export async function addStepAction(_prev: unknown, formData: FormData) {
  const locationId = String(formData.get("locationId") ?? "");
  const workflowId = String(formData.get("workflowId") ?? "");
  const actionType = String(formData.get("actionType") ?? "") as ActionKey;
  await requireLocationAccess(locationId);
  const def = ACTIONS[actionType];
  if (!def) return { error: "Pick an action." };

  // Pull just this action's configured fields from the form.
  const config: Record<string, string> = {};
  for (const field of def.fields) {
    const v = String(formData.get(field.key) ?? "").trim();
    if (v) config[field.key] = v;
  }

  const last = await prisma.workflowStep.findFirst({
    where: { workflowId },
    orderBy: { position: "desc" },
  });
  await prisma.workflowStep.create({
    data: {
      workflowId,
      position: (last?.position ?? -1) + 1,
      actionType: actionType as ActionType,
      config,
    },
  });
  revalidatePath(path(locationId, `/${workflowId}`));
  return { error: "", ok: true };
}

export async function deleteStepAction(formData: FormData) {
  const locationId = String(formData.get("locationId") ?? "");
  const workflowId = String(formData.get("workflowId") ?? "");
  const stepId = String(formData.get("stepId") ?? "");
  await requireLocationAccess(locationId);

  await prisma.workflowStep.delete({ where: { id: stepId } });
  // Re-pack positions so ordering stays contiguous.
  const remaining = await prisma.workflowStep.findMany({
    where: { workflowId },
    orderBy: { position: "asc" },
  });
  await Promise.all(
    remaining.map((s, i) =>
      s.position === i ? null : prisma.workflowStep.update({ where: { id: s.id }, data: { position: i } }),
    ),
  );
  revalidatePath(path(locationId, `/${workflowId}`));
}

export async function moveStepAction(formData: FormData) {
  const locationId = String(formData.get("locationId") ?? "");
  const workflowId = String(formData.get("workflowId") ?? "");
  const stepId = String(formData.get("stepId") ?? "");
  const dir = String(formData.get("dir") ?? "");
  await requireLocationAccess(locationId);

  const steps = await prisma.workflowStep.findMany({
    where: { workflowId },
    orderBy: { position: "asc" },
  });
  const idx = steps.findIndex((s) => s.id === stepId);
  if (idx === -1) return;
  const swapWith = dir === "up" ? idx - 1 : idx + 1;
  if (swapWith < 0 || swapWith >= steps.length) return;

  const a = steps[idx];
  const b = steps[swapWith];
  await prisma.$transaction([
    prisma.workflowStep.update({ where: { id: a.id }, data: { position: b.position } }),
    prisma.workflowStep.update({ where: { id: b.id }, data: { position: a.position } }),
  ]);
  revalidatePath(path(locationId, `/${workflowId}`));
}

export async function deleteWorkflowAction(formData: FormData) {
  const locationId = String(formData.get("locationId") ?? "");
  const workflowId = String(formData.get("workflowId") ?? "");
  await requireLocationAccess(locationId);
  await prisma.workflow.delete({ where: { id: workflowId, locationId } });
  revalidatePath(path(locationId));
  redirect(path(locationId));
}

export async function testRunAction(_prev: unknown, formData: FormData) {
  const locationId = String(formData.get("locationId") ?? "");
  const workflowId = String(formData.get("workflowId") ?? "");
  const contactId = String(formData.get("contactId") ?? "").trim();
  await requireLocationAccess(locationId);

  const steps = await prisma.workflowStep.count({ where: { workflowId } });
  if (steps === 0) return { error: "Add at least one action before testing." };

  const result = await runWorkflow(workflowId, {
    contactId: contactId || null,
    triggerLabel: "Manual test",
  });
  revalidatePath(path(locationId, `/${workflowId}`));
  return {
    error: "",
    ok: true,
    message: result.status === "COMPLETED" ? "Test run completed ✓" : "Test run failed — see history below.",
  };
}
