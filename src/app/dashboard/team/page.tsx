import Link from "next/link";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { PageHeader, Badge } from "@/components/ui";
import { AddUserButton } from "@/components/add-user";
import { grantAccessAction, revokeAccessAction, removeUserAction } from "./actions";
import { initials } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function TeamPage() {
  const me = await requireUser();
  if (me.globalRole !== "SUPER_ADMIN") redirect("/dashboard");

  const [users, locations] = await Promise.all([
    prisma.user.findMany({
      where: { agencyId: me.agencyId },
      include: { memberships: { include: { location: true } } },
      orderBy: { createdAt: "asc" },
    }),
    prisma.location.findMany({ where: { agencyId: me.agencyId }, orderBy: { createdAt: "asc" } }),
  ]);

  return (
    <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
      <Link href="/dashboard" className="mb-3 inline-block text-xs font-medium text-slate-400 hover:text-slate-600">
        ← All businesses
      </Link>
      <PageHeader
        title="Team"
        subtitle="Add people and control which businesses they can access"
        action={<AddUserButton />}
      />

      <div className="space-y-4">
        {users.map((u) => {
          const memberLocationIds = new Set(u.memberships.map((m) => m.locationId));
          const available = locations.filter((l) => !memberLocationIds.has(l.id));
          return (
            <div key={u.id} className="card p-5">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-600 text-sm font-semibold text-white">
                    {initials(u.name.split(" ")[0], u.name.split(" ")[1], u.name.charAt(0))}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-slate-900">{u.name}</span>
                      {u.globalRole === "SUPER_ADMIN" ? <Badge color="amber">Owner</Badge> : <Badge>Member</Badge>}
                      {u.id === me.id ? <span className="text-xs text-slate-400">(you)</span> : null}
                    </div>
                    <div className="text-sm text-slate-500">{u.email}</div>
                  </div>
                </div>
                {u.id !== me.id ? (
                  <form action={removeUserAction}>
                    <input type="hidden" name="userId" value={u.id} />
                    <button className="btn-ghost text-sm text-red-600 hover:bg-red-50">Remove</button>
                  </form>
                ) : null}
              </div>

              <div className="mt-4 border-t border-slate-100 pt-4">
                <div className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-400">Sub-account access</div>
                {u.globalRole === "SUPER_ADMIN" ? (
                  <p className="text-sm text-slate-500">Owner — full access to every business.</p>
                ) : (
                  <>
                    <div className="flex flex-wrap gap-2">
                      {u.memberships.length === 0 ? (
                        <span className="text-sm text-slate-400">No access yet</span>
                      ) : (
                        u.memberships.map((m) => (
                          <span key={m.id} className="badge bg-slate-100 text-slate-700">
                            {m.location.name} · {m.role}
                            <form action={revokeAccessAction} className="ml-1 inline">
                              <input type="hidden" name="userId" value={u.id} />
                              <input type="hidden" name="locationId" value={m.locationId} />
                              <button className="ml-1 text-slate-400 hover:text-red-600" aria-label="Revoke">×</button>
                            </form>
                          </span>
                        ))
                      )}
                    </div>
                    {available.length > 0 ? (
                      <form action={grantAccessAction} className="mt-3 flex flex-wrap gap-2">
                        <input type="hidden" name="userId" value={u.id} />
                        <select name="locationId" className="input max-w-[220px] text-sm">
                          {available.map((l) => (
                            <option key={l.id} value={l.id}>{l.name}</option>
                          ))}
                        </select>
                        <select name="role" className="input max-w-[140px] text-sm">
                          <option value="ADMIN">Admin</option>
                          <option value="MEMBER">Member</option>
                        </select>
                        <button className="btn-secondary text-sm">Grant access</button>
                      </form>
                    ) : null}
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </main>
  );
}
