import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { BookingForm } from "./booking-form";

export const dynamic = "force-dynamic";
export const metadata = { title: "Book a room" };

export default async function BookRoom({ params, searchParams }: { params: { slug: string }; searchParams: { room?: string } }) {
  const location = await prisma.location.findUnique({ where: { slug: params.slug } });
  if (!location) notFound();
  const room = await prisma.homesteadRoom.findFirst({ where: { id: searchParams.room ?? "", locationId: location.id, active: true } });
  if (!room) notFound();
  const settings = await prisma.homesteadSettings.findUnique({ where: { locationId: location.id } });

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-brand-gradient px-6 py-6 text-white"><div className="mx-auto max-w-2xl"><h1 className="text-2xl font-bold">Book {room.name}</h1><p className="text-white/85">{location.name} · ${room.weeklyPrice.toLocaleString()}/week</p></div></header>
      <main className="mx-auto max-w-2xl px-6 py-6">
        <BookingForm
          slug={params.slug}
          roomId={room.id}
          weeklyPrice={room.weeklyPrice}
          depositWeeks={settings?.depositWeeks ?? 1}
          houseRules={settings?.houseRules ?? ""}
          contractText={settings?.contractText ?? ""}
        />
      </main>
    </div>
  );
}
