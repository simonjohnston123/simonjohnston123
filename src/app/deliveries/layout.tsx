import Link from "next/link";
import { getDriver } from "@/lib/driver-auth";
import { logoutDriverAction } from "./actions";

export const dynamic = "force-dynamic";

export default async function DeliveriesLayout({ children }: { children: React.ReactNode }) {
  const driver = await getDriver();
  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
          <Link href="/deliveries" className="text-lg font-bold tracking-tight">
            Placid <span className="text-brand-600">Deliveries</span>
          </Link>
          <nav className="flex items-center gap-4 text-sm">
            {driver ? (
              <>
                <Link href="/deliveries/jobs" className="text-slate-600 hover:text-slate-900">Available</Link>
                <Link href="/deliveries/my" className="text-slate-600 hover:text-slate-900">My deliveries</Link>
                <form action={logoutDriverAction}><button className="text-slate-400 hover:text-slate-700">Log out</button></form>
              </>
            ) : (
              <>
                <Link href="/deliveries/login" className="text-slate-600 hover:text-slate-900">Log in</Link>
                <Link href="/deliveries/signup" className="btn-primary text-sm">Sign up to drive</Link>
              </>
            )}
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-6">{children}</main>
    </div>
  );
}
