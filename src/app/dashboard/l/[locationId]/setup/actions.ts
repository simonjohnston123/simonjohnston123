"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireLocationAccess } from "@/lib/auth";
import { generateBusinessSetup, type BusinessSetup } from "@/lib/ai";

const WEEKDAY_9_5 = {
  "1": [["09:00", "17:00"]],
  "2": [["09:00", "17:00"]],
  "3": [["09:00", "17:00"]],
  "4": [["09:00", "17:00"]],
  "5": [["09:00", "17:00"]],
};

function slugify(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "item";
}

type GenState = { error: string; setup?: BusinessSetup };

/** Step 1 → draft the whole setup with AI. Returns it for live preview. */
export async function generateSetupAction(_prev: unknown, formData: FormData): Promise<GenState> {
  const locationId = String(formData.get("locationId") ?? "");
  await requireLocationAccess(locationId);

  const business = String(formData.get("business") ?? "").trim();
  if (!business) return { error: "Tell us what the business does." };

  const setup = await generateBusinessSetup({
    business,
    services: String(formData.get("services") ?? "").trim() || undefined,
    bookingInfo: String(formData.get("bookingInfo") ?? "").trim() || undefined,
    area: String(formData.get("area") ?? "").trim() || undefined,
  });
  return { error: "", setup };
}

type ApplyState = { error: string; ok?: boolean; summary?: string };

/** Step 2 → create the real records from the approved draft. */
export async function applySetupAction(_prev: unknown, formData: FormData): Promise<ApplyState> {
  const locationId = String(formData.get("locationId") ?? "");
  await requireLocationAccess(locationId);

  let setup: BusinessSetup;
  try {
    setup = JSON.parse(String(formData.get("setup") ?? "")) as BusinessSetup;
  } catch {
    return { error: "Couldn't read the generated setup." };
  }
  if (!setup?.services?.length) return { error: "Nothing to build — try regenerating." };

  const usedSlugs = new Set(
    (await prisma.calendar.findMany({ where: { locationId }, select: { slug: true } })).map((c) => c.slug),
  );
  const uniqueSlug = (name: string) => {
    let base = slugify(name);
    let slug = base;
    let n = 1;
    while (usedSlugs.has(slug)) slug = `${base}-${++n}`;
    usedSlugs.add(slug);
    return slug;
  };

  let services = 0;
  for (const s of setup.services) {
    await prisma.calendar.create({
      data: {
        locationId,
        name: s.name,
        slug: uniqueSlug(s.name),
        durationMinutes: s.durationMinutes,
        description: s.description || null,
        price: s.price ?? null,
        active: true,
        availability: WEEKDAY_9_5,
        intakeFields: (s.intakeFields ?? []) as object,
      },
    });
    services++;
  }

  let forms = 0;
  for (const f of setup.forms ?? []) {
    await prisma.form.create({
      data: {
        locationId,
        name: f.name,
        type: f.type === "SURVEY" ? "SURVEY" : "FORM",
        description: f.description || null,
        fields: (f.fields ?? []) as object,
      },
    });
    forms++;
  }

  if (setup.tagline) {
    await prisma.site.updateMany({ where: { locationId }, data: { tagline: setup.tagline } });
  }

  revalidatePath(`/dashboard/l/${locationId}/website`);
  revalidatePath(`/dashboard/l/${locationId}/calendar`);
  return { error: "", ok: true, summary: `Built ${services} service${services === 1 ? "" : "s"} and ${forms} form${forms === 1 ? "" : "s"}.` };
}
