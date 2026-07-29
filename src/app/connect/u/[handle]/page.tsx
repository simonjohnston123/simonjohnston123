import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function ProfilePage({ params }: { params: { handle: string } }) {
  const member = await prisma.connectMember.findUnique({
    where: { handle: params.handle },
    include: { posts: { orderBy: { createdAt: "desc" }, take: 30, include: { _count: { select: { likes: true, comments: true } } } }, _count: { select: { posts: true, followers: true, following: true } } },
  });
  if (!member) notFound();
  return (
    <main className="mx-auto max-w-2xl px-4 py-6">
      <div className="rounded-2xl bg-white p-6 shadow-sm">
        <div className="flex items-center gap-4">
          <span className="grid h-16 w-16 place-items-center rounded-full bg-brand-gradient text-2xl font-semibold text-white">{member.name.slice(0, 1).toUpperCase()}</span>
          <div>
            <h1 className="text-xl font-bold text-slate-900">{member.name}</h1>
            <div className="text-sm text-slate-500">@{member.handle}</div>
            <div className="mt-1 text-xs text-slate-500">{member._count.posts} posts · {member._count.followers} followers · {member._count.following} following</div>
          </div>
        </div>
        {member.bio ? <p className="mt-3 text-sm text-slate-600">{member.bio}</p> : null}
      </div>
      <div className="mt-4 space-y-3">
        {member.posts.map((p) => (
          <article key={p.id} className="rounded-2xl bg-white p-4 shadow-sm">
            <p className="whitespace-pre-line text-[15px] text-slate-800">{p.body}</p>
            <div className="mt-2 text-xs text-slate-400">♥ {p._count.likes} · 💬 {p._count.comments}</div>
          </article>
        ))}
        {member.posts.length === 0 ? <p className="rounded-2xl bg-white p-6 text-center text-sm text-slate-400 shadow-sm">No posts yet.</p> : null}
      </div>
    </main>
  );
}
