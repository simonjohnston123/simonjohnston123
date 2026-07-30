import Link from "next/link";
import { requireSuperAdmin } from "@/lib/auth";
import { Logo } from "@/components/logo";

export const dynamic = "force-dynamic";

const nav = [
  { href: "/admin", label: "Overview" },
  { href: "/admin/businesses", label: "Businesses" },
  { href: "/admin/plans", label: "Plans" },
  { href: "/admin/users", label: "Users" },
];

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requireSuperAdmin();
  return (
    <div className="min-h-screen bg-slate-100">
      <header className="bg-slate-900 text-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <Link href="/admin" className="flex items-center gap-2">
            <Logo dark markClass="h-7 w-7" textClass="text-lg" />
            <span className="rounded bg-white/10 px-2 py-0.5 text-xs font-medium">Admin</span>
          </Link>
          <nav className="flex items-center gap-4 text-sm">
            {nav.map((n) => (
              <Link key={n.href} href={n.href} className="text-slate-300 hover:text-white">{n.label}</Link>
            ))}
            <Link href="/dashboard" className="text-slate-400 hover:text-white">← App</Link>
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-6">{children}</main>
    </div>
  );
}
