"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { HUBS, CUSTOMERS_SUB, studioItems } from "@/lib/nav-config";

export function MobileNav({ locationId, locationName }: { locationId: string; locationName?: string }) {
  const pathname = usePathname();
  const base = `/dashboard/l/${locationId}`;
  const [studioOpen, setStudioOpen] = useState(false);

  const seg = pathname.slice(base.length).replace(/^\//, "").split("/")[0] ?? "";
  const customerKeys = CUSTOMERS_SUB.map((s) => s.key);
  const studio = studioItems(locationName);
  const studioKeys = studio.map((s) => s.key);

  const isActive = (key: string) => {
    if (key === "") return seg === "";
    if (key === "contacts") return customerKeys.includes(seg); // Customers hub
    return seg === key;
  };
  const studioActive = studioKeys.includes(seg);

  const Tab = ({ item }: { item: { key: string; label: string; icon: string } }) => {
    const active = isActive(item.key);
    return (
      <Link href={item.key ? `${base}/${item.key}` : base} className={cn("tab", active ? "text-brand-600" : "text-slate-400")}>
        <span className={cn("grid h-6 w-6 place-items-center text-lg", active && "scale-105")}>{item.icon}</span>
        <span>{item.label}</span>
      </Link>
    );
  };

  return (
    <>
      {/* Fixed bottom tab bar */}
      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white/90 backdrop-blur-xl pb-safe md:hidden">
        <div className="mx-auto flex max-w-lg items-stretch justify-around px-2 pt-1.5">
          {HUBS.map((h) => (
            <Tab key={h.key || "home"} item={h} />
          ))}
          <button
            type="button"
            onClick={() => setStudioOpen(true)}
            className={cn("tab", studioActive || studioOpen ? "text-brand-600" : "text-slate-400")}
          >
            <span className="grid h-6 w-6 place-items-center text-lg">✦</span>
            <span>Studio</span>
          </button>
        </div>
      </nav>

      {/* Studio sheet */}
      {studioOpen ? (
        <>
          <div className="sheet-backdrop md:hidden" onClick={() => setStudioOpen(false)} />
          <div className="sheet-panel md:hidden">
            <div className="mx-auto mb-3 h-1.5 w-10 rounded-full bg-slate-200" />
            <div className="mb-2 flex items-center justify-between px-1">
              <h2 className="text-base font-semibold text-slate-900">Studio</h2>
              <button onClick={() => setStudioOpen(false)} className="btn-ghost text-sm" aria-label="Close">Done</button>
            </div>
            <p className="mb-3 px-1 text-sm text-slate-500">Everything you build &amp; configure.</p>
            <div className="grid grid-cols-2 gap-2">
              {studio.map((item) => (
                <Link
                  key={item.key}
                  href={`${base}/${item.key}`}
                  onClick={() => setStudioOpen(false)}
                  className="flex items-center gap-3 rounded-2xl border border-slate-200/70 bg-white p-3.5 active:bg-slate-50"
                >
                  <span className="tile bg-brand-50">{item.icon}</span>
                  <span className="text-sm font-medium text-slate-800">{item.label}</span>
                </Link>
              ))}
            </div>
          </div>
        </>
      ) : null}
    </>
  );
}
