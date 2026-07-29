import Link from "next/link";
import { prisma } from "@/lib/db";
import { getCurrentMember } from "@/lib/connect-auth";
import { createPostAction, toggleLikeAction, commentAction } from "./actions";

export const dynamic = "force-dynamic";

function ago(d: Date) {
  const s = Math.floor((Date.now() - d.getTime()) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  if (s < 86400) return `${Math.floor(s / 3600)}h`;
  return `${Math.floor(s / 86400)}d`;
}

export default async function ConnectFeed() {
  const member = await getCurrentMember();
  const posts = await prisma.connectPost.findMany({
    orderBy: { createdAt: "desc" },
    take: 40,
    include: { author: true, _count: { select: { likes: true, comments: true } }, comments: { include: { author: true }, orderBy: { createdAt: "asc" }, take: 3 } },
  });
  const myLikes = member
    ? new Set((await prisma.connectLike.findMany({ where: { memberId: member.id, postId: { in: posts.map((p) => p.id) } }, select: { postId: true } })).map((l) => l.postId))
    : new Set<string>();

  const businesses = await prisma.location.findMany({ orderBy: { createdAt: "desc" }, take: 5, select: { name: true, slug: true, industry: true } });

  return (
    <main className="mx-auto grid max-w-6xl gap-4 px-4 py-5 lg:grid-cols-[220px_1fr_260px]">
      {/* left rail */}
      <aside className="hidden lg:block">
        <div className="sticky top-20 space-y-1 text-sm">
          {member ? (
            <Link href={`/connect/u/${member.handle}`} className="flex items-center gap-3 rounded-xl bg-white p-3 shadow-sm">
              <span className="grid h-10 w-10 place-items-center rounded-full bg-brand-gradient font-semibold text-white">{member.name.slice(0, 1).toUpperCase()}</span>
              <div><div className="font-semibold text-slate-800">{member.name}</div><div className="text-xs text-slate-500">@{member.handle}</div></div>
            </Link>
          ) : null}
          {[["🏠", "Home", "/connect"], ["🏢", "Business pages", "/connect/directory"], ["👥", "Friends", "/connect"], ["🛍", "Marketplace", "/connect/directory"], ["💬", "Messages", "/connect"]].map(([i, l, h]) => (
            <Link key={l} href={h} className="flex items-center gap-3 rounded-xl px-3 py-2 text-slate-700 hover:bg-white">
              <span>{i}</span>{l}
            </Link>
          ))}
        </div>
      </aside>

      {/* center feed */}
      <section className="space-y-4">
        {member ? (
          <form action={createPostAction} className="rounded-2xl bg-white p-4 shadow-sm">
            <div className="flex gap-3">
              <span className="grid h-10 w-10 flex-none place-items-center rounded-full bg-brand-gradient font-semibold text-white">{member.name.slice(0, 1).toUpperCase()}</span>
              <textarea name="body" rows={2} required placeholder={`What's happening, ${member.name.split(" ")[0]}?`} className="w-full resize-none rounded-xl bg-slate-100 px-4 py-2.5 text-sm outline-none placeholder:text-slate-400 focus:bg-slate-50" />
            </div>
            <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-3">
              <div className="flex gap-1 text-slate-400">
                <span className="rounded-lg px-2 py-1 text-sm hover:bg-slate-100">📷 Photo</span>
                <span className="rounded-lg px-2 py-1 text-sm hover:bg-slate-100">😊 Feeling</span>
                <span className="rounded-lg px-2 py-1 text-sm hover:bg-slate-100">📍 Check in</span>
              </div>
              <button className="rounded-lg bg-brand-gradient px-5 py-2 text-sm font-semibold text-white">Post</button>
            </div>
          </form>
        ) : (
          <div className="rounded-2xl bg-white p-6 text-center shadow-sm">
            <h2 className="text-lg font-bold text-slate-900">Welcome to Placid Connect</h2>
            <p className="mx-auto mt-1 max-w-md text-sm text-slate-500">A fairer social network — for people and local businesses. No middlemen taking a cut.</p>
            <div className="mt-4 flex justify-center gap-2">
              <Link href="/connect/join" className="rounded-lg bg-brand-gradient px-5 py-2 text-sm font-semibold text-white">Join free</Link>
              <Link href="/connect/login" className="rounded-lg border border-slate-200 px-5 py-2 text-sm font-semibold text-slate-700">Log in</Link>
            </div>
          </div>
        )}

        {posts.length === 0 ? (
          <div className="rounded-2xl bg-white p-8 text-center text-sm text-slate-400 shadow-sm">No posts yet — be the first to say something.</div>
        ) : posts.map((p) => (
          <article key={p.id} className="rounded-2xl bg-white shadow-sm">
            <div className="flex items-center gap-3 p-4 pb-2">
              <span className="grid h-10 w-10 place-items-center rounded-full bg-brand-gradient font-semibold text-white">{p.author.name.slice(0, 1).toUpperCase()}</span>
              <div><div className="text-sm font-semibold text-slate-800">{p.author.name}</div><div className="text-xs text-slate-400">@{p.author.handle} · {ago(p.createdAt)}</div></div>
            </div>
            <p className={`whitespace-pre-line px-4 pb-3 ${p.bg ? "mx-4 mb-3 rounded-xl px-5 py-8 text-center text-lg font-semibold text-white" : "text-[15px] text-slate-800"}`} style={p.bg ? { background: p.bg } : undefined}>{p.body}</p>
            <div className="flex items-center gap-2 border-t border-slate-100 px-2 py-1 text-sm text-slate-500">
              <form action={toggleLikeAction} className="flex-1">
                <input type="hidden" name="postId" value={p.id} />
                <button className={`flex w-full items-center justify-center gap-2 rounded-lg py-2 hover:bg-slate-100 ${myLikes.has(p.id) ? "font-semibold text-brand-600" : ""}`}>♥ {p._count.likes > 0 ? p._count.likes : ""} Like</button>
              </form>
              <div className="flex-1 text-center text-slate-500">💬 {p._count.comments} Comment{p._count.comments === 1 ? "" : "s"}</div>
              <div className="flex-1 text-center text-slate-400">↗ Share</div>
            </div>
            {(p.comments.length > 0 || member) && (
              <div className="space-y-2 border-t border-slate-100 bg-slate-50/60 px-4 py-3">
                {p.comments.map((c) => (
                  <div key={c.id} className="flex gap-2 text-sm">
                    <span className="grid h-7 w-7 flex-none place-items-center rounded-full bg-slate-300 text-xs font-semibold text-white">{c.author.name.slice(0, 1).toUpperCase()}</span>
                    <div className="rounded-2xl bg-white px-3 py-1.5 shadow-sm"><span className="font-semibold text-slate-700">{c.author.name}</span> <span className="text-slate-700">{c.body}</span></div>
                  </div>
                ))}
                {member && (
                  <form action={commentAction} className="flex gap-2 pt-1">
                    <input type="hidden" name="postId" value={p.id} />
                    <input name="body" placeholder="Write a comment…" className="w-full rounded-full bg-white px-3 py-1.5 text-sm shadow-sm outline-none" />
                  </form>
                )}
              </div>
            )}
          </article>
        ))}
      </section>

      {/* right rail */}
      <aside className="hidden lg:block">
        <div className="sticky top-20 space-y-4">
          <div className="rounded-2xl bg-white p-4 shadow-sm">
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Business pages</h3>
            <div className="space-y-2">
              {businesses.length === 0 ? <p className="text-xs text-slate-400">No businesses yet.</p> : businesses.map((b) => (
                <Link key={b.slug} href={`/connect/directory`} className="flex items-center gap-2 rounded-lg p-1.5 hover:bg-slate-50">
                  <span className="grid h-8 w-8 place-items-center rounded-lg bg-brand-100 text-brand-700">🏢</span>
                  <div><div className="text-sm font-medium text-slate-800">{b.name}</div>{b.industry ? <div className="text-xs text-slate-400">{b.industry}</div> : null}</div>
                </Link>
              ))}
            </div>
          </div>
          <div className="rounded-2xl bg-brand-50 p-4 text-sm text-brand-800">
            <b>Own a business?</b> Create a free page, then upgrade to the full Placid CRM when you&rsquo;re ready.
            <Link href="/connect/join" className="mt-2 block rounded-lg bg-brand-gradient px-3 py-2 text-center font-semibold text-white">Create a page</Link>
          </div>
        </div>
      </aside>
    </main>
  );
}
