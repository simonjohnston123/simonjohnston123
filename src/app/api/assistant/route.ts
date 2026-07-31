import { NextRequest, NextResponse } from "next/server";
import { requireLocationAccess } from "@/lib/auth";
import { runAssistant, type AssistantMessage } from "@/lib/assistant";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  let body: { locationId?: string; messages?: AssistantMessage[] };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }
  const locationId = String(body.locationId ?? "");
  if (!locationId) return NextResponse.json({ error: "locationId required" }, { status: 400 });

  // Enforces auth + that the user can access this business.
  await requireLocationAccess(locationId);

  const history = Array.isArray(body.messages)
    ? body.messages
        .filter((m) => m && (m.role === "user" || m.role === "assistant") && typeof m.content === "string")
        .map((m) => ({ role: m.role, content: m.content.slice(0, 4000) }))
    : [];
  if (history.length === 0) return NextResponse.json({ error: "no messages" }, { status: 400 });

  const result = await runAssistant(locationId, history);
  return NextResponse.json(result);
}
