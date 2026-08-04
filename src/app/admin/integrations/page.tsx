import { requireSuperAdmin } from "@/lib/auth";
import { getSetting, SETTING_KEYS } from "@/lib/platform-settings";
import { isConfiguredAsync } from "@/lib/oauth-providers";
import { shopifyConfigured } from "@/lib/shopify-oauth";
import { getConnectApiToken, CONNECT_API_BASE } from "@/lib/connect-api";
import { EbayCertForm, ShopifySecretForm, FacebookCredsForm, CjCredsForm, ConnectApiPanel } from "./integrations-form";

export const dynamic = "force-dynamic";
export const metadata = { title: "Admin — Integrations" };

export default async function AdminIntegrationsPage() {
  await requireSuperAdmin();
  const [cert, ebayReady, shopifySecret, shopifyReady, fbId, fbSecret, fbReady, connectToken, cjEmail, cjKey] = await Promise.all([
    getSetting(SETTING_KEYS.ebayClientSecret),
    isConfiguredAsync("EBAY"),
    getSetting(SETTING_KEYS.shopifyClientSecret),
    shopifyConfigured(),
    getSetting(SETTING_KEYS.facebookAppId),
    getSetting(SETTING_KEYS.facebookAppSecret),
    isConfiguredAsync("FACEBOOK"),
    getConnectApiToken(),
    getSetting(SETTING_KEYS.cjEmail),
    getSetting(SETTING_KEYS.cjApiKey),
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

      <div className="mb-6 rounded-xl border border-slate-200 bg-white p-5">
        <EbayCertForm certSet={Boolean(cert)} />
      </div>

      <div className={`mb-6 rounded-xl border p-4 ${cjEmail && cjKey ? "border-green-200 bg-green-50" : "border-amber-200 bg-amber-50"}`}>
        <p className={`text-sm font-medium ${cjEmail && cjKey ? "text-green-800" : "text-amber-800"}`}>
          {cjEmail && cjKey
            ? "● CJ Dropshipping is connected — catalogue import and live stock can run."
            : "● CJ Dropshipping is not connected — add the API key below to import stock."}
        </p>
        <p className="mt-1 text-xs text-slate-500">Imports one product row per warehouse, so stock can only be sold where it can actually ship.</p>
      </div>

      <div className="mb-6 rounded-xl border border-slate-200 bg-white p-5">
        <CjCredsForm emailSet={Boolean(cjEmail)} keySet={Boolean(cjKey)} />
      </div>

      <div className={`mb-6 rounded-xl border p-4 ${shopifyReady ? "border-green-200 bg-green-50" : "border-amber-200 bg-amber-50"}`}>
        <p className={`text-sm font-medium ${shopifyReady ? "text-green-800" : "text-amber-800"}`}>
          {shopifyReady ? "● Shopify is connectable — businesses can link their store with one click." : "● Shopify is not connectable yet — add the Client Secret below."}
        </p>
        <p className="mt-1 text-xs text-slate-500">The Client ID is already set on the server; only the Client Secret is needed here.</p>
      </div>

      <div className="mb-6 rounded-xl border border-slate-200 bg-white p-5">
        <ShopifySecretForm secretSet={Boolean(shopifySecret)} />
      </div>

      <div className={`mb-6 rounded-xl border p-4 ${fbReady ? "border-green-200 bg-green-50" : "border-amber-200 bg-amber-50"}`}>
        <p className={`text-sm font-medium ${fbReady ? "text-green-800" : "text-amber-800"}`}>
          {fbReady ? "● Facebook is connectable — businesses can link their Pages (messages + comments into the inbox)." : "● Facebook is not connectable yet — add the App ID + Secret below."}
        </p>
        <p className="mt-1 text-xs text-slate-500">From the Meta &ldquo;Placid CRM Pages&rdquo; Business app → App settings → Basic.</p>
      </div>

      <div className="mb-6 rounded-xl border border-slate-200 bg-white p-5">
        <FacebookCredsForm idSet={Boolean(fbId)} secretSet={Boolean(fbSecret)} />
      </div>

      <div className="mb-2 rounded-xl border border-indigo-200 bg-indigo-50 p-4">
        <p className="text-sm font-medium text-indigo-800">● Placid Connect API — catalogue + orders bridge</p>
        <p className="mt-1 text-xs text-slate-600">
          The Placid Connect storefront pulls the Placid Deals catalogue (<code className="font-mono">GET /products</code>)
          and pushes paid orders back for fulfilment (<code className="font-mono">POST /orders</code>) using the token below.
        </p>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-5">
        <ConnectApiPanel baseUrl={CONNECT_API_BASE} token={connectToken} />
      </div>
    </div>
  );
}
