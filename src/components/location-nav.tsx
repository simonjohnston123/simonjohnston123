"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const items = [
  { key: "", label: "Dashboard", icon: "◧" },
  { key: "contacts", label: "Contacts", icon: "◍" },
  { key: "pipelines", label: "Pipelines", icon: "▤" },
  { key: "tasks", label: "Tasks", icon: "✓" },
  { key: "conversations", label: "Conversations", icon: "✉" },
  { key: "automations", label: "Automations", icon: "⚡" },
  { key: "calendar", label: "Calendar", icon: "◷" },
  { key: "website", label: "Website", icon: "❖" },
  { key: "integrations", label: "Integrations", icon: "🔌" },
  { key: "settings", label: "Settings", icon: "⚙" },
];

export function LocationNav({ locationId, locationName }: { locationId: string; locationName?: string }) {
  const pathname = usePathname();
  const base = `/dashboard/l/${locationId}`;

  // The Storage panel only makes sense for the Placid Storage sub-account.
  const navItems = /storage/i.test(locationName ?? "")
    ? [...items.slice(0, 1), { key: "storage", label: "Storage", icon: "▦" }, ...items.slice(1)]
    : items;

  return (
    <nav className="space-y-1">
      {navItems.map((item) => {
        const href = item.key ? `${base}/${item.key}` : base;
        const active = item.key
          ? pathname.startsWith(href)
          : pathname === base;
        return (
          <Link
            key={item.key || "home"}
            href={href}
            className={cn(
              "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
              active ? "bg-brand-600 text-white" : "text-slate-600 hover:bg-slate-100"
            )}
          >
            <span className="w-4 text-center opacity-80">{item.icon}</span>
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
