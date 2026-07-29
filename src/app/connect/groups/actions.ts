"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireMember } from "@/lib/connect-auth";
import { slugify } from "@/lib/utils";

export async function createGroupAction(_prev: unknown, formData: FormData) {
  const member = await requireMember();
  const name = String(formData.get("name") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim() || null;
  if (!name) return { error: "Name your group." };

  let slug = slugify(name) || "group";
  let n = 1;
  // eslint-disable-next-line no-await-in-loop
  while (await prisma.connectGroup.findUnique({ where: { slug } })) { n += 1; slug = `${slugify(name)}-${n}`; }

  const group = await prisma.connectGroup.create({
    data: { name, slug, description, ownerId: member.id, members: { create: { memberId: member.id } } },
  });
  redirect(`/connect/groups/${group.slug}`);
}

export async function joinGroupAction(formData: FormData) {
  const member = await requireMember();
  const groupId = String(formData.get("groupId") ?? "");
  const slug = String(formData.get("slug") ?? "");
  const existing = await prisma.connectGroupMember.findUnique({ where: { groupId_memberId: { groupId, memberId: member.id } } });
  if (existing) await prisma.connectGroupMember.delete({ where: { id: existing.id } });
  else await prisma.connectGroupMember.create({ data: { groupId, memberId: member.id } });
  revalidatePath(`/connect/groups/${slug}`);
}
