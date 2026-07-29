import Link from "next/link";
import { logoutAction } from "@/app/(auth)/actions";
import { initials } from "@/lib/utils";

export function TopBar({ userName, userEmail }: { userName: string; userEmail: string }) {
  return (
    <header className="sticky top-0 z-40 flex h-14 items-center justify-between border-b border-slate-200/70 bg-white/80 px-4 backdrop-blur-md sm:px-6">
      <Link href="/dashboard" className="flex items-center gap-2 text-[15px] font-bold tracking-tight">
        <span className="grid h-7 w-7 place-items-center rounded-lg bg-brand-gradient text-white shadow-[0_4px_12px_-4px_rgba(142,45,226,0.6)]">◆</span>
        <span className="text-slate-900">Placid<span className="bg-gradient-to-r from-brand-600 to-accent-500 bg-clip-text text-transparent">CRM</span></span>
      </Link>
      <div className="flex items-center gap-3">
        <div className="hidden text-right sm:block">
          <div className="text-sm font-medium leading-tight text-slate-800">{userName}</div>
          <div className="text-xs leading-tight text-slate-500">{userEmail}</div>
        </div>
        <div className="grid h-8 w-8 place-items-center rounded-full bg-brand-gradient text-sm font-semibold text-white shadow-[0_4px_12px_-4px_rgba(142,45,226,0.55)]">
          {initials(userName.split(" ")[0], userName.split(" ")[1], userName.charAt(0))}
        </div>
        <form action={logoutAction}>
          <button type="submit" className="btn-ghost text-sm">Sign out</button>
        </form>
      </div>
    </header>
  );
}
