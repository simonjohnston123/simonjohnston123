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
  { key: "orders", label: "Orders", icon: "🧾" },
  { key: "payments", label: "Payments", icon: "💳" },
  { key: "marketing", label: "Marketing", icon: "📣" },
  { key: "automations", label: "Automations", icon: "⚡" },
  { key: "calendar", label: "Calendar", icon: "◷" },
  { key: "website", label: "Website", icon: "❖" },
  { key: "integrations", label: "Integrations", icon: "🔌" },
  { key: "settings", label: "Settings", icon: "⚙" },
];

export function LocationNav({
  locationId,
  locationName,
  orientation = "vertical",
}: {
  locationId: string;
  locationName?: string;
  orientation?: "vertical" | "horizontal";
}) {
  const pathname = usePathname();
  const base = `/dashboard/l/${locationId}`;
  const horizontal = orientation === "horizontal";

  // The Storage panel only makes sense for the Placid Storage sub-account.
  const navItems = /storage/i.test(locationName ?? "")
    ? [...items.slice(0, 1), { key: "storage", label: "Storage", icon: "▦" }, ...items.slice(1)]
    : items;

  return (
    <nav className={horizontal ? "flex gap-1 overflow-x-auto pb-1" : "space-y-1"}>
      {navItems.map((item) => {
        const href = item.key ? `${base}/${item.key}` : base;
        const active = item.key ? pathname.startsWith(href) : pathname === base;
        return (
          <Link
            key={item.key || "home"}
            href={href}
            className={cn(
              "nav-link",
              horizontal ? "shrink-0 whitespace-nowrap" : "",
              active ? "nav-link-active" : "nav-link-idle"
            )}
          >
            <span className={cn("grid h-5 w-5 place-items-center text-[13px]", active ? "opacity-100" : "opacity-70")}>{item.icon}</span>
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
