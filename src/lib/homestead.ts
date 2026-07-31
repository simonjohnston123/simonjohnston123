import "server-only";

import { prisma } from "@/lib/db";
import { intervalsOverlap, nightsBetween, startOfDay } from "@/lib/homestead-dates";
import type { HomesteadBookingStatus, StayType } from "@prisma/client";

/**
 * Homestead availability — the database half.
 *
 * Homestead runs mixed inventory in one room list: long-stay residents on a
 * rolling weekly agreement, and short-stay guests booked for a fixed set of
 * nights. Both compete for the same beds, so every booking — whichever type —
 * is reduced to a date interval and checked against the others.
 *
 * The interval rules themselves live in `homestead-dates.ts`, free of any
 * database import, so the same logic can run in a script or a test.
 */

// Re-exported so callers have one obvious import for Homestead logic.
export { startOfDay, addDays, nightsBetween, intervalsOverlap, statusLabel } from "@/lib/homestead-dates";

/** Statuses that actually hold a room. ENDED and CANCELLED release it. */
export const BLOCKING_STATUSES: HomesteadBookingStatus[] = ["PENDING", "ACTIVE"];

export type ConflictingBooking = {
  id: string;
  guestName: string;
  stayType: StayType;
  status: HomesteadBookingStatus;
  startDate: Date;
  endDate: Date | null;
};

/**
 * Every live booking on this room that would share a night with [start, end).
 *
 * The date filtering is deliberately left to JS rather than pushed into the
 * query: open-ended residents are stored as `endDate: null`, which no SQL
 * range predicate treats as "infinity". We narrow by room and status in the
 * database, then apply the interval rule in one place — the same function the
 * UI uses to draw the timeline — so the two can never disagree.
 */
export async function findConflicts(opts: {
  roomId: string;
  start: Date | string;
  end?: Date | string | null;
  excludeBookingId?: string;
}): Promise<ConflictingBooking[]> {
  const start = startOfDay(opts.start);
  const end = opts.end ? startOfDay(opts.end) : null;

  const candidates = await prisma.homesteadBooking.findMany({
    where: {
      roomId: opts.roomId,
      status: { in: BLOCKING_STATUSES },
      ...(opts.excludeBookingId ? { id: { not: opts.excludeBookingId } } : {}),
    },
    select: {
      id: true,
      guestName: true,
      stayType: true,
      status: true,
      startDate: true,
      endDate: true,
    },
    orderBy: { startDate: "asc" },
  });

  return candidates.filter((b) =>
    intervalsOverlap(start, end, b.startDate, b.endDate)
  );
}

export async function isRoomAvailable(opts: {
  roomId: string;
  start: Date | string;
  end?: Date | string | null;
  excludeBookingId?: string;
}): Promise<boolean> {
  const conflicts = await findConflicts(opts);
  return conflicts.length === 0;
}

export type AvailabilityCheck =
  | { ok: true; nights: number; totalPrice: number }
  | { ok: false; reason: string; conflicts: ConflictingBooking[] };

/**
 * The single gate every booking path goes through — public booking form,
 * dashboard quick-add, and any future import. Validates the room accepts this
 * stay type, that the dates make sense, and that nothing else holds the bed.
 */
export async function checkAvailability(opts: {
  roomId: string;
  stayType: StayType;
  start: Date | string;
  end?: Date | string | null;
  excludeBookingId?: string;
}): Promise<AvailabilityCheck> {
  const room = await prisma.homesteadRoom.findUnique({
    where: { id: opts.roomId },
    select: {
      active: true,
      allowsWeekly: true,
      allowsNightly: true,
      minNights: true,
      weeklyPrice: true,
      nightlyPrice: true,
    },
  });

  if (!room) return { ok: false, reason: "That room no longer exists.", conflicts: [] };
  if (!room.active) return { ok: false, reason: "That room isn't taking bookings.", conflicts: [] };

  const start = startOfDay(opts.start);
  let end = opts.end ? startOfDay(opts.end) : null;
  let nights = 0;

  if (opts.stayType === "NIGHTLY") {
    if (!room.allowsNightly) {
      return { ok: false, reason: "That room is let weekly, not by the night.", conflicts: [] };
    }
    if (!end) {
      return { ok: false, reason: "Choose a departure date.", conflicts: [] };
    }
    nights = nightsBetween(start, end);
    if (nights < 1) {
      return { ok: false, reason: "Departure must be after arrival.", conflicts: [] };
    }
    if (nights < room.minNights) {
      return {
        ok: false,
        reason: `This room has a ${room.minNights}-night minimum stay.`,
        conflicts: [],
      };
    }
  } else {
    if (!room.allowsWeekly) {
      return { ok: false, reason: "That room is let by the night, not weekly.", conflicts: [] };
    }
    // A resident's stay is open-ended unless a move-out date was given.
    end = end ?? null;
    if (end && end.getTime() <= start.getTime()) {
      return { ok: false, reason: "Move-out must be after move-in.", conflicts: [] };
    }
  }

  const conflicts = await findConflicts({
    roomId: opts.roomId,
    start,
    end,
    excludeBookingId: opts.excludeBookingId,
  });

  if (conflicts.length > 0) {
    const first = conflicts[0];
    return {
      ok: false,
      reason: `Those dates clash with an existing booking for ${first.guestName}.`,
      conflicts,
    };
  }

  const totalPrice =
    opts.stayType === "NIGHTLY" ? nights * room.nightlyPrice : room.weeklyPrice;

  return { ok: true, nights, totalPrice };
}

/** Rooms free for the whole window — powers "what can I sell tonight?". */
export async function findAvailableRooms(opts: {
  locationId: string;
  stayType: StayType;
  start: Date | string;
  end?: Date | string | null;
}) {
  const rooms = await prisma.homesteadRoom.findMany({
    where: {
      locationId: opts.locationId,
      active: true,
      ...(opts.stayType === "NIGHTLY" ? { allowsNightly: true } : { allowsWeekly: true }),
    },
    orderBy: { createdAt: "asc" },
  });

  const checked = await Promise.all(
    rooms.map(async (room) => ({
      room,
      free: await isRoomAvailable({ roomId: room.id, start: opts.start, end: opts.end }),
    }))
  );

  return checked.filter((r) => r.free).map((r) => r.room);
}
