import { requireLocationAccess } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { PageHeader, Badge } from "@/components/ui";
import { ConnectButton, DisconnectButton } from "@/components/integration-connect";
import { PROVIDERS, type ProviderKey } from "@/lib/integrations-catalog";
import { isConfiguredAsync } from "@/lib/oauth-providers";
import { saveWantedIntegrationsAction } from "./actions";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

const CATEGORIES = ["Email", "Messaging", "Social", "Calendar", "Payments", "E-commerce"] as const;

export default async function IntegrationsPage({ params }: { params: { locationId: string } }) {
  const { locationId } = params;
  const { location } = await requireLocationAccess(locationId);

  const connections = await prisma.connection.findMany({ where: { locationId } });
  const byProvider = new Map(connections.map((c) => [c.provider, c]));
  const connectedCount = connections.filter((c) => c.status === "CONNECTED").length;
  const wanted = new Set(Array.isArray(location.wantedIntegrations) ? (location.wantedIntegrations as string[]) : []);

  // OAuth readiness can come from env OR the admin settings store (async).
  const oauthReadyMap = Object.fromEntries(
    await Promise.all(PROVIDERS.map(async (p) => [p.key, await isConfiguredAsync(p.key)] as const)),
  ) as Record<string, boolean>;

  return (
    <div>
      <PageHeader
        title="Integrations"
        subtitle={`Connect this business's own channels — ${connectedCount} connected`}
      />

      {/* Onboarding chooser — the business picks the tools it wants to use. */}
      <form action={saveWantedIntegrationsAction} className="card mb-6 p-5">
        <input type="hidden" name="locationId" value={locationId} />
        <h2 className="text-sm font-semibold text-slate-800">Which tools do you use?</h2>
        <p className="mt-1 text-xs text-slate-500">Pick the ones you want — we&rsquo;ll put them front and centre and prompt you to connect them.</p>
        <div className="mt-3 flex flex-wrap gap-2">
          {PROVIDERS.map((p) => (
            <label key={p.key} className="cursor-pointer">
              <input type="checkbox" name="wanted" value={p.key} defaultChecked={wanted.has(p.key)} className="peer sr-only" />
              <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-600 transition peer-checked:border-brand-400 peer-checked:bg-brand-50 peer-checked:text-brand-700 peer-hover:border-slate-300">
                <span>{p.icon}</span>{p.name}
              </span>
            </label>
          ))}
        </div>
        <div className="mt-4">
          <button className="btn-primary text-sm">Save my tools</button>
        </div>
      </form>

      <p className="mb-6 max-w-2xl rounded-xl border border-slate-200 bg-slate-50/60 p-4 text-sm text-slate-600">
        Each connection uses <span className="font-medium text-slate-800">this business&rsquo;s own account</span> — your
        credentials are encrypted and never shared. Channels marked{" "}
        <span className="font-medium">Coming soon</span> switch on as each provider&rsquo;s app is approved.
      </p>

      <div className="space-y-8">
        {CATEGORIES.map((category) => {
          // Chosen tools float to the top of each category.
          const items = PROVIDERS.filter((p) => p.category === category).sort(
            (a, b) => (wanted.has(b.key) ? 1 : 0) - (wanted.has(a.key) ? 1 : 0),
          );
          if (items.length === 0) return null;
          return (
            <section key={category}>
              <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">{category}</h2>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {items.map((p) => {
                  const conn = byProvider.get(p.key as ProviderKey as never);
                  const connected = conn?.status === "CONNECTED";
                  // Any provider with a configured Placid app can do one-click OAuth —
                  // including api-key providers like Square (keys stay as a fallback).
                  const oauthReady = oauthReadyMap[p.key] ?? false;
                  return (
                    <div key={p.key} className={cn("card flex flex-col p-5", wanted.has(p.key) && "ring-2 ring-brand-200")}>
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-3">
                          <span className="grid h-10 w-10 place-items-center rounded-xl bg-slate-100 text-xl">{p.icon}</span>
                          <div>
                            <h3 className="font-semibold text-slate-900">{p.name}</h3>
                            {connected && conn?.accountLabel ? (
                              <p className="text-xs text-slate-500">{conn.accountLabel}</p>
                            ) : wanted.has(p.key) ? (
                              <p className="text-xs font-medium text-brand-600">★ Your pick</p>
                            ) : null}
                          </div>
                        </div>
                        {connected ? (
                          <Badge color="green">Connected</Badge>
                        ) : p.connectType === "oauth" && !oauthReady ? (
                          <Badge color="slate">Soon</Badge>
                        ) : (
                          <Badge color="amber">Off</Badge>
                        )}
                      </div>
                      <p className="mt-3 flex-1 text-sm text-slate-500">{p.blurb}</p>
                      <div className="mt-4 flex items-center gap-2">
                        <ConnectButton locationId={locationId} provider={p.key as ProviderKey} connected={connected} oauthReady={oauthReady} />
                        {connected ? <DisconnectButton locationId={locationId} provider={p.key as ProviderKey} /> : null}
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
