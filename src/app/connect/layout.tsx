import Link from "next/link";
import { getCurrentMember } from "@/lib/connect-auth";
import { logoutAction } from "./actions";

export const metadata = { title: "Placid Connect" };

export default async function ConnectLayout({ children }: { children: React.ReactNode }) {
  const member = await getCurrentMember();
  return (
    <div className="min-h-screen bg-slate-100">
      {/* Purple top bar */}
      <header className="sticky top-0 z-40 bg-brand-gradient text-white shadow-md">
        <div className="mx-auto flex h-14 max-w-6xl items-center gap-4 px-4">
          <Link href="/connect" className="flex items-center gap-2 font-bold">
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-white/20 text-lg">◎</span>
            <span className="text-lg tracking-tight">Placid Connect</span>
          </Link>
          <div className="mx-2 hidden flex-1 md:block">
            <input placeholder="Search people, businesses, posts…" className="w-full max-w-md rounded-full border-0 bg-white/20 px-4 py-2 text-sm text-white placeholder:text-white/70 outline-none focus:bg-white/25" />
          </div>
          <nav className="ml-auto flex items-center gap-1 text-sm font-medium">
            <Link href="/connect" className="rounded-lg px-3 py-2 hover:bg-white/15">Home</Link>
            <Link href="/connect/directory" className="rounded-lg px-3 py-2 hover:bg-white/15">Business pages</Link>
            {member ? (
              <>
                <Link href={`/connect/u/${member.handle}`} className="flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-white/15">
                  <span className="grid h-8 w-8 place-items-center rounded-full bg-white/25 text-sm font-semibold">{member.name.slice(0, 1).toUpperCase()}</span>
                  <span className="hidden sm:inline">{member.name.split(" ")[0]}</span>
                </Link>
                <form action={logoutAction}><button className="rounded-lg px-3 py-2 hover:bg-white/15">Log out</button></form>
              </>
            ) : (
              <>
                <Link href="/connect/login" className="rounded-lg px-3 py-2 hover:bg-white/15">Log in</Link>
                <Link href="/connect/join" className="rounded-lg bg-white px-3 py-2 font-semibold text-brand-700 hover:bg-white/90">Join</Link>
              </>
            )}
          </nav>
        </div>
      </header>
      {children}
    </div>
  );
}
