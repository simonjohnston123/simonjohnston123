import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function ThanksPage({ params }: { params: { slug: string } }) {
  const location = await prisma.location.findUnique({ where: { slug: params.slug }, include: { site: true } });
  if (!location) notFound();
  const primary = location.site?.primaryColor || "#1d5df5";

  return (
    <main className="grid min-h-screen place-items-center bg-slate-50 px-4">
      <div className="max-w-md text-center">
        <div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-emerald-100 text-2xl">✓</div>
        <h1 className="mt-5 text-2xl font-bold text-slate-900">Thanks — your order is in.</h1>
        <p className="mt-3 text-slate-600">
          A receipt is on its way to your email. We&apos;ll send tracking as soon as it ships.
        </p>
        <Link href={`/shop/${location.slug}`} className="mt-6 inline-block rounded-xl px-5 py-2.5 text-sm font-semibold text-white" style={{ backgroundColor: primary }}>
          Keep shopping
        </Link>
      </div>
    </main>
  );
}
