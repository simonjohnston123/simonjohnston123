"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireLocationAccess } from "@/lib/auth";
import { slugify } from "@/lib/utils";

async function getSite(locationId: string) {
  return prisma.site.findUnique({ where: { locationId } });
}

export async function updateSiteAction(_prev: unknown, formData: FormData) {
  const locationId = String(formData.get("locationId") ?? "");
  await requireLocationAccess(locationId);
  const site = await getSite(locationId);
  if (!site) return { error: "Site not found." };

  await prisma.site.update({
    where: { id: site.id },
    data: {
      logoText: String(formData.get("logoText") ?? "").trim() || null,
      tagline: String(formData.get("tagline") ?? "").trim() || null,
      primaryColor: String(formData.get("primaryColor") ?? "#1d5df5").trim() || "#1d5df5",
      published: formData.get("published") === "on",
      customDomain: String(formData.get("customDomain") ?? "").trim() || null,
    },
  });
  revalidatePath(`/dashboard/l/${locationId}/website`);
  return { error: "", ok: true };
}

export async function updatePageAction(_prev: unknown, formData: FormData) {
  const locationId = String(formData.get("locationId") ?? "");
  const pageId = String(formData.get("pageId") ?? "");
  await requireLocationAccess(locationId);
  const site = await getSite(locationId);
  if (!site) return { error: "Site not found." };

  const page = await prisma.sitePage.findFirst({ where: { id: pageId, siteId: site.id } });
  if (!page) return { error: "Page not found." };

  const blocksRaw = String(formData.get("blocks") ?? "[]");
  let blocks: unknown;
  try {
    blocks = JSON.parse(blocksRaw);
    if (!Array.isArray(blocks)) throw new Error("not array");
  } catch {
    return { error: "Content blocks must be valid JSON (an array)." };
  }

  await prisma.sitePage.update({
    where: { id: pageId },
    data: {
      title: String(formData.get("title") ?? "").trim() || "Untitled",
      blocks: blocks as any,
      seoTitle: String(formData.get("seoTitle") ?? "").trim() || null,
      seoDescription: String(formData.get("seoDescription") ?? "").trim() || null,
    },
  });
  revalidatePath(`/dashboard/l/${locationId}/website`);
  return { error: "", ok: true };
}

export async function createPageAction(formData: FormData) {
  const locationId = String(formData.get("locationId") ?? "");
  const title = String(formData.get("title") ?? "").trim();
  await requireLocationAccess(locationId);
  const site = await getSite(locationId);
  if (!site || !title) return;

  let slug = slugify(title) || "page";
  // ensure unique within site
  let n = 1;
  // eslint-disable-next-line no-await-in-loop
  while (await prisma.sitePage.findFirst({ where: { siteId: site.id, slug } })) {
    n += 1;
    slug = `${slugify(title)}-${n}`;
  }

  const count = await prisma.sitePage.count({ where: { siteId: site.id } });
  await prisma.sitePage.create({
    data: {
      siteId: site.id,
      title,
      slug,
      position: count,
      blocks: [{ type: "text", heading: title, body: "Edit this page's content." }] as any,
    },
  });
  revalidatePath(`/dashboard/l/${locationId}/website`);
}

export async function deletePageAction(formData: FormData) {
  const locationId = String(formData.get("locationId") ?? "");
  const pageId = String(formData.get("pageId") ?? "");
  await requireLocationAccess(locationId);
  const page = await prisma.sitePage.findFirst({ where: { id: pageId, site: { locationId } } });
  if (!page || page.isHome) return; // never delete the home page
  await prisma.sitePage.delete({ where: { id: pageId } });
  revalidatePath(`/dashboard/l/${locationId}/website`);
}
