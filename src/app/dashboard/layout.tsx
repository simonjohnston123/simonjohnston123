import { requireUser } from "@/lib/auth";
import { TopBar } from "@/components/top-bar";

export const dynamic = "force-dynamic";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  return (
    <div className="min-h-screen bg-slate-50">
      <TopBar userName={user.name} userEmail={user.email} />
      {children}
    </div>
  );
}
