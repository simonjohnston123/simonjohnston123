import Link from "next/link";
import { prisma } from "@/lib/db";
import { formatDate } from "@/lib/utils";

export const dynamic = "force-dynamic";
export const metadata = { title: "Admin — Overview" };

export default async function AdminOverview() {
  const [agencies, suspended, locations, users, contacts, orders, members, posts, recent] = await Promise.all([
    prisma.agency.count(),
    prisma.agency.count({ where: { status: "SUSPENDED" } }),
    prisma.location.count(),
    prisma.user.count(),
    prisma.contact.count(),
    prisma.order.count(),
    prisma.connectMember.count(),
    prisma.connectPost.count(),
    prisma.agency.findMany({
      orderBy: { createdAt: "desc" },
      take: 8,
      include: { _count: { select: { locations: true, users: true } } },
    }),
  ]);

  const stats = [
    { label: "Businesses", value: agencies, sub: `${suspended} suspended` },
    { label: "Sub-accounts", value: locations },
    { label: "Users", value: users },
    { label: "Contacts", value: contacts },
    { label: "Orders", value: orders },
    { label: "Connect members", value: members, sub: `${posts} posts` },
  ];

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold text-slate-900">Platform overview</h1>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
        {stats.map((s) => (
          <div key={s.label} className="rounded-xl border border-slate-200 bg-white p-4">
            <div className="text-2xl font-bold text-slate-900">{s.value}</div>
            <div className="text-xs uppercase tracking-wide text-slate-500">{s.label}</div>
            {s.sub ? <div className="mt-0.5 text-xs text-slate-400">{s.sub}</div> : null}
          </div>
        ))}
      </div>

      <div className="mt-6 flex flex-wrap gap-2">
        <Link href="/admin/connect" className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:border-brand-300 hover:text-brand-700">◎ Placid Connect moderation →</Link>
      </div>

      <div className="mt-8">
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Newest businesses</h2>
          <Link href="/admin/businesses" className="text-sm text-brand-600 hover:underline">View all →</Link>
        </div>
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
          {recent.map((a) => (
            <Link key={a.id} href={`/admin/businesses/${a.id}`} className="flex items-center justify-between border-b border-slate-100 px-4 py-3 last:border-0 hover:bg-slate-50">
              <div>
                <div className="text-sm font-medium text-slate-800">{a.name}</div>
                <div className="text-xs text-slate-500">{a._count.locations} sub-accounts · {a._count.users} users · joined {formatDate(a.createdAt)}</div>
              </div>
              <span className={`badge ${a.status === "SUSPENDED" ? "bg-red-100 text-red-700" : "bg-green-100 text-green-700"}`}>
                {a.status.toLowerCase()}
              </span>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
