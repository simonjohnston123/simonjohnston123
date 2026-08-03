"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { activateReceptionistAction } from "@/app/dashboard/l/[locationId]/receptionist/actions";

export function ActivateButton({ locationId, ready }: { locationId: string; ready: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);

  return (
    <div>
      <button
        disabled={!ready || pending}
        onClick={() => start(async () => {
          setMsg(null);
          const r = await activateReceptionistAction(locationId);
          if (r.error) setMsg(r.error);
          else { setMsg(`Your AI receptionist is live on ${r.number} 🎉`); router.refresh(); }
        })}
        className="rounded-xl bg-brand-gradient px-5 py-3 text-sm font-bold text-white disabled:opacity-50"
      >
        {pending ? "Provisioning your number…" : "📞 Activate — get my AI receptionist number"}
      </button>
      {!ready ? <p className="mt-2 text-xs text-slate-400">Available as soon as the platform's phone service is connected.</p> : null}
      {msg ? <p className={`mt-2 text-sm ${msg.includes("🎉") ? "text-emerald-600" : "text-red-600"}`}>{msg}</p> : null}
    </div>
  );
}
