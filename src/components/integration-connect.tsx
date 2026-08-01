"use client";

import { useState } from "react";
import { useFormState } from "react-dom";
import { SubmitButton } from "@/components/submit-button";
import { providerDef, type ProviderKey } from "@/lib/integrations-catalog";
import { connectApiKeyAction, disconnectAction, refreshFacebookPagesAction } from "@/app/dashboard/l/[locationId]/integrations/actions";

type State = { error: string; ok?: boolean };
const INIT: State = { error: "", ok: false };

export function ConnectButton({
  locationId,
  provider,
  connected,
  oauthReady = false,
}: {
  locationId: string;
  provider: ProviderKey;
  connected: boolean;
  oauthReady?: boolean;
}) {
  const def = providerDef(provider);
  const [open, setOpen] = useState(false);
  const [shop, setShop] = useState("");
  const [state, formAction] = useFormState(connectApiKeyAction, INIT);

  if (!def) return null;

  const oauthHref = `/api/integrations/${provider.toLowerCase()}/connect?locationId=${locationId}`;
  const hasKeys = Boolean(def.fields?.length);

  // Shopify: one-click OAuth once the platform Client Secret is set. We only need
  // to know WHICH store first, then bounce the merchant to Shopify's own consent.
  if (provider === "SHOPIFY" && oauthReady) {
    const go = () => {
      const s = shop.trim();
      if (!s) return;
      window.location.href = `/api/integrations/shopify/connect?locationId=${locationId}&shop=${encodeURIComponent(s)}`;
    };
    return (
      <>
        <button className={connected ? "btn-secondary text-sm" : "btn-primary text-sm"} onClick={() => setOpen(true)}>
          {connected ? "Reconnect" : "Connect with Shopify"}
        </button>
        {open ? (
          <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-900/50 p-4" onClick={() => setOpen(false)}>
            <div className="card my-8 w-full max-w-md p-6" onClick={(e) => e.stopPropagation()}>
              <div className="mb-1 flex items-center justify-between">
                <h2 className="text-lg font-semibold text-slate-900">Connect with Shopify</h2>
                <button className="btn-ghost" onClick={() => setOpen(false)} aria-label="Close">✕</button>
              </div>
              <p className="mb-4 text-sm text-slate-500">Enter your store, then approve access on Shopify. No tokens to copy.</p>
              <label className="label" htmlFor="shopDomain">Store domain</label>
              <input
                id="shopDomain"
                value={shop}
                onChange={(e) => setShop(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") go(); }}
                type="text"
                className="input"
                placeholder="your-store.myshopify.com"
                autoComplete="off"
                autoFocus
              />
              <p className="mt-1 text-xs text-slate-400">
                Your permanent .myshopify.com address — NOT your custom domain. Find it in Shopify admin → Settings → Domains.
                You can also just type the store name (e.g. &ldquo;ugkjdv-vk&rdquo;).
              </p>
              <div className="mt-4 flex justify-end gap-2">
                <button type="button" className="btn-secondary" onClick={() => setOpen(false)}>Cancel</button>
                <button type="button" className="btn-primary" onClick={go}>Continue to Shopify →</button>
              </div>
            </div>
          </div>
        ) : null}
      </>
    );
  }

  // API-key providers open a modal to paste credentials.
  if (state?.ok && open) setTimeout(() => setOpen(false), 0);
  const keyModal =
    hasKeys && open ? (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-900/50 p-4" onClick={() => setOpen(false)}>
          <div className="card my-8 w-full max-w-md p-6" onClick={(e) => e.stopPropagation()}>
            <div className="mb-1 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-slate-900">Connect {def.name}</h2>
              <button className="btn-ghost" onClick={() => setOpen(false)} aria-label="Close">✕</button>
            </div>
            <p className="mb-4 text-sm text-slate-500">{def.blurb}</p>
            <form action={formAction} className="space-y-3">
              <input type="hidden" name="locationId" value={locationId} />
              <input type="hidden" name="provider" value={provider} />
              {def.fields?.map((f) => (
                <div key={f.key}>
                  <label className="label" htmlFor={f.key}>{f.label}</label>
                  <input
                    id={f.key}
                    name={f.key}
                    type={f.secret ? "password" : "text"}
                    className="input"
                    placeholder={f.placeholder}
                    autoComplete="off"
                  />
                  {f.hint ? <p className="mt-1 text-xs text-slate-400">{f.hint}</p> : null}
                </div>
              ))}
              <p className="rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-500">
                🔒 Your credentials are encrypted before they&rsquo;re stored and never shown again.
              </p>
              {state?.error ? (
                <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</p>
              ) : null}
              <div className="flex justify-end gap-2 pt-1">
                <button type="button" className="btn-secondary" onClick={() => setOpen(false)}>Cancel</button>
                <SubmitButton className="btn-primary">Connect</SubmitButton>
              </div>
            </form>
          </div>
        </div>
      ) : null;

  // Prefer one-click OAuth when this provider's Placid app is configured.
  if (oauthReady) {
    return (
      <>
        <a href={oauthHref} className={connected ? "btn-secondary text-sm" : "btn-primary text-sm"}>
          {connected ? "Reconnect" : `Connect ${def.name}`}
        </a>
        {hasKeys ? (
          <button type="button" onClick={() => setOpen(true)} className="btn-ghost text-xs text-slate-400">
            Enter keys manually
          </button>
        ) : null}
        {keyModal}
      </>
    );
  }

  // OAuth-only provider whose Placid app isn't configured yet.
  if (def.connectType === "oauth") {
    return (
      <span className="btn-secondary cursor-not-allowed text-sm opacity-60" title="Available once Placid's app for this provider is approved">
        Coming soon
      </span>
    );
  }

  // API-key provider (no OAuth app configured): paste credentials manually.
  return (
    <>
      <button className={connected ? "btn-secondary text-sm" : "btn-primary text-sm"} onClick={() => setOpen(true)}>
        {connected ? "Update" : "Connect"}
      </button>
      {keyModal}
    </>
  );
}

export function RefreshFacebookButton({ locationId }: { locationId: string }) {
  const [state, action] = useFormState<State, FormData>(refreshFacebookPagesAction, INIT);
  return (
    <form action={action} className="inline-flex items-center gap-2">
      <input type="hidden" name="locationId" value={locationId} />
      <SubmitButton className="btn-ghost text-xs text-slate-500 hover:text-brand-600">Refresh pages</SubmitButton>
      {state?.error ? <span className="text-xs text-red-600">{state.error}</span> : null}
      {state?.ok ? <span className="text-xs text-green-600">Updated ✓</span> : null}
    </form>
  );
}

export function DisconnectButton({ locationId, provider }: { locationId: string; provider: ProviderKey }) {
  return (
    <form action={disconnectAction}>
      <input type="hidden" name="locationId" value={locationId} />
      <input type="hidden" name="provider" value={provider} />
      <button className="btn-ghost text-sm text-slate-400 hover:text-red-600">Disconnect</button>
    </form>
  );
}
