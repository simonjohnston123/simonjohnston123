"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { importShopifyProductsAction } from "@/app/dashboard/l/[locationId]/products/sync-actions";

// Loops the batched import until Shopify reports done, showing running progress.
// Handles 10k+ catalogues without any single request hanging.
export function ProductImportButton({ locationId }: { locationId: string }) {
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  const [ok, setOk] = useState(true);
  const router = useRouter();

  return (
    <div className="flex items-center gap-2">
      {msg ? <span className={`text-xs ${ok ? "text-slate-500" : "text-rose-600"}`}>{msg}</span> : null}
      <button
        type="button"
        disabled={pending}
        onClick={() =>
          start(async () => {
            setOk(true);
            let sinceId = 0;
            let total = 0;
            for (let guard = 0; guard < 60; guard++) {
              const r = await importShopifyProductsAction(locationId, sinceId);
              if (!r.ok) { setOk(false); setMsg(r.message); return; }
              total += r.imported + r.updated;
              setMsg(`Imported ${total}…`);
              if (r.done || r.lastId == null) break;
              sinceId = r.lastId;
            }
            setMsg(`Done — ${total} products imported.`);
            router.refresh();
          })
        }
        className="btn-secondary text-sm"
      >
        {pending ? "Importing…" : "🛍 Import from Shopify"}
      </button>
    </div>
  );
}
