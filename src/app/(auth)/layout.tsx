import Link from "next/link";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-900 px-4 py-12">
      <div className="w-full max-w-md">
        <Link href="/" className="mb-8 block text-center text-2xl font-bold tracking-tight text-white">
          Placid<span className="text-brand-400">CRM</span>
        </Link>
        <div className="card p-8">{children}</div>
      </div>
    </div>
  );
}
