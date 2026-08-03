"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireLocationAccess } from "@/lib/auth";
import { buyReceptionistNumber, twilioReady } from "@/lib/twilio";
import { decide, type Turn } from "@/lib/voice";

function e164(raw: string): string | null {
  const t = raw.trim().replace(/[\s()-]/g, "");
  if (!t) return null;
  if (/^\+\d{7,15}$/.test(t)) return t;
  if (/^0\d{8,9}$/.test(t)) return "+61" + t.slice(1); // AU local → E.164
  return null;
}

export async function saveVoiceAgentAction(formData: FormData) {
  const locationId = String(formData.get("locationId") ?? "");
  await requireLocationAccess(locationId);

  const phoneRaw = String(formData.get("phoneNumber") ?? "");
  const transferRaw = String(formData.get("transferTo") ?? "");
  const data = {
    enabled: formData.get("enabled") != null,
    phoneNumber: e164(phoneRaw), // null clears it
    greeting: String(formData.get("greeting") ?? "").trim().slice(0, 500) || null,
    hours: String(formData.get("hours") ?? "").trim().slice(0, 200) || null,
    knowledge: String(formData.get("knowledge") ?? "").trim().slice(0, 4000) || null,
    transferTo: e164(transferRaw),
    voice: ["Polly.Olivia-Neural", "Polly.Russell", "Polly.Aria-Neural"].includes(String(formData.get("voice"))) ? String(formData.get("voice")) : "Polly.Olivia-Neural",
  };

  await prisma.voiceAgent.upsert({
    where: { locationId },
    create: { locationId, ...data },
    update: data,
  });
  revalidatePath(`/dashboard/l/${locationId}/receptionist`);
}

export type PracticeResult = { say?: string; action?: string; error?: string };

/** Practice-call turn: run the SAME brain the phone uses, in a chat panel, so
 *  the owner can hear how it answers and train it. */
export async function practiceTurnAction(locationId: string, transcript: { role: "caller" | "ai"; text: string }[]): Promise<PracticeResult> {
  await requireLocationAccess(locationId);
  try {
    const turns: Turn[] = transcript.slice(-16).map((t) => ({ role: t.role, text: String(t.text).slice(0, 600), at: new Date().toISOString() }));
    const d = await decide(locationId, turns);
    return { say: d.say, action: d.action };
  } catch (e) {
    return { error: String(e instanceof Error ? e.message : e).slice(0, 160) };
  }
}

/** Save a correction permanently into the receptionist's knowledge. */
export async function teachReceptionistAction(locationId: string, callerAsked: string, correction: string): Promise<{ ok?: true; error?: string }> {
  await requireLocationAccess(locationId);
  const note = correction.trim().slice(0, 600);
  if (!note) return { error: "Write what it should say/know." };
  const agent = await prisma.voiceAgent.findUnique({ where: { locationId } });
  const line = `\nTRAINING${callerAsked ? ` (when asked: "${callerAsked.trim().slice(0, 120)}")` : ""}: ${note}`;
  const knowledge = ((agent?.knowledge ?? "") + line).slice(-4000); // keep the newest 4k chars
  await prisma.voiceAgent.upsert({
    where: { locationId },
    create: { locationId, knowledge },
    update: { knowledge },
  });
  revalidatePath(`/dashboard/l/${locationId}/receptionist`);
  return { ok: true };
}

export type ActivateResult = { ok?: true; number?: string; error?: string };

/** One-click activation: buy a number under the platform's master account,
 *  point it at the receptionist webhooks, and start metering. */
export async function activateReceptionistAction(locationId: string): Promise<ActivateResult> {
  await requireLocationAccess(locationId);
  if (!twilioReady()) return { error: "The phone platform isn't connected yet — the platform owner is finishing setup." };

  const existing = await prisma.voiceAgent.findUnique({ where: { locationId } });
  if (existing?.phoneNumber) return { ok: true, number: existing.phoneNumber };

  const location = await prisma.location.findUnique({ where: { id: locationId }, select: { name: true } });
  try {
    const { number } = await buyReceptionistNumber(`${location?.name ?? "Business"} AI Receptionist`);
    await prisma.voiceAgent.upsert({
      where: { locationId },
      create: { locationId, phoneNumber: number, enabled: true },
      update: { phoneNumber: number, enabled: true },
    });
    // Ledger: number activation (rental is rolled up monthly).
    const setupCents = parseInt(process.env.NUMBER_SETUP_CENTS ?? "", 10) || 0;
    if (setupCents > 0) {
      await prisma.usageEvent.create({ data: { locationId, kind: "number_setup", qty: 1, unitCents: setupCents, totalCents: setupCents, ref: number } }).catch(() => {});
    }
    revalidatePath(`/dashboard/l/${locationId}/receptionist`);
    return { ok: true, number };
  } catch (e) {
    return { error: String(e instanceof Error ? e.message : e).slice(0, 200) };
  }
}
