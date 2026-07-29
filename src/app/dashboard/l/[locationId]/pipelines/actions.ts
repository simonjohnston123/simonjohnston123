"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireLocationAccess } from "@/lib/auth";
import { generatePipelineStages } from "@/lib/ai";

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

export async function createPipelineAction(_prev: unknown, formData: FormData) {
  const locationId = String(formData.get("locationId") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  const stagesRaw = String(formData.get("stages") ?? "").trim();
  await requireLocationAccess(locationId);
  if (!name) return { error: "Enter a pipeline name." };

  const stageNames = stagesRaw
    ? stagesRaw.split(/[,\n]/).map((s) => s.trim()).filter(Boolean)
    : ["New Lead", "Contacted", "Quote Sent", "Won"];

  await prisma.pipeline.create({
    data: {
      locationId,
      name,
      stages: { create: stageNames.map((n, i) => ({ name: n, position: i })) },
    },
  });
  revalidatePath(`/dashboard/l/${locationId}/pipelines`);
  return { error: "", ok: true };
}

/** Ask the AI (or heuristic) for stage names from a plain-language description. */
export async function suggestStagesAction(_prev: unknown, formData: FormData) {
  const locationId = String(formData.get("locationId") ?? "");
  const description = String(formData.get("description") ?? "").trim();
  await requireLocationAccess(locationId);
  if (!description) return { error: "Describe your business or process first.", stages: "" };
  const stages = await generatePipelineStages(description);
  return { error: "", stages: stages.join(", ") };
}

export async function addStageAction(formData: FormData) {
  const locationId = String(formData.get("locationId") ?? "");
  const pipelineId = String(formData.get("pipelineId") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  await requireLocationAccess(locationId);
  if (!name) return;

  const pipeline = await prisma.pipeline.findFirst({ where: { id: pipelineId, locationId } });
  if (!pipeline) return;
  const last = await prisma.pipelineStage.findFirst({
    where: { pipelineId },
    orderBy: { position: "desc" },
  });
  await prisma.pipelineStage.create({
    data: { pipelineId, name, position: (last?.position ?? -1) + 1 },
  });
  revalidatePath(`/dashboard/l/${locationId}/pipelines`);
}

export async function renameStageAction(formData: FormData) {
  const locationId = String(formData.get("locationId") ?? "");
  const stageId = String(formData.get("stageId") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  await requireLocationAccess(locationId);
  if (!name) return;
  const stage = await prisma.pipelineStage.findFirst({
    where: { id: stageId, pipeline: { locationId } },
  });
  if (!stage) return;
  await prisma.pipelineStage.update({ where: { id: stageId }, data: { name } });
  revalidatePath(`/dashboard/l/${locationId}/pipelines`);
}

export async function deleteStageAction(formData: FormData) {
  const locationId = String(formData.get("locationId") ?? "");
  const stageId = String(formData.get("stageId") ?? "");
  await requireLocationAccess(locationId);
  const stage = await prisma.pipelineStage.findFirst({
    where: { id: stageId, pipeline: { locationId } },
    include: { pipeline: { include: { _count: { select: { stages: true } } } } },
  });
  if (!stage) return;
  if (stage.pipeline._count.stages <= 1) return; // keep at least one stage
  // Move any opportunities in this stage to another stage in the same pipeline.
  const fallback = await prisma.pipelineStage.findFirst({
    where: { pipelineId: stage.pipelineId, id: { not: stageId } },
    orderBy: { position: "asc" },
  });
  if (fallback) {
    await prisma.opportunity.updateMany({
      where: { stageId, locationId },
      data: { stageId: fallback.id },
    });
  }
  await prisma.pipelineStage.delete({ where: { id: stageId } });
  revalidatePath(`/dashboard/l/${locationId}/pipelines`);
}

export async function deletePipelineAction(formData: FormData) {
  const locationId = String(formData.get("locationId") ?? "");
  const pipelineId = String(formData.get("pipelineId") ?? "");
  await requireLocationAccess(locationId);
  const pipeline = await prisma.pipeline.findFirst({ where: { id: pipelineId, locationId } });
  if (!pipeline) return;
  await prisma.opportunity.deleteMany({ where: { pipelineId, locationId } });
  await prisma.pipelineStage.deleteMany({ where: { pipelineId } });
  await prisma.pipeline.delete({ where: { id: pipelineId } });
  revalidatePath(`/dashboard/l/${locationId}/pipelines`);
}
