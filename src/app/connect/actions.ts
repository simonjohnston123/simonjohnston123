"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { hashPassword, verifyPassword } from "@/lib/password";
import { setMemberCookie, clearMemberCookie, getMemberId, requireMember } from "@/lib/connect-auth";
import { slugify } from "@/lib/utils";

async function uniqueHandle(base: string): Promise<string> {
  let h = slugify(base) || "member";
  let n = 1;
  // eslint-disable-next-line no-await-in-loop
  while (await prisma.connectMember.findUnique({ where: { handle: h } })) {
    n += 1;
    h = `${slugify(base) || "member"}${n}`;
  }
  return h;
}

export async function signupAction(_prev: unknown, formData: FormData) {
  const name = String(formData.get("name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  if (!name || !email || password.length < 6) return { error: "Enter your name, email and a password (6+ characters)." };
  if (await prisma.connectMember.findUnique({ where: { email } })) return { error: "That email is already registered — try logging in." };

  const member = await prisma.connectMember.create({
    data: { name, email, passwordHash: await hashPassword(password), handle: await uniqueHandle(name || email.split("@")[0]) },
  });
  setMemberCookie(member.id);
  redirect("/connect");
}

export async function loginAction(_prev: unknown, formData: FormData) {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  const member = await prisma.connectMember.findUnique({ where: { email } });
  if (!member || !(await verifyPassword(password, member.passwordHash))) return { error: "Wrong email or password." };
  setMemberCookie(member.id);
  redirect("/connect");
}

export async function logoutAction() {
  clearMemberCookie();
  redirect("/connect/login");
}

export async function createPostAction(formData: FormData) {
  const member = await requireMember();
  const body = String(formData.get("body") ?? "").trim();
  const bg = String(formData.get("bg") ?? "").trim() || null;
  if (!body) return;
  await prisma.connectPost.create({ data: { authorId: member.id, body, bg } });
  revalidatePath("/connect");
}

export async function toggleLikeAction(formData: FormData) {
  const memberId = getMemberId();
  if (!memberId) redirect("/connect/login");
  const postId = String(formData.get("postId") ?? "");
  const existing = await prisma.connectLike.findUnique({ where: { postId_memberId: { postId, memberId: memberId! } } });
  if (existing) await prisma.connectLike.delete({ where: { id: existing.id } });
  else await prisma.connectLike.create({ data: { postId, memberId: memberId! } });
  revalidatePath("/connect");
}

export async function commentAction(formData: FormData) {
  const member = await requireMember();
  const postId = String(formData.get("postId") ?? "");
  const body = String(formData.get("body") ?? "").trim();
  if (!body) return;
  await prisma.connectComment.create({ data: { postId, authorId: member.id, body } });
  revalidatePath("/connect");
}
