"use client";

import { useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { saveEbayCertAction, saveCjCredsAction, saveShopifySecretAction, saveFacebookCredsAction, type SaveState } from "./actions";

function SaveButton({ label = "Save" }: { label?: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className="btn-primary">
      {pending ? "Saving…" : label}
    </button>
  );
}

function CopyField({ label, value, mask = false }: { label: string; value: string; mask?: boolean }) {
  const [copied, setCopied] = useState(false);
  const [revealed, setRevealed] = useState(!mask);
  const shown = revealed ? value : "•".repeat(Math.min(value.length, 40));
  return (
    <div>
      <label className="mb-1 block text-sm font-medium text-slate-700">{label}</label>
      <div className="flex items-center gap-2">
        <code className="flex-1 overflow-x-auto whitespace-nowrap rounded-lg bg-slate-100 px-3 py-2 font-mono text-xs text-slate-800">
          {shown}
        </code>
        {mask ? (
          <button type="button" onClick={() => setRevealed((r) => !r)} className="btn-secondary shrink-0 text-xs">
            {revealed ? "Hide" : "Show"}
          </button>
        ) : null}
        <button
          type="button"
          onClick={() => {
            navigator.clipboard?.writeText(value);
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
          }}
          className="btn-secondary shrink-0 text-xs"
        >
          {copied ? "Copied ✓" : "Copy"}
        </button>
      </div>
    </div>
  );
}

export function ConnectApiPanel({ baseUrl, token }: { baseUrl: string; token: string }) {
  return (
    <div className="space-y-3">
      <p className="text-xs text-slate-500">
        Give these two values to the Placid Connect side (its <code className="font-mono">.env</code>:{" "}
        <code className="font-mono">CRM_API_URL</code> + <code className="font-mono">CRM_API_TOKEN</code>). Connect uses
        them to pull the Placid Deals catalogue and push paid orders back for fulfilment. Keep the token secret.
      </p>
      <CopyField label="CRM_API_URL (base URL)" value={baseUrl} />
      <CopyField label="CRM_API_TOKEN (Bearer token)" value={token} mask />
    </div>
  );
}

export function FacebookCredsForm({ idSet, secretSet }: { idSet: boolean; secretSet: boolean }) {
  const [state, action] = useFormState<SaveState, FormData>(saveFacebookCredsAction, { error: "" });
  return (
    <form action={action} className="space-y-3">
      {state.ok ? (
        <p className="rounded-lg bg-green-50 px-3 py-2 text-sm text-green-700">✓ Saved. Facebook is now connectable — businesses can link their Pages.</p>
      ) : null}
      {state.error ? <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{state.error}</p> : null}
      <div>
        <label className="mb-1 block text-sm font-medium text-slate-700">
          Facebook App ID {idSet ? <span className="text-xs font-normal text-green-600">· set ✓</span> : <span className="text-xs font-normal text-amber-600">· not set</span>}
        </label>
        <input name="appId" type="text" autoComplete="off" placeholder={idSet ? "•••••••• (leave blank to keep current)" : "1198310812472618"} className="input w-full font-mono" />
      </div>
      <div>
        <label className="mb-1 block text-sm font-medium text-slate-700">
          Facebook App Secret {secretSet ? <span className="text-xs font-normal text-green-600">· set ✓</span> : <span className="text-xs font-normal text-amber-600">· not set</span>}
        </label>
        <input name="appSecret" type="password" autoComplete="off" placeholder={secretSet ? "•••••••• (leave blank to keep current)" : "click Show on the app's Settings → Basic"} className="input w-full font-mono" />
        <p className="mt-1 text-xs text-slate-500">From your Meta app → App settings → Basic. Stored encrypted, used server-side only.</p>
      </div>
      <SaveButton label="Save Facebook credentials" />
    </form>
  );
}

export function EbayCertForm({ certSet }: { certSet: boolean }) {
  const [state, action] = useFormState<SaveState, FormData>(saveEbayCertAction, { error: "" });
  return (
    <form action={action} className="space-y-3">
      {state.ok ? (
        <p className="rounded-lg bg-green-50 px-3 py-2 text-sm text-green-700">✓ Saved. eBay is now connectable in every business&apos;s Integrations.</p>
      ) : null}
      {state.error ? <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{state.error}</p> : null}
      <div>
        <label className="mb-1 block text-sm font-medium text-slate-700">
          eBay Cert ID (Client Secret) {certSet ? <span className="text-xs font-normal text-green-600">· set ✓</span> : <span className="text-xs font-normal text-amber-600">· not set</span>}
        </label>
        <input
          name="certId"
          type="password"
          autoComplete="off"
          placeholder={certSet ? "•••••••• (leave blank to keep current)" : "PRD-…"}
          className="input w-full font-mono"
        />
        <p className="mt-1 text-xs text-slate-500">
          From developer.ebay.com/my/keys → Production → &ldquo;Cert ID (Client Secret)&rdquo;. Stored encrypted, used
          server-side only.
        </p>
      </div>
      <SaveButton label="Save Cert ID" />
    </form>
  );
}

export function CjCredsForm({ emailSet, keySet }: { emailSet: boolean; keySet: boolean }) {
  const [state, action] = useFormState<SaveState, FormData>(saveCjCredsAction, { error: "" });
  return (
    <form action={action} className="space-y-3">
      {state.ok ? (
        <p className="rounded-lg bg-green-50 px-3 py-2 text-sm text-green-700">✓ Saved. CJ catalogue and live stock feed can now run.</p>
      ) : null}
      {state.error ? <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{state.error}</p> : null}
      <div>
        <label className="mb-1 block text-sm font-medium text-slate-700">
          CJ account email {emailSet ? <span className="text-xs font-normal text-green-600">· set ✓</span> : <span className="text-xs font-normal text-amber-600">· not set</span>}
        </label>
        <input name="cjEmail" type="text" autoComplete="off" placeholder={emailSet ? "•••••••• (leave blank to keep current)" : "you@example.com"} className="input w-full font-mono" />
      </div>
      <div>
        <label className="mb-1 block text-sm font-medium text-slate-700">
          CJ API key {keySet ? <span className="text-xs font-normal text-green-600">· set ✓</span> : <span className="text-xs font-normal text-amber-600">· not set</span>}
        </label>
        <input name="cjApiKey" type="password" autoComplete="off" placeholder={keySet ? "•••••••• (leave blank to keep current)" : "from CJ → My CJ → Authorization → API"} className="input w-full font-mono" />
        <p className="mt-1 text-xs text-slate-500">
          CJ Dropshipping → My CJ → Authorization → API → <em>Generate API Key</em>. This is a server key, not your
          password, and is what lets stock levels refresh on a schedule. Stored encrypted.
        </p>
      </div>
      <SaveButton label="Save CJ credentials" />
    </form>
  );
}

export function ShopifySecretForm({ secretSet }: { secretSet: boolean }) {
  const [state, action] = useFormState<SaveState, FormData>(saveShopifySecretAction, { error: "" });
  return (
    <form action={action} className="space-y-3">
      {state.ok ? (
        <p className="rounded-lg bg-green-50 px-3 py-2 text-sm text-green-700">✓ Saved. Businesses can now use &ldquo;Connect with Shopify&rdquo;.</p>
      ) : null}
      {state.error ? <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{state.error}</p> : null}
      <div>
        <label className="mb-1 block text-sm font-medium text-slate-700">
          Shopify app Client Secret {secretSet ? <span className="text-xs font-normal text-green-600">· set ✓</span> : <span className="text-xs font-normal text-amber-600">· not set</span>}
        </label>
        <input
          name="clientSecret"
          type="password"
          autoComplete="off"
          placeholder={secretSet ? "•••••••• (leave blank to keep current)" : "long hex string"}
          className="input w-full font-mono"
        />
        <p className="mt-1 text-xs text-slate-500">
          From your Shopify app in the Dev Dashboard → Settings → Credentials → &ldquo;Secret&rdquo;. The Client ID is
          already set. Stored encrypted, used server-side only.
        </p>
      </div>
      <SaveButton label="Save Client Secret" />
    </form>
  );
}
