import { requireLocationAccess } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { PageHeader, Badge } from "@/components/ui";
import { ConnectButton, DisconnectButton } from "@/components/integration-connect";
import { PROVIDERS, type ProviderKey } from "@/lib/integrations-catalog";
import { isConfigured } from "@/lib/oauth-providers";

export const dynamic = "force-dynamic";

const CATEGORIES = ["Email", "Messaging", "Social", "Calendar", "Payments", "E-commerce"] as const;

export default async function IntegrationsPage({ params }: { params: { locationId: string } }) {
  const { locationId } = params;
  await requireLocationAccess(locationId);

  const connections = await prisma.connection.findMany({ where: { locationId } });
  const byProvider = new Map(connections.map((c) => [c.provider, c]));
  const connectedCount = connections.filter((c) => c.status === "CONNECTED").length;

  return (
    <div>
      <PageHeader
        title="Integrations"
        subtitle={`Connect this business's own channels — ${connectedCount} connected`}
      />

      <p className="mb-6 max-w-2xl rounded-xl border border-slate-200 bg-slate-50/60 p-4 text-sm text-slate-600">
        Each connection uses <span className="font-medium text-slate-800">this business&rsquo;s own account</span> — your
        credentials are encrypted and never shared. Channels marked{" "}
        <span className="font-medium">Coming soon</span> switch on as each provider&rsquo;s app is approved.
      </p>

      <div className="space-y-8">
        {CATEGORIES.map((category) => {
          const items = PROVIDERS.filter((p) => p.category === category);
          if (items.length === 0) return null;
          return (
            <section key={category}>
              <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">{category}</h2>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {items.map((p) => {
                  const conn = byProvider.get(p.key as ProviderKey as never);
                  const connected = conn?.status === "CONNECTED";
                  const oauthReady = p.connectType === "oauth" && isConfigured(p.key);
                  return (
                    <div key={p.key} className="card flex flex-col p-5">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-3">
                          <span className="grid h-10 w-10 place-items-center rounded-xl bg-slate-100 text-xl">{p.icon}</span>
                          <div>
                            <h3 className="font-semibold text-slate-900">{p.name}</h3>
                            {connected && conn?.accountLabel ? (
                              <p className="text-xs text-slate-500">{conn.accountLabel}</p>
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
