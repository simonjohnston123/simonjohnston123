import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getAvailableSlots } from "@/lib/booking";

export const dynamic = "force-dynamic";

// Public: available booking slots for a calendar on a business's website.
export async function GET(req: NextRequest) {
  const slug = req.nextUrl.searchParams.get("slug") ?? "";
  const calendarId = req.nextUrl.searchParams.get("calendarId") ?? "";
  if (!slug || !calendarId) return NextResponse.json({ slots: [] });

  const location = await prisma.location.findUnique({ where: { slug } });
  if (!location) return NextResponse.json({ slots: [] });

  const calendar = await prisma.calendar.findFirst({ where: { id: calendarId, locationId: location.id } });
  if (!calendar) return NextResponse.json({ slots: [] });

  const appointments = await prisma.appointment.findMany({
    where: { calendarId: calendar.id, status: "CONFIRMED", endAt: { gte: new Date() } },
    select: { startAt: true, endAt: true },
  });

  const slots = getAvailableSlots(
    { durationMinutes: calendar.durationMinutes, availability: calendar.availability, bookingWindowDays: calendar.bookingWindowDays },
    appointments,
    location.timezone || "Australia/Brisbane",
    new Date(),
  );

  return NextResponse.json({ slots });
}
