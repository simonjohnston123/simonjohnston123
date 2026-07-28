import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SignJWT, jwtVerify } from "jose";
import { prisma } from "@/lib/db";

const COOKIE_NAME = "placid_session";
const MAX_AGE_SECONDS = 60 * 60 * 24 * 30; // 30 days

function getSecret(): Uint8Array {
  const secret = process.env.AUTH_SECRET;
  if (!secret || secret.length < 16) {
    throw new Error("AUTH_SECRET is not set or is too short. Set it in your environment.");
  }
  return new TextEncoder().encode(secret);
}

export async function createSessionToken(userId: string): Promise<string> {
  return new SignJWT({ sub: userId })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${MAX_AGE_SECONDS}s`)
    .sign(getSecret());
}

export async function setSessionCookie(userId: string): Promise<void> {
  const token = await createSessionToken(userId);
  cookies().set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: MAX_AGE_SECONDS,
  });
}

export function clearSessionCookie(): void {
  cookies().set(COOKIE_NAME, "", { path: "/", maxAge: 0 });
}

export async function getSessionUserId(): Promise<string | null> {
  const token = cookies().get(COOKIE_NAME)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, getSecret());
    return typeof payload.sub === "string" ? payload.sub : null;
  } catch {
    return null;
  }
}

export type SessionUser = Awaited<ReturnType<typeof getCurrentUser>>;

export async function getCurrentUser() {
  const userId = await getSessionUserId();
  if (!userId) return null;
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      agency: true,
      memberships: {
        include: { location: true },
        orderBy: { createdAt: "asc" },
      },
    },
  });
  return user;
}

export async function requireUser() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

/**
 * Ensure the current user can access a given location (sub-account).
 * SUPER_ADMIN can access every location within their agency.
 */
export async function requireLocationAccess(locationId: string) {
  const user = await requireUser();
  const membership = user.memberships.find((m) => m.locationId === locationId);
  if (membership) return { user, location: membership.location, role: membership.role };

  if (user.globalRole === "SUPER_ADMIN") {
    const location = await prisma.location.findFirst({
      where: { id: locationId, agencyId: user.agencyId },
    });
    if (location) return { user, location, role: "ADMIN" as const };
  }
  redirect("/dashboard");
}

export const AUTH_COOKIE_NAME = COOKIE_NAME;
