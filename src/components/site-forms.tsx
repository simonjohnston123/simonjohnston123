"use client";

import { useEffect, useState } from "react";
import { useFormState } from "react-dom";
import { submitLeadAction, bookingRequestAction } from "@/app/sites/actions";

type DaySlots = { date: string; label: string; items: { iso: string; label: string }[] };

type State = { ok?: boolean; error: string };
const INIT: State = { error: "" };

function Btn({ color, children }: { color: string; children: React.ReactNode }) {
  return (
    <button className="rounded-lg px-5 py-2.5 font-semibold text-white" style={{ background: color }}>
      {children}
    </button>
  );
}

export function LeadForm({
  slug,
  primaryColor,
  fields,
  submitLabel,
  thankYou,
}: {
  slug: string;
  primaryColor: string;
  fields: string[];
  submitLabel: string;
  thankYou: string;
}) {
  const [state, action] = useFormState(submitLeadAction, INIT);
  if (state.ok) {
    return <p className="rounded-lg bg-green-50 px-4 py-3 text-green-800">{thankYou}</p>;
  }
  const has = (f: string) => fields.includes(f);
  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="slug" value={slug} />
      {has("name") ? <input name="name" placeholder="Your name" className="input" /> : null}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {has("email") ? <input name="email" type="email" placeholder="Email" className="input" /> : null}
        {has("phone") ? <input name="phone" placeholder="Phone" className="input" /> : null}
      </div>
      {has("company") ? <input name="company" placeholder="Company" className="input" /> : null}
      {has("message") ? <textarea name="message" rows={3} placeholder="How can we help?" className="input" /> : null}
      {state.error ? <p className="text-sm text-red-600">{state.error}</p> : null}
      <Btn color={primaryColor}>{submitLabel || "Send"}</Btn>
    </form>
  );
}

// --- Booking widget helpers ------------------------------------------------

const WEEKDAYS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];
const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const pad2 = (n: number) => String(n).padStart(2, "0");
const ymd = (y: number, m: number, d: number) => `${y}-${pad2(m + 1)}-${pad2(d)}`;

function CalIcon({ className, style }: { className?: string; style?: React.CSSProperties }) {
  return (
    <svg className={className} style={style} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
      <rect x="3" y="4.5" width="18" height="16" rx="2.5" />
      <path d="M3 9h18M8 2.5v4M16 2.5v4" />
    </svg>
  );
}
function ClockIcon({ className, style }: { className?: string; style?: React.CSSProperties }) {
  return (
    <svg className={className} style={style} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7.5V12l3 2" />
    </svg>
  );
}
function Chevron({ dir }: { dir: "left" | "right" }) {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={dir === "left" ? "M15 6l-6 6 6 6" : "M9 6l6 6-6 6"} />
    </svg>
  );
}

type Service = { id: string; name: string; price: number | null; durationMinutes: number; description: string | null };

