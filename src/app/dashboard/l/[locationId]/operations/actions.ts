"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireLocationAccess } from "@/lib/auth";
import { generateTurnoverTasks } from "@/lib/homestead-ops";
import { startOfDay } from "@/lib/homestead-dates";
import type { OpsPriority, OpsTaskStatus, OpsTaskType } from "@prisma/client";

const TYPES: OpsTaskType[] = ["TURNOVER", "CHANGEOVER", "INSPECTION", "MAINTENANCE"];
const STATUSES: OpsTaskStatus[] = ["TODO", "IN_PROGRESS", "BLOCKED", "DONE"];
const PRIORITIES: OpsPriority[] = ["LOW", "NORMAL", "HIGH", "URGENT"];

function revalidate(locationId: string) {
  revalidatePath(`/dashboard/l/${locationId}/operations`);
  revalidatePath(`/dashboard/l/${locationId}/rooms`);
}

/** Build cleaning tasks from upcoming departures. Safe to run repeatedly. */
export async function generateTurnoversAction(_prev: unknown, formData: FormData) {
  const locationId = String(formData.get("locationId") ?? "");
  await requireLocationAccess(locationId);

  const result = await generateTurnoverTasks({ locationId });
  revalidate(locationId);

  const parts = [`${result.created} created`];
  if (result.alreadyExisted) parts.push(`${result.alreadyExisted} already there`);
  if (result.sameDayTurnovers) parts.push(`${result.sameDayTurnovers} same-day`);
  return { message: parts.join(" · "), error: "" };
}

export async function addOpsTaskAction(_prev: unknown, formData: FormData) {
  const locationId = String(formData.get("locationId") ?? "");
  await requireLocationAccess(locationId);

  const title = String(formData.get("title") ?? "").trim();
  if (!title) return { message: "", error: "Give the task a title." };

  const rawType = String(formData.get("type") ?? "MAINTENANCE") as OpsTaskType;
  const rawPriority = String(formData.get("priority") ?? "NORMAL") as OpsPriority;
  const roomId = String(formData.get("roomId") ?? "").trim();
  const dueAt = String(formData.get("dueAt") ?? "").trim();
  const cost = String(formData.get("cost") ?? "").trim();

  await prisma.homesteadOpsTask.create({
    data: {
      locationId,
      roomId: roomId || null,
      type: TYPES.includes(rawType) ? rawType : "MAINTENANCE",
      priority: PRIORITIES.includes(rawPriority) ? rawPriority : "NORMAL",
      title,
      notes: String(formData.get("notes") ?? "").trim() || null,
      dueAt: dueAt ? startOfDay(dueAt) : null,
      cost: cost ? Math.max(0, Math.round(Number(cost) || 0)) : null,
    },
  });

  revalidate(locationId);
  return { message: "Task added.", error: "" };
}

export async function setOpsTaskStatusAction(formData: FormData) {
  const locationId = String(formData.get("locationId") ?? "");
  await requireLocationAccess(locationId);

  const id = String(formData.get("taskId") ?? "");
  const raw = String(formData.get("status") ?? "TODO") as OpsTaskStatus;
  const status = STATUSES.includes(raw) ? raw : "TODO";

  // Only stamp completedAt on the transition into DONE, and clear it if the
  // task is reopened — otherwise a reopened task keeps a stale finish time.
  const task = await prisma.homesteadOpsTask.findFirst({
    where: { id, locationId },
    select: { status: true },
  });
  if (!task) return;

  await prisma.homesteadOpsTask.update({
    where: { id },
    data: {
      status,
      completedAt: status === "DONE" ? new Date() : null,
    },
  });

  revalidate(locationId);
}

export async function deleteOpsTaskAction(formData: FormData) {
  const locationId = String(formData.get("locationId") ?? "");
  await requireLocationAccess(locationId);
  await prisma.homesteadOpsTask.deleteMany({
    where: { id: String(formData.get("taskId") ?? ""), locationId },
  });
  revalidate(locationId);
}
