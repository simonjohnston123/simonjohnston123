"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireSuperAdmin } from "@/lib/auth";

export async function deletePostAction(formData: FormData) {
  await requireSuperAdmin();
  const id = String(formData.get("postId") ?? "");
  await prisma.connectPost.delete({ where: { id } });
  revalidatePath("/admin/connect");
}

export async function deleteMemberAction(formData: FormData) {
  await requireSuperAdmin();
  const id = String(formData.get("memberId") ?? "");
  await prisma.connectMember.delete({ where: { id } });
  revalidatePath("/admin/connect");
}
