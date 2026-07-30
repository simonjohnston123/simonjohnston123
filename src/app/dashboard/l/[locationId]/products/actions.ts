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
