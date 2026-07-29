import Link from "next/link";
import { prisma } from "@/lib/db";
import { formatDate } from "@/lib/utils";

export const dynamic = "force-dynamic";
export const metadata = { title: "Admin — Businesses" };

export default async function AdminBusinesses() {
  const agencies = await prisma.agency.findMany({
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { locations: true, users: true } } },
  });

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold text-slate-900">Businesses ({agencies.length})</h1>
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-100 text-left text-xs uppercase tracking-wide text-slate-400">
              <th className="px-4 py-2.5">Business</th>
              <th className="px-4 py-2.5">Plan</th>
              <th className="px-4 py-2.5 text-center">Sub-accts</th>
              <th className="px-4 py-2.5 text-center">Users</th>
              <th className="px-4 py-2.5">Joined</th>
              <th className="px-4 py-2.5 text-right">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {agencies.map((a) => (
              <tr key={a.id} className="hover:bg-slate-50">
                <td className="px-4 py-3">
                  <Link href={`/admin/businesses/${a.id}`} className="font-medium text-slate-800 hover:text-brand-700">{a.name}</Link>
                </td>
                <td className="px-4 py-3 text-slate-500">{a.plan}</td>
                <td className="px-4 py-3 text-center text-slate-600">{a._count.locations}</td>
                <td className="px-4 py-3 text-center text-slate-600">{a._count.users}</td>
                <td className="px-4 py-3 text-slate-500">{formatDate(a.createdAt)}</td>
                <td className="px-4 py-3 text-right">
                  <span className={`badge ${a.status === "SUSPENDED" ? "bg-red-100 text-red-700" : "bg-green-100 text-green-700"}`}>{a.status.toLowerCase()}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
