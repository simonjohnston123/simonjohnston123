"use client";

import { useState } from "react";
import Link from "next/link";

const QUICK = [
  { icon: "📅", label: "New booking", href: "calendar" },
  { icon: "👤", label: "Add contact", href: "contacts" },
  { icon: "📝", label: "New form", href: "forms" },
  { icon: "✉", label: "Open inbox", href: "conversations" },
  { icon: "🛍️", label: "Add product", href: "products" },
  { icon: "✦", label: "AI setup", href: "setup" },
];

/** The hero "Ask or do anything" bar → opens a quick-action sheet (2-tap creates). */
export function CommandBar({ base }: { base: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex w-full items-center gap-2.5 rounded-2xl border border-white/25 bg-white/15 px-4 py-3 text-left backdrop-blur-md transition active:scale-[0.99]"
      >
        <span className="text-base">✨</span>
        <span className="text-sm text-white/90">Ask or do anything…</span>
      </button>

      {open ? (
        <>
          <div className="sheet-backdrop" onClick={() => setOpen(false)} />
          <div className="sheet-panel">
            <div className="mx-auto mb-3 h-1.5 w-10 rounded-full bg-slate-200" />
            <div className="mb-3 flex items-center justify-between px-1">
              <h2 className="text-base font-semibold text-slate-900">Quick actions</h2>
              <button onClick={() => setOpen(false)} className="btn-ghost text-sm">Done</button>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {QUICK.map((q) => (
                <Link
                  key={q.href}
                  href={`${base}/${q.href}`}
                  onClick={() => setOpen(false)}
                  className="flex items-center gap-3 rounded-2xl border border-slate-200/70 bg-white p-3.5 active:bg-slate-50"
                >
                  <span className="tile bg-brand-50">{q.icon}</span>
                  <span className="text-sm font-medium text-slate-800">{q.label}</span>
                </Link>
              ))}
            </div>
          </div>
        </>
      ) : null}
    </>
  );
}
