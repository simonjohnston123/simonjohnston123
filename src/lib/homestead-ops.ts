import "server-only";

import { prisma } from "@/lib/db";
import { startOfDay } from "@/lib/homestead-dates";
import { OPS_TYPE_LABEL, PRIORITY_RANK, planTurnovers, taskTypeFor } from "@/lib/homestead-ops-rules";

/**
 * Homestead operations — the database half.
 *
 * Fetches the bookings, hands them to the pure rules in `homestead-ops-rules.ts`,
 * and persists the result. Keeping the judgement out of here means the priority
 * logic can be exercised against real data without a server runtime.
 */

export {
  OPS_TYPE_LABEL,
  OPS_STATUS_LABEL,
  OPS_PRIORITY_LABEL,
  PRIORITY_RANK,
} from "@/lib/homestead-ops-rules";

export type GenerateResult = {
  created: number;
  alreadyExisted: number;
  escalated: number;
  sameDayTurnovers: number;
};

/**
 * Create cleaning tasks from upcoming and just-past departures.
 *
 * Idempotent: tasks are keyed on (bookingId, type) by a unique index, so
 * running this twice never doubles up. Safe to call from a button, a cron, or
 * both.
 */
export async function generateTurnoverTasks(opts: {
  locationId: string;
  horizonDays?: number;
}): Promise<GenerateResult> {
  const bookings = await prisma.homesteadBooking.findMany({
    where: {
      locationId: opts.locationId,
      status: { in: ["PENDING", "ACTIVE", "ENDED"] },
      roomId: { not: null },
    },
    select: {
      id: true, roomId: true, guestName: true, stayType: true,
      startDate: true, endDate: true, status: true,
      room: { select: { name: true } },
    },
  });

  const planned = planTurnovers(
    bookings.map((b) => ({ ...b, roomName: b.room?.name ?? null })),
    new Date(),
    { horizonDays: opts.horizonDays }
  );

  let created = 0;
  let alreadyExisted = 0;
  let escalated = 0;

  for (const p of planned) {
    const existing = await prisma.homesteadOpsTask.findUnique({
      where: { bookingId_type: { bookingId: p.bookingId, type: p.type } },
      select: { id: true, status: true, priority: true },
    });

    if (existing) {
      alreadyExisted++;
      // Priority can escalate when a same-day arrival is booked in after the
      // task was first raised. Never downgrade, never touch finished work.
      if (
        existing.status !== "DONE" &&
        PRIORITY_RANK[p.priority] < PRIORITY_RANK[existing.priority]
      ) {
        await prisma.homesteadOpsTask.update({
          where: { id: existing.id },
          data: { priority: p.priority, title: p.title, notes: p.notes },
        });
        escalated++;
      }
      continue;
    }

    await prisma.homesteadOpsTask.create({
      data: {
        locationId: opts.locationId,
        roomId: p.roomId,
        bookingId: p.bookingId,
        type: p.type,
        priority: p.priority,
        title: p.title,
        dueAt: p.dueAt,
        notes: p.notes,
      },
    });
    created++;
  }

  return {
    created,
    alreadyExisted,
    escalated,
    sameDayTurnovers: planned.filter((p) => p.sameDay).length,
  };
}

export type RoomReadiness = {
  roomId: string;
  ready: boolean;
  urgent: boolean;
  openCount: number;
};

/**
 * Whether each room has outstanding work. Deliberately advisory — it colours
 * the board and flags risk, but it does not block bookings. A room being dirty
 * today says nothing about whether it can be let next month.
 */
export async function roomReadiness(locationId: string): Promise<Map<string, RoomReadiness>> {
  const open = await prisma.homesteadOpsTask.findMany({
    where: { locationId, status: { not: "DONE" }, roomId: { not: null } },
    select: { roomId: true, priority: true },
  });

  const map = new Map<string, RoomReadiness>();
  for (const t of open) {
    const id = t.roomId!;
    const cur = map.get(id) ?? { roomId: id, ready: true, urgent: false, openCount: 0 };
    cur.ready = false;
    cur.openCount++;
    if (t.priority === "URGENT") cur.urgent = true;
    map.set(id, cur);
  }
  return map;
}

/**
 * Raise the clean for a stay that just ended.
 *
 * Called when a booking is marked ENDED from the dashboard, so checking someone
 * out puts the room in the cleaning queue without anyone remembering to.
 */
export async function ensureTurnoverForBooking(bookingId: string): Promise<void> {
  const b = await prisma.homesteadBooking.findUnique({
    where: { id: bookingId },
    select: {
      id: true, locationId: true, roomId: true, guestName: true,
      stayType: true, endDate: true, room: { select: { name: true } },
    },
  });
  if (!b || !b.roomId) return;

  const type = taskTypeFor(b.stayType);
  const existing = await prisma.homesteadOpsTask.findUnique({
    where: { bookingId_type: { bookingId: b.id, type } },
    select: { id: true },
  });
  if (existing) return;

  await prisma.homesteadOpsTask.create({
    data: {
      locationId: b.locationId,
      roomId: b.roomId,
      bookingId: b.id,
      type,
      priority: "HIGH", // they've left; the room is out of service until it's done
      title: `${OPS_TYPE_LABEL[type]} — ${b.room?.name ?? "Room"} (after ${b.guestName})`,
      dueAt: b.endDate ? startOfDay(b.endDate) : startOfDay(new Date()),
    },
  });
}
