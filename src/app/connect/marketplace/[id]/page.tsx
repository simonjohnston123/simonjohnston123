import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { getCurrentMember } from "@/lib/connect-auth";
import { markSoldAction, deleteListingAction } from "../actions";

export const dynamic = "force-dynamic";
const money = (n: number) => (n === 0 ? "Free" : `$${n.toLocaleString()}`);

export default async function ListingDetail({ params }: { params: { id: string } }) {
  const [listing, viewer] = await Promise.all([
    prisma.connectListing.findUnique({ where: { id: params.id }, include: { seller: true } }),
    getCurrentMember(),
  ]);
  if (!listing) notFound();
  const isOwner = viewer?.id === listing.sellerId;

  return (
    <main className="mx-auto grid max-w-4xl gap-5 px-4 py-6 md:grid-cols-[1.3fr_1fr]">
      <div className="overflow-hidden rounded-2xl bg-white shadow-sm">
        {listing.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={listing.imageUrl} alt={listing.title} className="w-full object-cover" />
        ) : <div className="grid h-72 w-full place-items-center bg-slate-100 text-5xl text-slate-300">🛍</div>}
      </div>
      <div>
        <div className="rounded-2xl bg-white p-5 shadow-sm">
          {listing.status === "SOLD" ? <span className="mb-2 inline-block rounded bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-700">SOLD</span> : null}
          <h1 className="text-2xl font-bold text-slate-900">{money(listing.price)}</h1>
          <div className="text-lg text-slate-800">{listing.title}</div>
          <div className="mt-1 text-xs text-slate-400">{[listing.category, listing.condition, listing.location].filter(Boolean).join(" · ")}</div>
          <p className="mt-4 whitespace-pre-line text-sm text-slate-700">{listing.description}</p>

          <div className="mt-5 flex items-center gap-3 border-t border-slate-100 pt-4">
            <span className="grid h-10 w-10 place-items-center rounded-full bg-brand-gradient font-semibold text-white">{listing.seller.name.slice(0, 1).toUpperCase()}</span>
            <div><div className="text-sm font-semibold text-slate-800">{listing.seller.name}</div><Link href={`/connect/u/${listing.seller.handle}`} className="text-xs text-brand-600">@{listing.seller.handle}</Link></div>
          </div>

          {isOwner ? (
            <div className="mt-4 flex gap-2">
              <form action={markSoldAction} className="flex-1"><input type="hidden" name="id" value={listing.id} /><button className="w-full rounded-lg border border-slate-200 py-2 text-sm font-semibold text-slate-700">{listing.status === "SOLD" ? "Mark available" : "Mark sold"}</button></form>
              <form action={deleteListingAction}><input type="hidden" name="id" value={listing.id} /><button className="rounded-lg bg-red-50 px-3 py-2 text-sm font-semibold text-red-700">Delete</button></form>
            </div>
          ) : viewer ? (
            <Link href={`/connect/u/${listing.seller.handle}`} className="mt-4 block rounded-lg bg-brand-gradient py-2.5 text-center text-sm font-semibold text-white">Message seller</Link>
          ) : (
            <Link href="/connect/join" className="mt-4 block rounded-lg bg-brand-gradient py-2.5 text-center text-sm font-semibold text-white">Join to contact seller</Link>
          )}
        </div>
        <Link href="/connect/marketplace" className="mt-3 block text-center text-sm text-slate-500 hover:text-slate-800">← Back to marketplace</Link>
      </div>
    </main>
  );
}
