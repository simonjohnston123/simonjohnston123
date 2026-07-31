"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

const STAGES = ["Leads", "Waitlist", "Applicants", "Current guests", "Past guests"];

// Visual placeholder only — doesn't filter the contact list yet.
export function GuestStageTabs() {
  const [active, setActive] = useState(STAGES[0]);
  return (
    <div className="mb-4 flex flex-wrap gap-1 rounded-lg border border-slate-200 bg-slate-50 p-1 w-fit">
      {STAGES.map((s) => (
        <button
          key={s}
          type="button"
          onClick={() => setActive(s)}
          className={cn(
            "rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
            active === s ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"
          )}
        >
          {s}
        </button>
      ))}
    </div>
  );
}
