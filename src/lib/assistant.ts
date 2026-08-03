import "server-only";
import { prisma } from "@/lib/db";
import { getSetting, SETTING_KEYS } from "@/lib/platform-settings";

// In-CRM AI copilot. Claude with tools it actually executes against THIS
// business's data (scoped by locationId) — so a business owner can design their
// Success Tracks, stages, stage automations and inbox folders by chatting.

const API_URL = "https://api.anthropic.com/v1/messages";
const MODEL = process.env.ANTHROPIC_MODEL || "claude-haiku-4-5-20251001";
const MAX_TURNS = 6;

async function anthropicKey(): Promise<string | null> {
  return (await getSetting(SETTING_KEYS.anthropicApiKey)) || process.env.ANTHROPIC_API_KEY || null;
}

export async function assistantEnabled(): Promise<boolean> {
  return Boolean(await anthropicKey());
}

const STAGE_ACTION_TYPES = ["SEND_EMAIL", "SEND_SMS", "ADD_TAG", "CREATE_TASK"];

const TOOLS = [
  {
    name: "list_success_tracks",
    description: "List the business's existing Success Tracks (sales/customer journeys) with their stages. Call this first if you need to know what already exists.",
    input_schema: { type: "object", properties: {} },
  },
  {
    name: "create_success_track",
    description: "Create a new Success Track (a customer journey / sales pipeline) with ordered stages.",
    input_schema: {
      type: "object",
      properties: {
        name: { type: "string", description: "Track name, e.g. 'Sales' or 'Freight quotes'" },
        stages: { type: "array", items: { type: "string" }, description: "Ordered stage names, first to last (3-6 stages)" },
      },
      required: ["name", "stages"],
    },
  },
  {
    name: "add_stage",
    description: "Add one stage to the end of an existing Success Track.",
    input_schema: {
      type: "object",
      properties: {
        track_name: { type: "string" },
        stage_name: { type: "string" },
      },
      required: ["track_name", "stage_name"],
    },
  },
  {
    name: "add_stage_action",
    description: "Add an automation that fires when a deal enters a stage. type is one of SEND_EMAIL, SEND_SMS, ADD_TAG, CREATE_TASK. For SEND_EMAIL pass subject+body; SEND_SMS pass body; ADD_TAG pass tag; CREATE_TASK pass title. You may use {{first_name}} in messages.",
    input_schema: {
      type: "object",
      properties: {
        track_name: { type: "string" },
        stage_name: { type: "string" },
        type: { type: "string", enum: STAGE_ACTION_TYPES },
        subject: { type: "string" },
        body: { type: "string" },
        tag: { type: "string" },
        title: { type: "string" },
      },
      required: ["track_name", "stage_name", "type"],
    },
  },
  {
    name: "create_inbox_folder",
    description: "Create an inbox folder that auto-files email. match_field is SENDER or SUBJECT; match_value is a substring, e.g. 'ebay'.",
    input_schema: {
      type: "object",
      properties: {
        name: { type: "string" },
        match_field: { type: "string", enum: ["SENDER", "SUBJECT"] },
        match_value: { type: "string" },
      },
      required: ["name", "match_value"],
    },
  },
];

const SYSTEM = (businessName: string) =>
  `You are the Placid Connect setup assistant for the business "${businessName}". ` +
  `You help the owner build their CRM by CALLING TOOLS — creating Success Tracks (customer journeys / sales pipelines) with stages, ` +
  `adding stage automations, and inbox folders. When asked to set something up, DO IT via the tools rather than only describing it. ` +
  `Create a track before adding stage actions to it. After acting, confirm briefly and warmly what you did (1-3 sentences). ` +
  `If a request is ambiguous, make sensible choices and proceed rather than asking lots of questions. Keep replies concise.`;

type Track = { id: string; name: string; stages: { id: string; name: string }[] };
async function loadTracks(locationId: string): Promise<Track[]> {
  const ps = await prisma.pipeline.findMany({
    where: { locationId },
    include: { stages: { orderBy: { position: "asc" }, select: { id: true, name: true } } },
    orderBy: { createdAt: "asc" },
  });
  return ps.map((p) => ({ id: p.id, name: p.name, stages: p.stages }));
}
function findTrack(tracks: Track[], name: string): Track | undefined {
  const n = name.trim().toLowerCase();
  return tracks.find((t) => t.name.toLowerCase() === n) || tracks.find((t) => t.name.toLowerCase().includes(n));
}
function findStage(track: Track, name: string) {
  const n = name.trim().toLowerCase();
  return track.stages.find((s) => s.name.toLowerCase() === n) || track.stages.find((s) => s.name.toLowerCase().includes(n));
}

