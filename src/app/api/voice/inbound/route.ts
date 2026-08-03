import { prisma } from "@/lib/db";
import { xml, sayGather, sayBye, validTwilioSignature, formParams, type Turn } from "@/lib/voice";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Twilio Voice webhook — point every AI receptionist number here (POST).
// Maps the dialled number → that business's VoiceAgent and opens the call.
export async function POST(req: Request) {
  const params = await formParams(req);
  const base = process.env.APP_URL || "https://placidcrm.com";
  if (!validTwilioSignature(`${base}/api/voice/inbound`, params, req.headers.get("x-twilio-signature"))) {
    return new Response("forbidden", { status: 403 });
  }

  const to = params.To ?? "";
  const from = params.From || "anonymous";
  const callSid = params.CallSid ?? "";
  if (!callSid) return xml(`<Reject/>`);

  const agent = await prisma.voiceAgent.findFirst({ where: { phoneNumber: to } });
  if (!agent || !agent.enabled) {
    return xml(`<Say voice="Polly.Olivia-Neural">Sorry, this number isn't taking calls right now. Please try again later.</Say><Hangup/>`);
  }
  const location = await prisma.location.findUnique({ where: { id: agent.locationId }, select: { name: true } });

  const greeting =
    (agent.greeting ?? "").trim() ||
    `Thanks for calling ${location?.name ?? "us"}! I'm the receptionist — how can I help you today?`;

  const contact = from !== "anonymous"
    ? await prisma.contact.findFirst({ where: { locationId: agent.locationId, phone: from }, select: { id: true } })
    : null;

  const transcript: Turn[] = [{ role: "ai", text: greeting, at: new Date().toISOString() }];
  await prisma.callLog.upsert({
    where: { callSid },
    create: { callSid, locationId: agent.locationId, fromNumber: from, toNumber: to, transcript, contactId: contact?.id },
    update: {},
  });

  return xml(sayGather(agent.voice, greeting, `${base}/api/voice/gather`));
}
