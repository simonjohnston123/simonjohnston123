"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { HUBS, CUSTOMERS_SUB, studioItems, type NavItem } from "@/lib/nav-config";

// Desktop sidebar — the 5-hub IA (Home · Inbox · Customers · Calendar · Studio).
// Mobile uses <MobileNav /> (bottom bar) instead.
export function LocationNav({ locationId, locationName }: { locationId: string; locationName?: string }) {
  const pathname = usePathname();
  const base = `/dashboard/l/${locationId}`;
  const seg = pathname.slice(base.length).replace(/^\//, "").split("/")[0] ?? "";

  const link = (item: NavItem, opts: { home?: boolean } = {}) => {
    const href = item.key ? `${base}/${item.key}` : base;
    const active = opts.home ? seg === "" : seg === item.key;
    return (
      <Link key={item.key || "home"} href={href} className={cn("nav-link", active ? "nav-link-active" : "nav-link-idle")}>
        <span className={cn("grid h-5 w-5 place-items-center text-[13px]", active ? "opacity-100" : "opacity-70")}>{item.icon}</span>
        {item.label}
      </Link>
    );
  };

  const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
    <div>
      <p className="px-3 pb-1 pt-4 text-[11px] font-semibold uppercase tracking-wider text-slate-400">{title}</p>
      <div className="space-y-0.5">{children}</div>
    </div>
  );

  return (
    <nav className="space-y-0.5">
      {link(HUBS[0], { home: true })}
      {link(HUBS[1])}

      <Section title="Customers">
        {CUSTOMERS_SUB.map((s) => link(s))}
      </Section>

      <Section title="Schedule">
        {link(HUBS[3])}
      </Section>

      <Section title="Studio">
        {studioItems(locationName).map((s) => link(s))}
      </Section>
    </nav>
  );
}
