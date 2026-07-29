import "server-only";

// Availability-based booking slot engine. Works in the business's timezone so
// "9am–5pm Mon–Fri" means 9am local, and excludes times that clash with
// existing appointments.

export type Windows = Record<string, [string, string][]>;

const DEFAULT_WINDOWS: Windows = {
  "1": [["09:00", "17:00"]],
  "2": [["09:00", "17:00"]],
  "3": [["09:00", "17:00"]],
  "4": [["09:00", "17:00"]],
  "5": [["09:00", "17:00"]],
};

/** Offset (ms) to add to a UTC guess so its wall-clock reads correctly in tz. */
function offsetMs(tz: string, date: Date): number {
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  const p = Object.fromEntries(dtf.formatToParts(date).map((x) => [x.type, x.value]));
  const h = p.hour === "24" ? 0 : Number(p.hour);
  const asUTC = Date.UTC(Number(p.year), Number(p.month) - 1, Number(p.day), h, Number(p.minute), Number(p.second));
  return asUTC - date.getTime();
}

/** A wall-clock time (in tz) → the real UTC instant. */
function wallToUtc(y: number, m: number, d: number, hh: number, mm: number, tz: string): Date {
  const guess = Date.UTC(y, m - 1, d, hh, mm, 0);
  return new Date(guess - offsetMs(tz, new Date(guess)));
}

function localYMD(tz: string, date: Date): { y: number; m: number; d: number } {
  const dtf = new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" });
  const p = Object.fromEntries(dtf.formatToParts(date).map((x) => [x.type, x.value]));
  return { y: Number(p.year), m: Number(p.month), d: Number(p.day) };
}

export type DaySlots = { date: string; label: string; items: { iso: string; label: string }[] };

export function getAvailableSlots(
  calendar: { durationMinutes: number; availability: unknown; bookingWindowDays: number },
  appointments: { startAt: Date; endAt: Date }[],
  tz: string,
  now: Date,
): DaySlots[] {
  const windows: Windows =
    calendar.availability && typeof calendar.availability === "object" && Object.keys(calendar.availability as object).length
      ? (calendar.availability as Windows)
      : DEFAULT_WINDOWS;

  const duration = calendar.durationMinutes || 30;
  const days = Math.min(Math.max(calendar.bookingWindowDays || 14, 1), 60);
  const today = localYMD(tz, now);
  const base = Date.UTC(today.y, today.m - 1, today.d, 12); // noon anchor avoids DST edges
  const minLead = now.getTime() + 60 * 60 * 1000; // 1h notice

  const dateLabel = new Intl.DateTimeFormat("en-AU", { timeZone: tz, weekday: "short", day: "numeric", month: "short" });
  const timeLabel = new Intl.DateTimeFormat("en-AU", { timeZone: tz, hour: "numeric", minute: "2-digit", hour12: true });

  const out: DaySlots[] = [];

  for (let i = 0; i < days; i++) {
    const dayDate = new Date(base + i * 86400000);
    const y = dayDate.getUTCFullYear();
    const m = dayDate.getUTCMonth() + 1;
    const d = dayDate.getUTCDate();
    const weekday = String(dayDate.getUTCDay());
    const wins = windows[weekday] ?? [];
    if (!wins.length) continue;

    const items: { iso: string; label: string }[] = [];
    for (const [start, end] of wins) {
      const [sh, sm] = start.split(":").map(Number);
      const [eh, em] = end.split(":").map(Number);
      const winStart = sh * 60 + sm;
      const winEnd = eh * 60 + em;
      for (let t = winStart; t + duration <= winEnd; t += duration) {
        const slot = wallToUtc(y, m, d, Math.floor(t / 60), t % 60, tz);
        const slotEnd = new Date(slot.getTime() + duration * 60000);
        if (slot.getTime() < minLead) continue;
        const clash = appointments.some((a) => slot < a.endAt && slotEnd > a.startAt);
        if (clash) continue;
        items.push({ iso: slot.toISOString(), label: timeLabel.format(slot) });
      }
    }
    if (items.length) {
      out.push({ date: `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`, label: dateLabel.format(dayDate), items });
    }
    if (out.length >= 14) break; // cap the number of days returned
  }

  return out;
}
