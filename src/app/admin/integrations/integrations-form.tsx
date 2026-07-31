"use client";

import { useFormState, useFormStatus } from "react-dom";
import { saveEbayCertAction, saveShopifySecretAction, type SaveState } from "./actions";

function SaveButton({ label = "Save" }: { label?: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className="btn-primary">
      {pending ? "Saving…" : label}
    </button>
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
