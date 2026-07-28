"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { createBusiness } from "@/lib/provision";

const schema = z.object({
  name: z.string().min(2, "Enter a business name."),
  industry: z.string().optional(),
  email: z.string().email("Enter a valid email.").optional().or(z.literal("")),
  phone: z.string().optional(),
  website: z.string().optional(),
  addressLine: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  postalCode: z.string().optional(),
  country: z.string().optional(),
  timezone: z.string().optional(),
});

function field(formData: FormData, key: string): string {
  return String(formData.get(key) ?? "").trim();
}

export async function createBusinessAction(_prev: unknown, formData: FormData) {
  const user = await requireUser();

  const parsed = schema.safeParse({
    name: field(formData, "name"),
    industry: field(formData, "industry"),
    email: field(formData, "email"),
    phone: field(formData, "phone"),
    website: field(formData, "website"),
    addressLine: field(formData, "addressLine"),
    city: field(formData, "city"),
    state: field(formData, "state"),
    postalCode: field(formData, "postalCode"),
    country: field(formData, "country"),
    timezone: field(formData, "timezone"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid details." };
  }
  const d = parsed.data;

  const location = await createBusiness({
    agencyId: user.agencyId,
    ownerUserId: user.id,
    name: d.name,
    industry: d.industry,
    email: d.email || null,
    phone: d.phone,
    website: d.website || null,
    addressLine: d.addressLine || null,
    city: d.city || null,
    state: d.state || null,
    postalCode: d.postalCode || null,
    country: d.country || null,
    timezone: d.timezone || null,
  });

  revalidatePath("/dashboard");
  redirect(`/dashboard/l/${location.id}`);
}
