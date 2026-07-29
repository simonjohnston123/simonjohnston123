"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireMember } from "@/lib/connect-auth";

export async function createListingAction(_prev: unknown, formData: FormData) {
  const member = await requireMember();
  const title = String(formData.get("title") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const category = String(formData.get("category") ?? "").trim() || "Other";
  const price = Math.max(0, Math.round(Number(formData.get("price")) || 0));
  if (!title) return { error: "Give your item a title." };
  if (!description) return { error: "Add a short description." };

  const listing = await prisma.connectListing.create({
    data: {
      sellerId: member.id, title, description, category, price,
      condition: String(formData.get("condition") ?? "").trim() || null,
      location: String(formData.get("location") ?? "").trim() || null,
      imageUrl: String(formData.get("imageUrl") ?? "").trim() || null,
    },
  });
  redirect(`/connect/marketplace/${listing.id}`);
}

export async function markSoldAction(formData: FormData) {
  const member = await requireMember();
  const id = String(formData.get("id") ?? "");
  const l = await prisma.connectListing.findFirst({ where: { id, sellerId: member.id } });
  if (!l) return;
  await prisma.connectListing.update({ where: { id }, data: { status: l.status === "SOLD" ? "ACTIVE" : "SOLD" } });
  revalidatePath(`/connect/marketplace/${id}`);
}

export async function deleteListingAction(formData: FormData) {
  const member = await requireMember();
  const id = String(formData.get("id") ?? "");
  const l = await prisma.connectListing.findFirst({ where: { id, sellerId: member.id } });
  if (!l) return;
  await prisma.connectListing.delete({ where: { id } });
  redirect("/connect/marketplace");
}
