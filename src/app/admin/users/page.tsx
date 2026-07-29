import Link from "next/link";
import { prisma } from "@/lib/db";
import { formatDate } from "@/lib/utils";

export const dynamic = "force-dynamic";
export const metadata = { title: "Admin — Users" };

export default async function AdminUsers() {
  const users = await prisma.user.findMany({
    orderBy: { createdAt: "desc" },
    include: { agency: { select: { id: true, name: true, status: true } }, _count: { select: { memberships: true } } },
    take: 500,
  });

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold text-slate-900">Users ({users.length})</h1>
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-100 text-left text-xs uppercase tracking-wide text-slate-400">
              <th className="px-4 py-2.5">User</th>
              <th className="px-4 py-2.5">Business</th>
              <th className="px-4 py-2.5">Role</th>
              <th className="px-4 py-2.5 text-center">Sub-accts</th>
              <th className="px-4 py-2.5">Joined</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {users.map((u) => (
              <tr key={u.id} className="hover:bg-slate-50">
                <td className="px-4 py-3">
                  <div className="font-medium text-slate-800">{u.name}</div>
                  <div className="text-xs text-slate-500">{u.email}</div>
                </td>
                <td className="px-4 py-3">
                  <Link href={`/admin/businesses/${u.agency.id}`} className="text-slate-600 hover:text-brand-700">{u.agency.name}</Link>
                </td>
                <td className="px-4 py-3">
                  <span className="badge bg-slate-100 text-slate-600">{u.globalRole === "SUPER_ADMIN" ? "owner" : "user"}</span>
                </td>
                <td className="px-4 py-3 text-center text-slate-600">{u._count.memberships}</td>
                <td className="px-4 py-3 text-slate-500">{formatDate(u.createdAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
