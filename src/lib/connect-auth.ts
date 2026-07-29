import "server-only";
import crypto from "crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";

// Placid Connect uses its OWN member session (public social users), separate
// from the CRM staff session. Signed cookie (HMAC of the member id).
const COOKIE = "placid_member";

function secret(): string {
  const s = process.env.AUTH_SECRET;
  if (!s || s.length < 16) throw new Error("AUTH_SECRET is not set.");
  return s;
}
function sign(id: string): string {
  const body = Buffer.from(id).toString("base64url");
  const sig = crypto.createHmac("sha256", secret()).update(body).digest("base64url");
  return `${body}.${sig}`;
}
function verify(token: string): string | null {
  const [body, sig] = token.split(".");
  if (!body || !sig) return null;
  const expected = crypto.createHmac("sha256", secret()).update(body).digest("base64url");
  try {
    if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
  } catch {
    return null;
  }
  return Buffer.from(body, "base64url").toString("utf8");
}

export function setMemberCookie(id: string): void {
  cookies().set(COOKIE, sign(id), {
    httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production",
    path: "/", maxAge: 60 * 60 * 24 * 30,
  });
}
export function clearMemberCookie(): void {
  cookies().set(COOKIE, "", { path: "/", maxAge: 0 });
}
export function getMemberId(): string | null {
  const t = cookies().get(COOKIE)?.value;
  return t ? verify(t) : null;
}
export async function getCurrentMember() {
  const id = getMemberId();
  if (!id) return null;
  return prisma.connectMember.findUnique({ where: { id } });
}
export async function requireMember() {
  const m = await getCurrentMember();
  if (!m) redirect("/connect/login");
  return m;
}