export function BookingForm({
  slug,
  primaryColor,
  calendarId,
  submitLabel,
  thankYou,
}: {
  slug: string;
  primaryColor: string;
  /** When set on the block, the widget is locked to this one service. When
   *  empty, the visitor picks from the business's bookable services. */
  calendarId: string;
  submitLabel: string;
  thankYou: string;
}) {
  const locked = calendarId || "";
  const [state, action] = useFormState(bookingRequestAction, INIT);
  const [services, setServices] = useState<Service[]>([]);
  const [servicesLoaded, setServicesLoaded] = useState(false);
  const [serviceId, setServiceId] = useState(locked);
  const [days, setDays] = useState<DaySlots[]>([]);
  const [loading, setLoading] = useState(Boolean(locked)); // loading slots
  const [selectedDate, setSelectedDate] = useState(""); // YYYY-MM-DD
  const [selected, setSelected] = useState(""); // chosen slot ISO
  const [view, setView] = useState<{ y: number; m: number } | null>(null); // month on screen

  // Load the business's bookable services (used for the picker + summary).
  useEffect(() => {
    let alive = true;
    fetch(`/api/booking/services?slug=${encodeURIComponent(slug)}`)
      .then((r) => r.json())
      .then((d) => {
        if (!alive) return;
        const list: Service[] = Array.isArray(d.services) ? d.services : [];
        setServices(list);
        // Auto-select when locked to one, or when there's only a single service.
        setServiceId((prev) => prev || (list.length === 1 ? list[0].id : ""));
      })
      .catch(() => {})
      .finally(() => alive && setServicesLoaded(true));
    return () => {
      alive = false;
    };
  }, [slug]);

  // Load availability whenever the chosen service changes.
  useEffect(() => {
    if (!serviceId) {
      setDays([]);
      return;
    }
    let alive = true;
    setLoading(true);
    setSelectedDate("");
    setSelected("");
    setView(null);
    fetch(`/api/booking/slots?slug=${encodeURIComponent(slug)}&calendarId=${encodeURIComponent(serviceId)}`)
      .then((r) => r.json())
      .then((d) => {
        if (!alive) return;
        const list: DaySlots[] = Array.isArray(d.slots) ? d.slots : [];
        setDays(list);
        if (list[0]) {
          setSelectedDate(list[0].date);
          const [y, m] = list[0].date.split("-").map(Number);
          setView({ y, m: m - 1 });
        }
      })
      .catch(() => {})
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [slug, serviceId]);

  if (state.ok) {
    return (
      <p className="rounded-xl bg-green-50 px-4 py-3 text-green-800">{thankYou}</p>
    );
  }
  if (servicesLoaded && services.length === 0 && !locked) {
    return <p className="rounded-xl bg-amber-50 px-4 py-3 text-amber-800">Booking isn&rsquo;t configured yet.</p>;
  }

  const activeService = services.find((s) => s.id === serviceId) || null;
  const priceLabel = (p: number | null) => (p != null ? `$${p}` : "");
  // Show the picker when the visitor genuinely has a choice to make.
  const showPicker = !locked && services.length > 1;

  const byDate = new Map(days.map((d) => [d.date, d]));
  const dayLabel = (dateStr: string) => byDate.get(dateStr)?.label ?? "";
  const times = byDate.get(selectedDate)?.items ?? [];

  // Month-navigation bounds derived from what's actually bookable.
  const firstDate = days[0]?.date;
  const lastDate = days[days.length - 1]?.date;
  const monthKey = (y: number, m: number) => y * 12 + m;
  const boundKey = (dateStr?: string, fallback = 0) => {
    if (!dateStr) return fallback;
    const [y, m] = dateStr.split("-").map(Number);
    return monthKey(y, m - 1);
  };
  const vk = view ? monthKey(view.y, view.m) : 0;
  const canPrev = view != null && vk > boundKey(firstDate, vk);
  const canNext = view != null && vk < boundKey(lastDate, vk);
  const shiftMonth = (delta: number) => {
    if (!view) return;
    const total = view.y * 12 + view.m + delta;
    setView({ y: Math.floor(total / 12), m: ((total % 12) + 12) % 12 });
  };

  // Build the calendar grid cells for the month on screen.
  const cells: (number | null)[] = [];
  if (view) {
    const lead = new Date(view.y, view.m, 1).getDay();
    const total = new Date(view.y, view.m + 1, 0).getDate();
    for (let i = 0; i < lead; i++) cells.push(null);
    for (let d = 1; d <= total; d++) cells.push(d);
  }

  const inputBase =
    "w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-slate-900 shadow-sm outline-none transition focus:border-slate-400 focus:ring-2 focus:ring-slate-100 placeholder:text-slate-400";

  return (
    <form action={action} className="space-y-6">
      <input type="hidden" name="slug" value={slug} />
      <input type="hidden" name="calendarId" value={serviceId} />
      <input type="hidden" name="when" value={selected} />

      {/* Service picker (shown when the visitor has more than one to choose from) */}
      {showPicker ? (
        <div>
          <p className="mb-2 text-sm font-semibold text-slate-800">Choose a service</p>
          <div className="grid gap-3 sm:grid-cols-2">
            {services.map((svc) => {
              const active = svc.id === serviceId;
              return (
                <button
                  key={svc.id}
                  type="button"
                  onClick={() => setServiceId(svc.id)}
                  className={[
                    "rounded-2xl border bg-white p-4 text-left transition",
                    active ? "shadow-sm" : "border-slate-200 hover:border-slate-300",
                  ].join(" ")}
                  style={active ? { borderColor: primaryColor, borderWidth: 2 } : undefined}
                >
                  <div className="flex items-start justify-between gap-2">
                    <span className="font-semibold text-slate-900">{svc.name}</span>
                    {svc.price != null ? (
                      <span className="shrink-0 font-bold" style={{ color: primaryColor }}>{priceLabel(svc.price)}</span>
                    ) : null}
                  </div>
                  <div className="mt-1 flex items-center gap-1 text-xs text-slate-500">
                    <ClockIcon className="h-3.5 w-3.5" />
                    <span>{svc.durationMinutes} min</span>
                  </div>
                  {svc.description ? (
                    <p className="mt-2 line-clamp-2 text-sm text-slate-600">{svc.description}</p>
                  ) : null}
                </button>
              );
            })}
          </div>
        </div>
      ) : null}

      {serviceId ? (
      <div className="grid gap-5 md:grid-cols-2">
        {/* Calendar */}
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="mb-3 flex items-center gap-2 text-slate-800">
            <CalIcon className="h-4 w-4" style={{ color: primaryColor }} />
            <span className="text-sm font-semibold">Choose a date</span>
          </div>

          {loading ? (
            <div className="grid grid-cols-7 gap-1.5">
              {Array.from({ length: 28 }).map((_, i) => (
                <div key={i} className="aspect-square animate-pulse rounded-lg bg-slate-100" />
              ))}
            </div>
          ) : days.length === 0 || !view ? (
            <p className="py-8 text-center text-sm text-slate-500">No times available right now — please get in touch.</p>
          ) : (
            <>
              <div className="mb-2 flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => shiftMonth(-1)}
                  disabled={!canPrev}
                  className="grid h-8 w-8 place-items-center rounded-lg text-slate-500 hover:bg-slate-100 disabled:opacity-30"
                  aria-label="Previous month"
                >
                  <Chevron dir="left" />
                </button>
                <span className="text-sm font-semibold text-slate-800">{MONTHS[view.m]} {view.y}</span>
                <button
                  type="button"
                  onClick={() => shiftMonth(1)}
                  disabled={!canNext}
                  className="grid h-8 w-8 place-items-center rounded-lg text-slate-500 hover:bg-slate-100 disabled:opacity-30"
                  aria-label="Next month"
                >
                  <Chevron dir="right" />
                </button>
              </div>

              <div className="mb-1 grid grid-cols-7 text-center text-[11px] font-medium uppercase tracking-wide text-slate-400">
                {WEEKDAYS.map((w, i) => (<div key={i} className="py-1">{w}</div>))}
              </div>

              <div className="grid grid-cols-7 gap-1.5">
                {cells.map((d, i) => {
                  if (d == null) return <div key={`x${i}`} />;
                  const dateStr = ymd(view.y, view.m, d);
                  const available = byDate.has(dateStr);
                  const isSelected = dateStr === selectedDate;
                  return (
                    <button
                      key={dateStr}
                      type="button"
                      disabled={!available}
                      onClick={() => { setSelectedDate(dateStr); setSelected(""); }}
                      className={[
                        "relative grid aspect-square place-items-center rounded-lg text-sm transition",
                        isSelected
                          ? "font-semibold text-white shadow-sm"
                          : available
                          ? "font-medium text-slate-800 hover:bg-slate-100"
                          : "text-slate-300",
                      ].join(" ")}
                      style={isSelected ? { background: primaryColor } : undefined}
                    >
                      {d}
                      {available && !isSelected ? (
                        <span className="absolute bottom-1 h-1 w-1 rounded-full" style={{ background: primaryColor }} />
                      ) : null}
                    </button>
                  );
                })}
              </div>
            </>
          )}
        </div>

        {/* Times */}
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="mb-3 flex items-center gap-2 text-slate-800">
            <ClockIcon className="h-4 w-4" style={{ color: primaryColor }} />
            <span className="text-sm font-semibold">
              {selectedDate ? dayLabel(selectedDate) : "Available times"}
            </span>
          </div>

          {loading ? (
            <p className="text-sm text-slate-400">Loading times…</p>
          ) : !selectedDate ? (
            <p className="py-8 text-center text-sm text-slate-500">Pick a date to see available times.</p>
          ) : times.length === 0 ? (
            <p className="py-8 text-center text-sm text-slate-500">No times left on this day.</p>
          ) : (
            <div className="grid max-h-64 grid-cols-2 gap-2 overflow-y-auto pr-1 sm:grid-cols-3 md:grid-cols-2 lg:grid-cols-3">
              {times.map((s) => {
                const active = selected === s.iso;
                return (
                  <button
                    key={s.iso}
                    type="button"
                    onClick={() => setSelected(s.iso)}
                    className={[
                      "rounded-xl border px-2 py-2 text-sm font-medium transition",
                      active
                        ? "border-transparent text-white shadow-sm"
                        : "border-slate-200 text-slate-700 hover:border-slate-300 hover:bg-slate-50",
                    ].join(" ")}
                    style={active ? { background: primaryColor } : undefined}
                  >
                    {s.label}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>
      ) : (
        <p className="rounded-xl border border-slate-200 bg-white px-4 py-8 text-center text-sm text-slate-500">
          Choose a service above to see available times.
        </p>
      )}

      {/* Your details */}
      <div className="space-y-3">
        <p className="text-sm font-semibold text-slate-800">Your details</p>
        <input name="name" placeholder="Your name" className={inputBase} />
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <input name="email" type="email" placeholder="Email" className={inputBase} />
          <input name="phone" placeholder="Phone" className={inputBase} />
        </div>
      </div>

      {selected ? (
        <p className="rounded-xl bg-slate-50 px-4 py-2.5 text-sm text-slate-600">
          {activeService ? (
            <>
              <span className="font-semibold text-slate-900">{activeService.name}</span>
              {activeService.price != null ? ` (${priceLabel(activeService.price)})` : ""} —{" "}
            </>
          ) : null}
          <span className="font-semibold text-slate-900">{dayLabel(selectedDate)}</span> at{" "}
          <span className="font-semibold text-slate-900">{times.find((t) => t.iso === selected)?.label}</span>
        </p>
      ) : null}

      {state.error ? <p className="text-sm text-red-600">{state.error}</p> : null}

      <button
        className="w-full rounded-xl px-5 py-3 font-semibold text-white shadow-sm transition hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-40 sm:w-auto"
        style={{ background: primaryColor }}
        disabled={!selected}
      >
        {submitLabel || "Request booking"}
      </button>
    </form>
  );
}
