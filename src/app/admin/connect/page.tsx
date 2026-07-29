import { requireSuperAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { formatDate } from "@/lib/utils";
import { deletePostAction, deleteMemberAction } from "./actions";

export const dynamic = "force-dynamic";
export const metadata = { title: "Admin — Placid Connect" };

export default async function AdminConnect() {
  await requireSuperAdmin();
  const [members, posts, memberCount, postCount] = await Promise.all([
    prisma.connectMember.findMany({ orderBy: { createdAt: "desc" }, take: 30, include: { _count: { select: { posts: true } } } }),
    prisma.connectPost.findMany({ orderBy: { createdAt: "desc" }, take: 30, include: { author: true, _count: { select: { likes: true, comments: true } } } }),
    prisma.connectMember.count(),
    prisma.connectPost.count(),
  ]);

  return (
    <div>
      <h1 className="mb-1 text-2xl font-bold text-slate-900">Placid Connect</h1>
      <p className="mb-6 text-sm text-slate-500">{memberCount} members · {postCount} posts — moderate the social platform from here.</p>

      <div className="grid gap-6 lg:grid-cols-2">
        <section>
          <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-500">Recent members</h2>
          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
            {members.map((m) => (
              <div key={m.id} className="flex items-center justify-between border-b border-slate-100 px-4 py-2.5 last:border-0">
                <div><div className="text-sm font-medium text-slate-800">{m.name} <span className="text-xs text-slate-400">@{m.handle}</span></div>
                  <div className="text-xs text-slate-500">{m.email} · {m._count.posts} posts · {formatDate(m.createdAt)}</div></div>
                <form action={deleteMemberAction}><input type="hidden" name="memberId" value={m.id} /><button className="text-xs text-slate-400 hover:text-red-600">Remove</button></form>
              </div>
            ))}
            {members.length === 0 ? <p className="p-4 text-sm text-slate-400">No members yet.</p> : null}
          </div>
        </section>

        <section>
          <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-500">Recent posts</h2>
          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
            {posts.map((p) => (
              <div key={p.id} className="flex items-start justify-between gap-3 border-b border-slate-100 px-4 py-2.5 last:border-0">
                <div className="min-w-0"><div className="truncate text-sm text-slate-800">{p.body}</div>
                  <div className="text-xs text-slate-500">{p.author.name} · ♥ {p._count.likes} · 💬 {p._count.comments} · {formatDate(p.createdAt)}</div></div>
                <form action={deletePostAction}><input type="hidden" name="postId" value={p.id} /><button className="text-xs text-slate-400 hover:text-red-600">Delete</button></form>
              </div>
            ))}
            {posts.length === 0 ? <p className="p-4 text-sm text-slate-400">No posts yet.</p> : null}
          </div>
        </section>
      </div>
    </div>
  );
}
