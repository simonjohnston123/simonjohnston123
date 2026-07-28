"use server";

import { prisma } from "@/lib/db";

/**
 * Public lead-capture from a tenant website's contact block.
 * No auth — anyone can submit; it creates a contact for that location only.
 */
export async function submitLeadAction(formData: FormData) {
  const slug = String(formData.get("slug") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim();
  const phone = String(formData.get("phone") ?? "").trim();
  const message = String(formData.get("message") ?? "").trim();

  if (!slug || (!email && !phone)) return;

  const location = await prisma.location.findUnique({ where: { slug } });
  if (!location) return;

  const [firstName, ...rest] = name.split(" ");
  await prisma.contact.create({
    data: {
      locationId: location.id,
      firstName: firstName || null,
      lastName: rest.join(" ") || null,
      email: email || null,
      phone: phone || null,
      source: "Website",
      notes: message ? `Website enquiry: ${message}` : "Website enquiry",
    },
  });
}
