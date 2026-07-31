"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { importShopifyProductsAction } from "@/app/dashboard/l/[locationId]/products/sync-actions";

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
            setMsg(null);
            const r = await importShopifyProductsAction(locationId);
            setOk(r.ok);
            setMsg(r.message);
            if (r.ok) router.refresh();
          })
        }
        className="btn-secondary text-sm"
      >
        {pending ? "Importing…" : "🛍 Import from Shopify"}
      </button>
    </div>
  );
}
