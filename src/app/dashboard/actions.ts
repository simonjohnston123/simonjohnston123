"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { createBusiness } from "@/lib/provision";

const schema = z.object({
  name: z.string().min(2, "Enter a business name."),
  industry: z.string().optional(),
  email: z.string().email().optional().or(z.literal("")),
  phone: z.string().optional(),
});

export async function createBusinessAction(_prev: unknown, formData: FormData) {
  const user = await requireUser();

  const parsed = schema.safeParse({
    name: String(formData.get("name") ?? "").trim(),
    industry: String(formData.get("industry") ?? "").trim(),
    email: String(formData.get("email") ?? "").trim(),
    phone: String(formData.get("phone") ?? "").trim(),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid details." };
  }

  const location = await createBusiness({
    agencyId: user.agencyId,
    ownerUserId: user.id,
    name: parsed.data.name,
    industry: parsed.data.industry,
    email: parsed.data.email || null,
    phone: parsed.data.phone,
  });

  revalidatePath("/dashboard");
  redirect(`/dashboard/l/${location.id}`);
}
