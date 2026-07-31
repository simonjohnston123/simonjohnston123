import { requireSuperAdmin } from "@/lib/auth";
import { getSetting, SETTING_KEYS } from "@/lib/platform-settings";
import { AiForm } from "./ai-form";

export const dynamic = "force-dynamic";
export const metadata = { title: "Admin — AI" };

export default async function AdminAiPage() {
  await requireSuperAdmin();
  const key = await getSetting(SETTING_KEYS.anthropicApiKey);
  const live = Boolean(key || process.env.ANTHROPIC_API_KEY);

  return (
    <div className="max-w-xl">
      <h1 className="mb-1 text-2xl font-bold text-slate-900">AI</h1>
      <p className="mb-6 text-sm text-slate-500">
        Connect Claude to power the in-CRM setup assistant (each business can build their Success Tracks, stages,
        automations and folders by chatting) and AI drafting.
      </p>

      <div className={`mb-6 rounded-xl border p-4 ${live ? "border-green-200 bg-green-50" : "border-amber-200 bg-amber-50"}`}>
        <p className={`text-sm font-medium ${live ? "text-green-800" : "text-amber-800"}`}>
          {live ? "● AI is connected." : "● AI is not connected — add a key below to switch on the assistant."}
        </p>
        <p className="mt-1 text-xs text-slate-500">
          Note: the assistant also needs the Anthropic account to have credit. If replies fail with a credit error,
          top up at console.anthropic.com → Billing.
        </p>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-5">
        <AiForm keySet={Boolean(key)} />
      </div>
    </div>
  );
}
