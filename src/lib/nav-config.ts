// Single source of truth for the 5-hub information architecture, shared by the
// mobile bottom bar and the desktop sidebar so they never drift.

export type NavItem = { key: string; label: string; icon: string };

// The primary hubs (mobile bottom tabs / desktop rail). "studio" is special:
// it opens the Studio sheet rather than routing directly.
export const HUBS: NavItem[] = [
  { key: "", label: "Home", icon: "◧" },
  { key: "conversations", label: "Inbox", icon: "✉" },
  { key: "contacts", label: "Customers", icon: "◍" },
  { key: "calendar", label: "Calendar", icon: "◷" },
];

// Under the Customers hub.
export const CUSTOMERS_SUB: NavItem[] = [
  { key: "contacts", label: "Contacts", icon: "◍" },
  { key: "pipelines", label: "Pipelines", icon: "▤" },
  { key: "tasks", label: "Tasks", icon: "✓" },
];

// Everything you build & configure — lives in the Studio sheet / section.
export const STUDIO_BASE: NavItem[] = [
  { key: "website", label: "Website", icon: "❖" },
  { key: "products", label: "Products", icon: "🛍️" },
  { key: "forms", label: "Forms & Surveys", icon: "📝" },
  { key: "marketing", label: "Marketing", icon: "📣" },
  { key: "automations", label: "Automations", icon: "⚡" },
  { key: "orders", label: "Orders", icon: "🧾" },
  { key: "payments", label: "Payments", icon: "💳" },
  { key: "integrations", label: "Integrations", icon: "🔌" },
  { key: "settings", label: "Settings", icon: "⚙" },
];

/** Studio items, with any business-type module inserted first. */
export function studioItems(locationName = ""): NavItem[] {
  const name = locationName.toLowerCase();
  const modules: NavItem[] = [];
  if (/storage|yard|unit|container/.test(name)) {
    modules.push({ key: "storage", label: "Storage", icon: "▦" }, { key: "cctv", label: "CCTV", icon: "📹" });
  } else if (/homestead|accommodation|homested/.test(name)) {
    modules.push({ key: "rooms", label: "Rooms", icon: "🛏" });
  }
  return [...modules, ...STUDIO_BASE];
}
