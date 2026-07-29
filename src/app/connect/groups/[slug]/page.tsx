import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { getCurrentMember } from "@/lib/connect-auth";
import { createPostAction, toggleLikeAction } from "../../actions";
import { joinGroupAction } from "../actions";

export const dynamic = "force-dynamic";

function ago(d: Date) {
  const s = Math.floor((Date.now() - d.getTime()) / 1000);
  if (s < 3600) return `${Math.max(1, Math.floor(s / 60))}m`;
  if (s < 86400) return `${Math.floor(s / 3600)}h`;
  return `${Math.floor(s / 86400)}d`;
}

export default async function GroupPage({ params }: { params: { slug: string } }) {
  const member = await getCurrentMember();
  const group = await prisma.connectGroup.findUnique({
    where: { slug: params.slug },
    include: {
      owner: true,
      _count: { select: { members: true } },
      members: { where: { memberId: member?.id ?? "__none__" }, take: 1 },
      posts: { orderBy: { createdAt: "desc" }, take: 40, include: { author: true, _count: { select: { likes: true, comments: true } } } },
    },
  });
  if (!group) notFound();
  const isMember = Boolean(member && group.members && group.members.length > 0);

  return (
    <main className="mx-auto max-w-2xl px-4 py-6">
      <div className="overflow-hidden rounded-2xl bg-white shadow-sm">
        <div className="h-24 bg-brand-gradient" style={group.coverColor ? { background: group.coverColor } : undefined} />
        <div className="flex items-start justify-between gap-3 p-5">
          <div>
            <h1 className="text-xl font-bold text-slate-900">{group.name}</h1>
            <div className="text-xs text-slate-400">{group._count.members} members · by {group.owner.name}</div>
            {group.description ? <p className="mt-2 text-sm text-slate-600">{group.description}</p> : null}
          </div>
          {member ? (
            <form action={joinGroupAction}>
              <input type="hidden" name="groupId" value={group.id} /><input type="hidden" name="slug" value={group.slug} />
              <button className={isMember ? "rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700" : "rounded-lg bg-brand-gradient px-4 py-2 text-sm font-semibold text-white"}>{isMember ? "Leave" : "Join"}</button>
            </form>
          ) : <Link href="/connect/join" className="rounded-lg bg-brand-gradient px-4 py-2 text-sm font-semibold text-white">Join</Link>}
        </div>
      </div>

      <div className="mt-4 space-y-3">
        {isMember && (
          <form action={createPostAction} className="rounded-2xl bg-white p-4 shadow-sm">
            <input type="hidden" name="groupId" value={group.id} />
            <textarea name="body" rows={2} required placeholder={`Post in ${group.name}…`} className="w-full resize-none rounded-xl bg-slate-100 px-4 py-2.5 text-sm outline-none" />
            <div className="mt-2 text-right"><button className="rounded-lg bg-brand-gradient px-5 py-2 text-sm font-semibold text-white">Post</button></div>
          </form>
        )}
        {group.posts.length === 0 ? <p className="rounded-2xl bg-white p-6 text-center text-sm text-slate-400 shadow-sm">No posts in this group yet.</p> : group.posts.map((p) => (
          <article key={p.id} className="rounded-2xl bg-white p-4 shadow-sm">
            <div className="mb-2 flex items-center gap-2">
              <span className="grid h-9 w-9 place-items-center rounded-full bg-brand-gradient text-sm font-semibold text-white">{p.author.name.slice(0, 1).toUpperCase()}</span>
              <div><div className="text-sm font-semibold text-slate-800">{p.author.name}</div><div className="text-xs text-slate-400">{ago(p.createdAt)}</div></div>
            </div>
            <p className="whitespace-pre-line text-[15px] text-slate-800">{p.body}</p>
            <form action={toggleLikeAction} className="mt-2"><input type="hidden" name="postId" value={p.id} /><button className="text-sm text-slate-500 hover:text-brand-600">♥ {p._count.likes} · 💬 {p._count.comments}</button></form>
          </article>
        ))}
      </div>
    </main>
  );
}
