import Link from "next/link";
import { prisma } from "@/lib/db";
import { getCurrentMember } from "@/lib/connect-auth";
import { NewGroup } from "./new-group";

export const dynamic = "force-dynamic";
export const metadata = { title: "Groups · Placid Connect" };

export default async function Groups() {
  const member = await getCurrentMember();
  const groups = await prisma.connectGroup.findMany({
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { members: true, posts: true } } },
  });

  return (
    <main className="mx-auto max-w-3xl px-4 py-6">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-900">Groups</h1>
        {member ? <NewGroup /> : <Link href="/connect/join" className="rounded-lg bg-brand-gradient px-4 py-2 text-sm font-semibold text-white">Join to create</Link>}
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {groups.length === 0 ? <p className="text-sm text-slate-400">No groups yet — create the first one.</p> : groups.map((g) => (
          <Link key={g.id} href={`/connect/groups/${g.slug}`} className="overflow-hidden rounded-2xl bg-white shadow-sm hover:shadow">
            <div className="h-16 bg-brand-gradient" style={g.coverColor ? { background: g.coverColor } : undefined} />
            <div className="p-4">
              <div className="font-semibold text-slate-900">{g.name}</div>
              {g.description ? <p className="mt-0.5 line-clamp-2 text-sm text-slate-500">{g.description}</p> : null}
              <div className="mt-2 text-xs text-slate-400">{g._count.members} members · {g._count.posts} posts</div>
            </div>
          </Link>
        ))}
      </div>
    </main>
  );
}
