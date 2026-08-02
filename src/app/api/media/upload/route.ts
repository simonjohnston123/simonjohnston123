import { NextRequest, NextResponse } from "next/server";
import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { prisma } from "@/lib/db";
import { requireLocationAccess } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

// Media upload for the social poster: images + videos land on the uploads
// volume and get a public streaming URL the networks can fetch.
const MAX_BYTES = 80 * 1024 * 1024; // 80 MB — enough for a short-form video
const ALLOWED: Record<string, string> = {
  "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/gif": "gif",
  "video/mp4": "mp4", "video/quicktime": "mov", "video/webm": "webm",
};

export async function POST(req: NextRequest) {
  const form = await req.formData().catch(() => null);
  if (!form) return NextResponse.json({ error: "expected multipart form" }, { status: 400 });

  const locationId = String(form.get("locationId") ?? "");
  try { await requireLocationAccess(locationId); } catch { return NextResponse.json({ error: "unauthorized" }, { status: 401 }); }

  const file = form.get("file");
  if (!(file instanceof File)) return NextResponse.json({ error: "no file" }, { status: 400 });
  const ext = ALLOWED[file.type];
  if (!ext) return NextResponse.json({ error: `unsupported type ${file.type || "unknown"} — use JPG/PNG/WebP/GIF or MP4/MOV/WebM` }, { status: 415 });
  if (file.size > MAX_BYTES) return NextResponse.json({ error: "file too large (80 MB max)" }, { status: 413 });

  const kind = file.type.startsWith("video/") ? "video" : "image";
  const asset = await prisma.mediaAsset.create({
    data: { locationId, kind, filename: file.name.slice(0, 180) || `upload.${ext}`, mime: file.type, sizeBytes: file.size, path: "" },
  });

  const dir = path.join(process.env.UPLOADS_DIR || "/app/uploads", locationId);
  const filePath = path.join(dir, `${asset.id}.${ext}`);
  try {
    await mkdir(dir, { recursive: true });
    await writeFile(filePath, Buffer.from(await file.arrayBuffer()));
    await prisma.mediaAsset.update({ where: { id: asset.id }, data: { path: filePath } });
  } catch (e) {
    await prisma.mediaAsset.delete({ where: { id: asset.id } }).catch(() => {});
    return NextResponse.json({ error: "could not store file: " + String(e).slice(0, 120) }, { status: 500 });
  }

  const base = process.env.APP_URL || "https://placidcrm.com";
  return NextResponse.json({ id: asset.id, kind, url: `${base}/api/media/f/${asset.id}`, filename: asset.filename });
}
