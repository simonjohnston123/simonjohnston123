/**
 * Lightweight AI helpers via the Anthropic REST API (no SDK to keep the Docker
 * build clean). Every helper degrades gracefully to a deterministic heuristic
 * when ANTHROPIC_API_KEY isn't configured, so features work out of the box.
 */

const API_URL = "https://api.anthropic.com/v1/messages";
const MODEL = process.env.ANTHROPIC_MODEL || "claude-3-5-haiku-latest";

export function aiEnabled(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

async function complete(prompt: string, maxTokens = 400): Promise<string | null> {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return null;
  try {
    const res = await fetch(API_URL, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": key,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: maxTokens,
        messages: [{ role: "user", content: prompt }],
      }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    const text = Array.isArray(data?.content)
      ? data.content.map((b: { text?: string }) => b?.text ?? "").join("")
      : "";
    return text.trim() || null;
  } catch {
    return null;
  }
}

/**
 * Suggest an ordered list of pipeline stage names for a business/sales process.
 * Returns 4–8 short stage names.
 */
export async function generatePipelineStages(description: string): Promise<string[]> {
  const prompt =
    `You are a CRM expert. A business describes their sales or client process below. ` +
    `Return ONLY a JSON array of 4 to 7 short pipeline stage names (2-3 words each), ` +
    `ordered from first contact to closed/won. No prose, no markdown, just the JSON array.\n\n` +
    `Business/process: ${description}`;

  const raw = await complete(prompt, 300);
  const parsed = raw ? parseStringArray(raw) : null;
  if (parsed && parsed.length >= 2) return parsed.slice(0, 8);

  return heuristicStages(description);
}

function parseStringArray(raw: string): string[] | null {
  const match = raw.match(/\[[\s\S]*\]/);
  if (!match) return null;
  try {
    const arr = JSON.parse(match[0]);
    if (Array.isArray(arr)) {
      return arr.map((s) => String(s).trim()).filter(Boolean);
    }
  } catch {
    /* fall through */
  }
  return null;
}

/** Keyword-based fallback so pipeline generation works with no API key. */
function heuristicStages(description: string): string[] {
  const d = description.toLowerCase();
  if (/storage|yard|unit|container|self.?storage/.test(d))
    return ["Enquiry", "Quote Sent", "Booked", "Moved In", "Active"];
  if (/disab|ndis|support|care|participant/.test(d))
    return ["Referral", "Intake", "Assessment", "Service Agreement", "Onboarded", "Active"];
  if (/driv|lesson|instructor|student|school/.test(d))
    return ["Enquiry", "Booked Lesson", "Learning", "Test Ready", "Passed"];
  if (/real ?estate|property|listing|tenant|rent/.test(d))
    return ["New Lead", "Inspection", "Application", "Approved", "Leased"];
  if (/shop|store|ecom|retail|product|order/.test(d))
    return ["New Lead", "Cart", "Checkout", "Paid", "Fulfilled"];
  return ["New Lead", "Contacted", "Qualified", "Quote Sent", "Won"];
}
