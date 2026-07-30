import Link from "next/link";
import { Logo } from "@/components/logo";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-ink-950 px-4 py-12">
      <div className="w-full max-w-md">
        <Link href="/" className="mb-8 flex justify-center">
          <Logo dark markClass="h-9 w-9" textClass="text-2xl" />
        </Link>
        <div className="card p-8">{children}</div>
      </div>
    </div>
  );
}
