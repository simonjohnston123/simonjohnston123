"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireLocationAccess } from "@/lib/auth";

const oppSchema = z.object({
  title: z.string().min(1, "Enter a title."),
  value: z.coerce.number().min(0).default(0),
  pipelineId: z.string().min(1),
  stageId: z.string().min(1),
  contactId: z.string().optional(),
});

export async function createOpportunityAction(_prev: unknown, formData: FormData) {
  const locationId = String(formData.get("locationId") ?? "");
  await requireLocationAccess(locationId);

  const parsed = oppSchema.safeParse({
    title: String(formData.get("title") ?? "").trim(),
    value: String(formData.get("value") ?? "0"),
    pipelineId: String(formData.get("pipelineId") ?? ""),
    stageId: String(formData.get("stageId") ?? ""),
    contactId: String(formData.get("contactId") ?? ""),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid opportunity." };

  // Verify pipeline & stage belong to this location.
  const stage = await prisma.pipelineStage.findFirst({
    where: { id: parsed.data.stageId, pipeline: { id: parsed.data.pipelineId, locationId } },
  });
  if (!stage) return { error: "Invalid pipeline stage." };

  await prisma.opportunity.create({
    data: {
      locationId,
      pipelineId: parsed.data.pipelineId,
      stageId: parsed.data.stageId,
      contactId: parsed.data.contactId || null,
      title: parsed.data.title,
      value: parsed.data.value,
    },
  });
  revalidatePath(`/dashboard/l/${locationId}/pipelines`);
  return { error: "", ok: true };
}

export async function moveOpportunityAction(formData: FormData) {
  const locationId = String(formData.get("locationId") ?? "");
  const opportunityId = String(formData.get("opportunityId") ?? "");
  const stageId = String(formData.get("stageId") ?? "");
  await requireLocationAccess(locationId);

  const stage = await prisma.pipelineStage.findFirst({
    where: { id: stageId, pipeline: { locationId } },
  });
  if (!stage) return;

  await prisma.opportunity.update({
    where: { id: opportunityId, locationId },
    data: { stageId },
  });
  revalidatePath(`/dashboard/l/${locationId}/pipelines`);
}

export async function setOpportunityStatusAction(formData: FormData) {
  const locationId = String(formData.get("locationId") ?? "");
  const opportunityId = String(formData.get("opportunityId") ?? "");
  const status = String(formData.get("status") ?? "OPEN") as "OPEN" | "WON" | "LOST" | "ABANDONED";
  await requireLocationAccess(locationId);
  await prisma.opportunity.update({ where: { id: opportunityId, locationId }, data: { status } });
  revalidatePath(`/dashboard/l/${locationId}/pipelines`);
}

export async function deleteOpportunityAction(formData: FormData) {
  const locationId = String(formData.get("locationId") ?? "");
  const opportunityId = String(formData.get("opportunityId") ?? "");
  await requireLocationAccess(locationId);
  await prisma.opportunity.delete({ where: { id: opportunityId, locationId } });
  revalidatePath(`/dashboard/l/${locationId}/pipelines`);
}

export async function createPipelineAction(formData: FormData) {
  const locationId = String(formData.get("locationId") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  const stagesRaw = String(formData.get("stages") ?? "").trim();
  await requireLocationAccess(locationId);
  if (!name) return;

  const stageNames = stagesRaw
    ? stagesRaw.split(",").map((s) => s.trim()).filter(Boolean)
    : ["New Lead", "Contacted", "Quote Sent", "Won"];

  await prisma.pipeline.create({
    data: {
      locationId,
      name,
      stages: { create: stageNames.map((n, i) => ({ name: n, position: i })) },
    },
  });
  revalidatePath(`/dashboard/l/${locationId}/pipelines`);
}
