import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SignJWT, jwtVerify } from "jose";
import { prisma } from "@/lib/db";

// Drivers are a separate audience from business users — their own session cookie.
const COOKIE = "placid_driver";
const MAX_AGE = 60 * 60 * 24 * 30;

function secret(): Uint8Array {
  const s = process.env.AUTH_SECRET;
  if (!s || s.length < 16) throw new Error("AUTH_SECRET is not set.");
  return new TextEncoder().encode(s);
}

export async function setDriverSession(driverId: string): Promise<void> {
  const token = await new SignJWT({ sub: driverId })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${MAX_AGE}s`)
    .sign(secret());
  cookies().set(COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: MAX_AGE,
  });
}

export function clearDriverSession(): void {
  cookies().set(COOKIE, "", { path: "/", maxAge: 0 });
}

export async function getDriver() {
  const token = cookies().get(COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret());
    const id = typeof payload.sub === "string" ? payload.sub : null;
    if (!id) return null;
    return prisma.driver.findUnique({ where: { id } });
  } catch {
    return null;
  }
}

export async function requireDriver() {
  const driver = await getDriver();
  if (!driver) redirect("/deliveries/login");
  return driver;
}
