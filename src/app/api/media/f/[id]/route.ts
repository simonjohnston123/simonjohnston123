import { NextRequest, NextResponse } from "next/server";
import { createReadStream } from "fs";
import { stat } from "fs/promises";
import { Readable } from "stream";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

// Public media streaming for social posts. IDs are unguessable cuids; the
// networks (Facebook/Instagram/YouTube) fetch these URLs server-side, and the
// composer previews them. Range support so video seeks + IG processing work.
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const asset = await prisma.mediaAsset.findUnique({ where: { id: params.id } });
  if (!asset?.path) return NextResponse.json({ error: "not found" }, { status: 404 });

  let size: number;
  try { size = (await stat(asset.path)).size; } catch { return NextResponse.json({ error: "gone" }, { status: 410 }); }

  const headers: Record<string, string> = {
    "content-type": asset.mime,
    "accept-ranges": "bytes",
    "cache-control": "public, max-age=31536000, immutable",
  };

  const range = req.headers.get("range");
  const m = range?.match(/bytes=(\d*)-(\d*)/);
  if (m && (m[1] || m[2])) {
    const start = m[1] ? parseInt(m[1], 10) : Math.max(0, size - parseInt(m[2], 10));
    const end = m[1] && m[2] ? Math.min(parseInt(m[2], 10), size - 1) : size - 1;
    if (start >= size || start > end) return new NextResponse(null, { status: 416, headers: { "content-range": `bytes */${size}` } });
    headers["content-range"] = `bytes ${start}-${end}/${size}`;
    headers["content-length"] = String(end - start + 1);
    const stream = Readable.toWeb(createReadStream(asset.path, { start, end })) as ReadableStream;
    return new NextResponse(stream, { status: 206, headers });
  }

  headers["content-length"] = String(size);
  const stream = Readable.toWeb(createReadStream(asset.path)) as ReadableStream;
  return new NextResponse(stream, { status: 200, headers });
}
