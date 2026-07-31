"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { syncEmailNowAction } from "@/app/dashboard/l/[locationId]/conversations/sync-actions";

/** "Sync now" button — pulls new email into the Inbox on demand. */
export function EmailSyncButton({ locationId, className }: { locationId: string; className?: string }) {
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  const [ok, setOk] = useState(true);
  const router = useRouter();

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        disabled={pending}
        onClick={() =>
          start(async () => {
            setMsg(null);
            const r = await syncEmailNowAction(locationId);
            setOk(r.ok);
            setMsg(r.message);
            if (r.ok) router.refresh();
          })
        }
        className={className ?? "btn-secondary text-sm"}
      >
        {pending ? "Syncing…" : "Sync email"}
      </button>
      {msg ? (
        <span className={`text-xs ${ok ? "text-slate-500" : "text-rose-600"}`}>{msg}</span>
      ) : null}
    </div>
  );
}
