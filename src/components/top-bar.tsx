import Link from "next/link";
import { logoutAction } from "@/app/(auth)/actions";
import { initials } from "@/lib/utils";

export function TopBar({ userName, userEmail }: { userName: string; userEmail: string }) {
  return (
    <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-slate-200 bg-white px-4 sm:px-6">
      <Link href="/dashboard" className="text-lg font-bold tracking-tight text-slate-900">
        Placid<span className="text-brand-600">CRM</span>
      </Link>
      <div className="flex items-center gap-3">
        <div className="hidden text-right sm:block">
          <div className="text-sm font-medium leading-tight text-slate-800">{userName}</div>
          <div className="text-xs leading-tight text-slate-500">{userEmail}</div>
        </div>
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-600 text-sm font-semibold text-white">
          {initials(userName.split(" ")[0], userName.split(" ")[1], userName.charAt(0))}
        </div>
        <form action={logoutAction}>
          <button type="submit" className="btn-ghost text-sm">Sign out</button>
        </form>
      </div>
    </header>
  );
}
