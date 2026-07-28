"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireLocationAccess } from "@/lib/auth";

export async function updateLocationAction(_prev: unknown, formData: FormData) {
  const locationId = String(formData.get("locationId") ?? "");
  await requireLocationAccess(locationId);

  const name = String(formData.get("name") ?? "").trim();
  if (!name) return { error: "Business name is required." };

  await prisma.location.update({
    where: { id: locationId },
    data: {
      name,
      industry: String(formData.get("industry") ?? "").trim() || null,
      email: String(formData.get("email") ?? "").trim() || null,
      phone: String(formData.get("phone") ?? "").trim() || null,
      website: String(formData.get("website") ?? "").trim() || null,
      timezone: String(formData.get("timezone") ?? "").trim() || "Australia/Brisbane",
      addressLine: String(formData.get("addressLine") ?? "").trim() || null,
      city: String(formData.get("city") ?? "").trim() || null,
      state: String(formData.get("state") ?? "").trim() || null,
      postalCode: String(formData.get("postalCode") ?? "").trim() || null,
      country: String(formData.get("country") ?? "").trim() || "Australia",
    },
  });
  revalidatePath(`/dashboard/l/${locationId}/settings`);
  return { error: "", ok: true };
}
