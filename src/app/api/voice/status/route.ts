import { finalizeCall, validTwilioSignature, formParams } from "@/lib/voice";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Twilio status callback — set this as the number's "Call status changes" URL.
// On completion we file the transcript into the inbox and create the lead/task.
export async function POST(req: Request) {
  const params = await formParams(req);
  const base = process.env.APP_URL || "https://placidcrm.com";
  if (!validTwilioSignature(`${base}/api/voice/status`, params, req.headers.get("x-twilio-signature"))) {
    return new Response("forbidden", { status: 403 });
  }

  const status = params.CallStatus ?? "";
  const callSid = params.CallSid ?? "";
  if (callSid && ["completed", "busy", "failed", "no-answer", "canceled"].includes(status)) {
    const dur = parseInt(params.CallDuration ?? "", 10);
    await finalizeCall(callSid, Number.isFinite(dur) ? dur : null).catch(() => {});
  }
  return new Response("ok");
}
