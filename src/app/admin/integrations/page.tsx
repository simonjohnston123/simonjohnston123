import { requireSuperAdmin } from "@/lib/auth";
import { getSetting, SETTING_KEYS } from "@/lib/platform-settings";
import { isConfiguredAsync } from "@/lib/oauth-providers";
import { EbayCertForm } from "./integrations-form";

export const dynamic = "force-dynamic";
export const metadata = { title: "Admin — Integrations" };

export default async function AdminIntegrationsPage() {
  await requireSuperAdmin();
  const [cert, ebayReady] = await Promise.all([
    getSetting(SETTING_KEYS.ebayClientSecret),
    isConfiguredAsync("EBAY"),
  ]);

  return (
    <div className="max-w-xl">
      <h1 className="mb-1 text-2xl font-bold text-slate-900">Integrations</h1>
      <p className="mb-6 text-sm text-slate-500">
        Platform-level credentials for marketplace connectors. Once set, every business can connect their own account
        from their Integrations tab.
      </p>

      <div className={`mb-6 rounded-xl border p-4 ${ebayReady ? "border-green-200 bg-green-50" : "border-amber-200 bg-amber-50"}`}>
        <p className={`text-sm font-medium ${ebayReady ? "text-green-800" : "text-amber-800"}`}>
          {ebayReady ? "● eBay is connectable — businesses can link their eBay account." : "● eBay is not connectable yet — add the Cert ID below."}
        </p>
        <p className="mt-1 text-xs text-slate-500">The App ID + RuName are already set on the server; only the Cert ID (secret) is needed here.</p>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-5">
        <EbayCertForm certSet={Boolean(cert)} />
      </div>
    </div>
  );
}
