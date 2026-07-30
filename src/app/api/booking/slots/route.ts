import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getAvailableSlots } from "@/lib/booking";
import { syncBusy, externalBusyForCalendar } from "@/lib/google-calendar";

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

  const now = new Date();
  const windowEnd = new Date(now.getTime() + Math.min(Math.max(calendar.bookingWindowDays || 14, 1), 60) * 86400000);

  const appointments = await prisma.appointment.findMany({
    where: { calendarId: calendar.id, status: "CONFIRMED", endAt: { gte: now } },
    select: { startAt: true, endAt: true },
  });

  // Refresh the operator's Google Calendar busy blocks (throttled, fail-soft),
  // then fold them into the clash set so we never offer a time they're booked.
  await syncBusy(location.id);
  const externalBusy = await externalBusyForCalendar(location.id, now, windowEnd);

  const slots = getAvailableSlots(
    { durationMinutes: calendar.durationMinutes, availability: calendar.availability, bookingWindowDays: calendar.bookingWindowDays },
    [...appointments, ...externalBusy],
    location.timezone || "Australia/Brisbane",
    now,
  );

  return NextResponse.json({ slots });
}