async function execTool(
  locationId: string,
  name: string,
  input: Record<string, unknown>,
  actions: string[],
): Promise<string> {
  try {
    if (name === "list_success_tracks") {
      const tracks = await loadTracks(locationId);
      return JSON.stringify(tracks.map((t) => ({ name: t.name, stages: t.stages.map((s) => s.name) })));
    }
    if (name === "create_success_track") {
      const trackName = String(input.name ?? "").trim();
      const stages = Array.isArray(input.stages) ? input.stages.map((s) => String(s).trim()).filter(Boolean) : [];
      if (!trackName || stages.length === 0) return "error: need a name and at least one stage";
      await prisma.pipeline.create({
        data: { locationId, name: trackName, stages: { create: stages.map((n, i) => ({ name: n, position: i })) } },
      });
      actions.push(`Created track “${trackName}” (${stages.join(" → ")})`);
      return `created track "${trackName}" with stages ${stages.join(", ")}`;
    }
    if (name === "add_stage") {
      const tracks = await loadTracks(locationId);
      const track = findTrack(tracks, String(input.track_name ?? ""));
      if (!track) return "error: track not found";
      const last = await prisma.pipelineStage.findFirst({ where: { pipelineId: track.id }, orderBy: { position: "desc" } });
      const stageName = String(input.stage_name ?? "").trim();
      await prisma.pipelineStage.create({ data: { pipelineId: track.id, name: stageName, position: (last?.position ?? -1) + 1 } });
      actions.push(`Added stage “${stageName}” to ${track.name}`);
      return `added stage "${stageName}"`;
    }
    if (name === "add_stage_action") {
      const tracks = await loadTracks(locationId);
      const track = findTrack(tracks, String(input.track_name ?? ""));
      if (!track) return "error: track not found";
      const stage = findStage(track, String(input.stage_name ?? ""));
      if (!stage) return "error: stage not found in that track";
      const type = String(input.type ?? "");
      if (!STAGE_ACTION_TYPES.includes(type)) return "error: bad action type";
      const config: Record<string, string> = {};
      if (type === "SEND_EMAIL") { config.subject = String(input.subject ?? ""); config.body = String(input.body ?? ""); }
      else if (type === "SEND_SMS") config.body = String(input.body ?? "");
      else if (type === "ADD_TAG") config.tag = String(input.tag ?? "");
      else if (type === "CREATE_TASK") config.title = String(input.title ?? "");
      const last = await prisma.stageAction.findFirst({ where: { stageId: stage.id }, orderBy: { position: "desc" } });
      await prisma.stageAction.create({ data: { stageId: stage.id, type, config, position: (last?.position ?? -1) + 1 } });
      actions.push(`Added ${type.replace("_", " ").toLowerCase()} on “${stage.name}” (${track.name})`);
      return `added ${type} to stage "${stage.name}"`;
    }
    if (name === "create_inbox_folder") {
      const folderName = String(input.name ?? "").trim();
      const matchValue = String(input.match_value ?? "").trim();
      const matchField = String(input.match_field ?? "SENDER") === "SUBJECT" ? "SUBJECT" : "SENDER";
      if (!folderName || !matchValue) return "error: need name and match_value";
      const count = await prisma.inboxFolder.count({ where: { locationId } });
      await prisma.inboxFolder.create({ data: { locationId, name: folderName, matchField, matchValue, position: count } });
      actions.push(`Created inbox folder “${folderName}” (${matchField.toLowerCase()} contains “${matchValue}”)`);
      return `created folder "${folderName}"`;
    }
    return "error: unknown tool";
  } catch (e) {
    return `error: ${e instanceof Error ? e.message : "failed"}`;
  }
}

export type AssistantMessage = { role: "user" | "assistant"; content: string };

export async function runAssistant(
  locationId: string,
  history: AssistantMessage[],
): Promise<{ reply: string; actions: string[] }> {
  const key = await anthropicKey();
  if (!key) {
    return {
      reply: "The AI assistant isn't switched on yet — an admin needs to add a Claude API key in Admin → AI. Once it's in, I can build your Success Tracks, stages and automations for you.",
      actions: [],
    };
  }
  const location = await prisma.location.findUnique({ where: { id: locationId }, select: { name: true } });
  const businessName = location?.name || "your business";

  // Anthropic messages: text content passed as strings; tool turns as blocks.
  const messages: unknown[] = history.slice(-12).map((m) => ({ role: m.role, content: m.content }));
  const actions: string[] = [];

  for (let turn = 0; turn < MAX_TURNS; turn++) {
    let data: {
      content?: { type: string; text?: string; id?: string; name?: string; input?: Record<string, unknown> }[];
      stop_reason?: string;
    };
    try {
      const res = await fetch(API_URL, {
        method: "POST",
        headers: { "content-type": "application/json", "x-api-key": key, "anthropic-version": "2023-06-01" },
        body: JSON.stringify({ model: MODEL, max_tokens: 1200, system: SYSTEM(businessName), tools: TOOLS, messages }),
      });
      if (!res.ok) {
        const body = await res.text().catch(() => "");
        const hint = res.status === 400 && /credit|balance/i.test(body) ? " (the Claude account may be out of credit)" : "";
        return { reply: `Sorry — the AI request failed (${res.status})${hint}. An admin can check the Claude key/credit in Admin → AI.`, actions };
      }
      data = await res.json();
    } catch {
      return { reply: "Sorry — I couldn't reach the AI service just now. Try again in a moment.", actions };
    }

    const content = data.content ?? [];
    const toolUses = content.filter((b) => b.type === "tool_use");
    const text = content.filter((b) => b.type === "text").map((b) => b.text ?? "").join("").trim();

    if (data.stop_reason !== "tool_use" || toolUses.length === 0) {
      return { reply: text || (actions.length ? "Done." : "How can I help set up your account?"), actions };
    }

    messages.push({ role: "assistant", content });
    const results = [];
    for (const tu of toolUses) {
      const out = await execTool(locationId, tu.name ?? "", tu.input ?? {}, actions);
      results.push({ type: "tool_result", tool_use_id: tu.id, content: out });
    }
    messages.push({ role: "user", content: results });
  }

  return { reply: actions.length ? "All done — " + actions.join("; ") + "." : "That got complicated — could you try a simpler request?", actions };
}
