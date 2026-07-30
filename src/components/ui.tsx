import Link from "next/link";
import { cn } from "@/lib/utils";

/** Segmented control used to switch between a hub's sub-views. */
export function SegTabs({
  items,
  active,
}: {
  items: { key: string; label: string; href: string }[];
  active: string;
}) {
  return (
    <div className="seg mb-4 flex w-full sm:inline-flex sm:w-auto">
      {items.map((it) => (
        <Link
          key={it.key}
          href={it.href}
          className={cn("seg-item flex-1 text-center sm:flex-none", it.key === active && "seg-item-active")}
        >
          {it.label}
        </Link>
      ))}
    </div>
  );
}

export function PageHeader({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">{title}</h1>
        {subtitle ? <p className="mt-1 text-sm text-slate-500">{subtitle}</p> : null}
      </div>
      {action}
    </div>
  );
}

export function EmptyState({
  title,
  body,
  action,
}: {
  title: string;
  body?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="card flex flex-col items-center justify-center gap-3 p-12 text-center">
      <p className="text-base font-medium text-slate-800">{title}</p>
      {body ? <p className="max-w-md text-sm text-slate-500">{body}</p> : null}
      {action}
    </div>
  );
}

export function Badge({
  children,
  color = "slate",
}: {
  children: React.ReactNode;
  color?: "slate" | "green" | "red" | "amber" | "blue";
}) {
  const colors: Record<string, string> = {
    slate: "bg-slate-100 text-slate-700",
    green: "bg-green-100 text-green-700",
    red: "bg-red-100 text-red-700",
    amber: "bg-amber-100 text-amber-800",
    blue: "bg-brand-100 text-brand-700",
  };
  return <span className={cn("badge", colors[color])}>{children}</span>;
}
