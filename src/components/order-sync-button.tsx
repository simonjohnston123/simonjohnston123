"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { syncShopifyOrdersAction, syncEbayOrdersAction } from "@/app/dashboard/l/[locationId]/orders/sync-actions";

export function OrderSyncButton({ locationId, channel }: { locationId: string; channel: "shopify" | "ebay" }) {
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  const [ok, setOk] = useState(true);
  const router = useRouter();

  const label = channel === "shopify" ? "🛍 Sync Shopify" : "🏷 Sync eBay";
  const run = channel === "shopify" ? syncShopifyOrdersAction : syncEbayOrdersAction;

  return (
    <div className="flex items-center gap-2">
      {msg ? <span className={`text-xs ${ok ? "text-slate-500" : "text-rose-600"}`}>{msg}</span> : null}
      <button
        type="button"
        disabled={pending}
        onClick={() =>
          start(async () => {
            setMsg(null);
            const r = await run(locationId);
            setOk(r.ok);
            setMsg(r.message);
            if (r.ok) router.refresh();
          })
        }
        className="btn-secondary text-sm"
      >
        {pending ? "Syncing…" : label}
      </button>
    </div>
  );
}
