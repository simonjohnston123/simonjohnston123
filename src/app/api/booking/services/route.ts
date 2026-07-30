import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

// Public: the bookable services (active calendars) for a business's website,
// so the booking widget can let a visitor choose which one to book.
export async function GET(req: NextRequest) {
  const slug = req.nextUrl.searchParams.get("slug") ?? "";
  if (!slug) return NextResponse.json({ services: [] });

  const location = await prisma.location.findUnique({ where: { slug } });
  if (!location) return NextResponse.json({ services: [] });

  const services = await prisma.calendar.findMany({
    where: { locationId: location.id, active: true },
    select: { id: true, name: true, price: true, durationMinutes: true, description: true, intakeFields: true },
    orderBy: { createdAt: "asc" },
  });

  return NextResponse.json({ services });
}
