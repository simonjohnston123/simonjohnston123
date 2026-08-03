import { prisma } from "@/lib/db";
import { xml, sayGather, sayTransfer, sayBye, decide, validTwilioSignature, formParams, type Turn } from "@/lib/voice";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// One conversational turn: Twilio posts the caller's speech, Claude decides the
// reply and whether to keep talking, transfer, or wrap up.
export async function POST(req: Request) {
  const params = await formParams(req);
  const base = process.env.APP_URL || "https://placidcrm.com";
  if (!validTwilioSignature(`${base}/api/voice/gather`, params, req.headers.get("x-twilio-signature"))) {
    return new Response("forbidden", { status: 403 });
  }

  const callSid = params.CallSid ?? "";
  const speech = (params.SpeechResult ?? "").trim();
  const call = callSid ? await prisma.callLog.findUnique({ where: { callSid } }) : null;
  if (!call) return xml(sayBye("Polly.Olivia-Neural", "Sorry, something went wrong on our end. Please call back."));

  const agent = await prisma.voiceAgent.findUnique({ where: { locationId: call.locationId } });
  const voice = agent?.voice ?? "Polly.Olivia-Neural";
  const transcript = ((call.transcript as Turn[]) ?? []).slice(-40);
  if (speech) transcript.push({ role: "caller", text: speech.slice(0, 600), at: new Date().toISOString() });

  const d = await decide(call.locationId, transcript);
  const aiTurn: Turn & { note?: string } = { role: "ai", text: d.say, at: new Date().toISOString() };
  if (d.note) aiTurn.note = d.note;
  transcript.push(aiTurn);

  const wantTransfer = d.action === "transfer" && !!agent?.transferTo;
  await prisma.callLog.update({
    where: { callSid },
    data: { transcript, ...(wantTransfer ? { status: "transferred" } : {}) },
  });

  if (wantTransfer) return xml(sayTransfer(voice, d.say, agent!.transferTo!));
  if (d.action === "end") return xml(sayBye(voice, d.say));
  return xml(sayGather(voice, d.say, `${base}/api/voice/gather`));
}
