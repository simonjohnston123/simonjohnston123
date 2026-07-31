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

// Placid Homestead — grouped nav matching the guest-journey structure.
// Anything not listed here (Pipelines, Tasks, Orders, Payments, Automations,
// Website, Settings) still exists and is reachable by URL — it's just not
// shown in this business's sidebar for now.
const homesteadGroups: { label: string; items: { key: string; label: string; icon: string }[] }[] = [
  { label: "Overview", items: [{ key: "", label: "Dashboard", icon: "◧" }] },
  {
    label: "Guest journey",
    items: [
      { key: "calendar", label: "Calendar", icon: "◷" },
      { key: "contacts", label: "Contacts", icon: "◍" },
      { key: "conversations", label: "Conversations", icon: "✉" },
    ],
  },
  {
    label: "Property & money",
    items: [
      { key: "rooms", label: "Rooms & property", icon: "🛏" },
      { key: "documents", label: "Documents", icon: "📄" },
      { key: "finance", label: "Finance", icon: "💰" },
      { key: "operations", label: "Operations", icon: "🧹" },
    ],
  },
  {
    label: "Grow & manage",
    items: [
      { key: "marketing", label: "Marketing", icon: "📣" },
      { key: "teams", label: "Teams", icon: "👥" },
      { key: "integrations", label: "Integrations & automations", icon: "🔌" },
    ],
  },
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

  const name = locationName ?? "";
  const isHomestead = /home\s*stead|accommodation/i.test(name);

  const renderLink = (item: { key: string; label: string; icon: string }) => {
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
  };

  if (isHomestead) {
    return (
      <nav className={horizontal ? "flex gap-1 overflow-x-auto pb-1" : "space-y-4"}>
        {homesteadGroups.map((group) => (
          <div key={group.label}>
            {!horizontal ? (
              <div className="px-2 pb-1 text-[11px] font-semibold uppercase tracking-wide text-slate-400">{group.label}</div>
            ) : null}
            <div className={horizontal ? "flex gap-1" : "space-y-1"}>{group.items.map(renderLink)}</div>
          </div>
        ))}
      </nav>
    );
  }

  // Vertical modules appear only for the sub-account they belong to.
  const navItems = /storage/i.test(name)
    ? [
        ...items.slice(0, 1),
        { key: "storage", label: "Storage", icon: "▦" },
        { key: "cctv", label: "CCTV", icon: "📹" },
        ...items.slice(1),
      ]
    : items;

  return (
    <nav className={horizontal ? "flex gap-1 overflow-x-auto pb-1" : "space-y-1"}>
      {navItems.map(renderLink)}
    </nav>
  );
}
