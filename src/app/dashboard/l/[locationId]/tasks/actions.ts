"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireLocationAccess } from "@/lib/auth";

const schema = z.object({
  title: z.string().min(1, "Enter a task."),
  contactId: z.string().optional(),
  assigneeId: z.string().optional(),
  dueAt: z.string().optional(),
  notes: z.string().optional(),
});

export async function createTaskAction(_prev: unknown, formData: FormData) {
  const locationId = String(formData.get("locationId") ?? "");
  await requireLocationAccess(locationId);

  const parsed = schema.safeParse({
    title: String(formData.get("title") ?? "").trim(),
    contactId: String(formData.get("contactId") ?? ""),
    assigneeId: String(formData.get("assigneeId") ?? ""),
    dueAt: String(formData.get("dueAt") ?? ""),
    notes: String(formData.get("notes") ?? "").trim(),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid task." };

  let dueAt: Date | null = null;
  if (parsed.data.dueAt) {
    const d = new Date(parsed.data.dueAt);
    if (!Number.isNaN(d.getTime())) dueAt = d;
  }

  await prisma.task.create({
    data: {
      locationId,
      title: parsed.data.title,
      contactId: parsed.data.contactId || null,
      assigneeId: parsed.data.assigneeId || null,
      notes: parsed.data.notes || null,
      dueAt,
    },
  });
  revalidatePath(`/dashboard/l/${locationId}/tasks`);
  return { error: "", ok: true };
}

export async function toggleTaskAction(formData: FormData) {
  const locationId = String(formData.get("locationId") ?? "");
  const taskId = String(formData.get("taskId") ?? "");
  const completed = String(formData.get("completed") ?? "") === "true";
  await requireLocationAccess(locationId);
  await prisma.task.update({
    where: { id: taskId, locationId },
    data: { completed: !completed },
  });
  revalidatePath(`/dashboard/l/${locationId}/tasks`);
}

export async function deleteTaskAction(formData: FormData) {
  const locationId = String(formData.get("locationId") ?? "");
  const taskId = String(formData.get("taskId") ?? "");
  await requireLocationAccess(locationId);
  await prisma.task.delete({ where: { id: taskId, locationId } });
  revalidatePath(`/dashboard/l/${locationId}/tasks`);
}
