"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireLocationAccess } from "@/lib/auth";
import { generateProductDescription } from "@/lib/ai";

function priceOf(raw: string): number | null {
  const t = raw.trim();
  if (t === "") return null;
  const n = Math.round(Number(t.replace(/[^0-9.]/g, "")));
  return Number.isFinite(n) && n >= 0 ? n : null;
}

export async function createProductAction(_prev: unknown, formData: FormData) {
  const locationId = String(formData.get("locationId") ?? "");
  await requireLocationAccess(locationId);

  const name = String(formData.get("name") ?? "").trim();
  if (!name) return { error: "Give the product a name." };

  const wantAi = formData.get("useAi") != null;
  const description = wantAi
    ? await generateProductDescription(name, String(formData.get("hint") ?? "").trim() || undefined)
    : "";

  const count = await prisma.product.count({ where: { locationId } });
  const product = await prisma.product.create({
    data: { locationId, name, price: priceOf(String(formData.get("price") ?? "")), description: description || null, position: count },
  });
  redirect(`/dashboard/l/${locationId}/products/${product.id}`);
}

export async function updateProductAction(_prev: unknown, formData: FormData) {
  const locationId = String(formData.get("locationId") ?? "");
  const productId = String(formData.get("productId") ?? "");
  await requireLocationAccess(locationId);

  await prisma.product.update({
    where: { id: productId, locationId },
    data: {
      name: String(formData.get("name") ?? "").trim() || "Untitled product",
      price: priceOf(String(formData.get("price") ?? "")),
      description: String(formData.get("description") ?? "").trim() || null,
      imageUrl: String(formData.get("imageUrl") ?? "").trim() || null,
      categoryId: String(formData.get("categoryId") ?? "").trim() || null,
      active: formData.get("active") === "on",
    },
  });
  revalidatePath(`/dashboard/l/${locationId}/products/${productId}`);
  return { error: "", ok: true };
}

export async function describeProductAction(formData: FormData) {
  const locationId = String(formData.get("locationId") ?? "");
  const productId = String(formData.get("productId") ?? "");
  await requireLocationAccess(locationId);
  const product = await prisma.product.findFirst({ where: { id: productId, locationId } });
  if (!product) return;
  const description = await generateProductDescription(product.name, String(formData.get("hint") ?? "").trim() || undefined);
  await prisma.product.update({ where: { id: productId }, data: { description } });
  revalidatePath(`/dashboard/l/${locationId}/products/${productId}`);
}

export async function deleteProductAction(formData: FormData) {
  const locationId = String(formData.get("locationId") ?? "");
  const productId = String(formData.get("productId") ?? "");
  await requireLocationAccess(locationId);
  await prisma.product.delete({ where: { id: productId, locationId } });
  redirect(`/dashboard/l/${locationId}/products`);
}

/* ---------------- Categories ---------------- */

function slugify(s: string): string {
  return s.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60) || "category";
}

export async function createCategoryAction(formData: FormData) {
  const locationId = String(formData.get("locationId") ?? "");
  await requireLocationAccess(locationId);
  const name = String(formData.get("name") ?? "").trim().slice(0, 60);
  if (!name) return;
  const base = slugify(name);
  let slug = base;
  for (let i = 2; await prisma.productCategory.findFirst({ where: { locationId, slug }, select: { id: true } }); i++) {
    slug = `${base}-${i}`;
  }
  const count = await prisma.productCategory.count({ where: { locationId } });
  await prisma.productCategory.create({ data: { locationId, name, slug, position: count } });
  revalidatePath(`/dashboard/l/${locationId}/products`);
}

export async function renameCategoryAction(formData: FormData) {
  const locationId = String(formData.get("locationId") ?? "");
  const id = String(formData.get("categoryId") ?? "");
  await requireLocationAccess(locationId);
  const name = String(formData.get("name") ?? "").trim().slice(0, 60);
  if (!name) return;
  await prisma.productCategory.updateMany({ where: { id, locationId }, data: { name } });
  revalidatePath(`/dashboard/l/${locationId}/products`);
}

/** Delete a category; its products simply become uncategorised. */
export async function deleteCategoryAction(formData: FormData) {
  const locationId = String(formData.get("locationId") ?? "");
  const id = String(formData.get("categoryId") ?? "");
  await requireLocationAccess(locationId);
  await prisma.productCategory.deleteMany({ where: { id, locationId } });
  revalidatePath(`/dashboard/l/${locationId}/products`);
}

/** Assign a product to a category (empty string clears it). */
export async function setProductCategoryAction(formData: FormData) {
  const locationId = String(formData.get("locationId") ?? "");
  const productId = String(formData.get("productId") ?? "");
  const categoryId = String(formData.get("categoryId") ?? "").trim();
  await requireLocationAccess(locationId);
  await prisma.product.updateMany({
    where: { id: productId, locationId },
    data: { categoryId: categoryId || null },
  });
  revalidatePath(`/dashboard/l/${locationId}/products`);
  revalidatePath(`/dashboard/l/${locationId}/products/${productId}`);
}
