import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { formatDate } from "@/lib/utils";

export const dynamic = "force-dynamic";
export const metadata = { title: "Booking confirmed" };

export default async function Welcome({ params }: { params: { slug: string; bookingId: string } }) {
  const location = await prisma.location.findUnique({ where: { slug: params.slug } });
  if (!location) notFound();
  const booking = await prisma.homesteadBooking.findFirst({ where: { id: params.bookingId, locationId: location.id }, include: { room: true } });
  if (!booking) notFound();
  const settings = await prisma.homesteadSettings.findUnique({ where: { locationId: location.id } });

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-brand-gradient px-6 py-8 text-white"><div className="mx-auto max-w-2xl"><h1 className="text-2xl font-bold">You&rsquo;re booked in 🎉</h1><p className="text-white/85">{location.name}</p></div></header>
      <main className="mx-auto max-w-2xl space-y-4 px-6 py-8">
        <div className="rounded-2xl bg-white p-6 shadow-sm">
          <p className="text-sm text-slate-600">Thanks {booking.guestName.split(" ")[0]} — your request for <b>{booking.room?.name}</b> from <b>{formatDate(booking.startDate)}</b> is in.</p>
          <p className="mt-2 text-sm text-slate-600">The host will confirm shortly and set up your <b>${booking.weeklyPrice.toLocaleString()}/week</b> payment. We&rsquo;ve emailed a copy to {booking.guestEmail}.</p>
        </div>
        {settings?.welcomeInfo ? (
          <div className="rounded-2xl bg-white p-6 shadow-sm"><h2 className="mb-2 font-semibold text-slate-900">Getting there &amp; settling in</h2><p className="whitespace-pre-line text-sm text-slate-600">{settings.welcomeInfo}</p></div>
        ) : null}
        {settings?.houseRules ? (
          <div className="rounded-2xl bg-white p-6 shadow-sm"><h2 className="mb-2 font-semibold text-slate-900">House rules</h2><p className="whitespace-pre-line text-sm text-slate-600">{settings.houseRules}</p></div>
        ) : null}
      </main>
    </div>
  );
}
