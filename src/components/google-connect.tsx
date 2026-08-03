"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { disconnectGoogleAction, syncGmailAction, syncReviewsAction, syncCalendarAction } from "@/app/dashboard/l/[locationId]/google/actions";

export type Service = {
  key: string; label: string; icon: string; blurb: string; tier: string; granted: boolean;
  /** Connects on its own consent screen (Google refuses some scope combinations). */
  separate?: boolean;
  connectHref?: string;
};

export function GoogleConnect({
  locationId, connected, email, services, ready, status,
}: {
  locationId: string; connected: boolean; email?: string; services: Service[]; ready: boolean; status?: string;
}) {
  const router = useRouter();
  // Separately-connected services must never enter the combined grant.
  const [picked, setPicked] = useState<Set<string>>(
    new Set(services.filter((s) => !s.separate && (s.granted || !connected)).map((s) => s.key)),
  );
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const toggle = (k: string) => setPicked((p) => { const n = new Set(p); if (n.has(k)) n.delete(k); else n.add(k); return n; });
  const connectHref = `/api/integrations/google/connect?locationId=${locationId}&services=${[...picked].join(",")}`;

  return (
    <div className="space-y-4">
      <div className="card p-5">
        {connected ? (
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-2xl">🟢</span>
                <div>
                  <div className="font-semibold text-slate-900">Connected{email ? ` — ${email}` : ""}</div>
                  <div className="text-xs text-slate-500">{services.filter((s) => s.granted).length} service{services.filter((s) => s.granted).length === 1 ? "" : "s"} granted</div>
                </div>
              </div>
              {status === "ERROR" ? <p className="mt-2 text-sm text-amber-600">⚠️ Google revoked access — reconnect below.</p> : null}
            </div>
            <div className="flex gap-2">
              <a href={connectHref} className="btn-secondary text-sm">Change services</a>
              <button
                onClick={() => start(async () => { await disconnectGoogleAction(locationId); router.refresh(); })}
                disabled={pending}
                className="rounded-lg px-3 py-1.5 text-sm font-semibold text-slate-400 hover:text-red-500"
              >Disconnect</button>
            </div>
          </div>
        ) : (
          <div>
            <div className="mb-1 text-lg font-semibold text-slate-900">Connect your Google account</div>
            <p className="mb-3 text-sm text-slate-500">Tick what you want to use, then connect once — Google will ask you to approve exactly those.</p>
            {!ready ? <p className="text-sm text-amber-600">The platform&apos;s Google app isn&apos;t configured yet.</p> : null}
          </div>
        )}
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {services.map((s) => {
          const on = picked.has(s.key);
          const body = (
            <>
              <div className="flex items-center justify-between">
                <span className="text-2xl">{s.icon}</span>
                {s.granted ? <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-bold text-emerald-700">Connected</span>
                  : s.separate ? <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-bold text-slate-600">Connect separately</span>
                  : on ? <span className="rounded-full bg-brand-100 px-2 py-0.5 text-[11px] font-bold text-brand-700">Selected</span> : null}
              </div>
              <div className="mt-1 font-semibold text-slate-900">{s.label}</div>
              <div className="text-xs text-slate-500">{s.blurb}</div>
              {s.tier === "restricted" ? (
                <div className="mt-1 text-[11px] text-amber-600">Needs Google security review before 100+ customers</div>
              ) : null}
            </>
          );

          // Its own consent screen — a link, not a tick-box, so it can never be
          // folded into the combined grant Google would reject.
          return s.separate ? (
            <a key={s.key} href={s.connectHref} className="card p-4 text-left transition hover:border-slate-300">
              {body}
              <div className="mt-2 text-xs font-semibold text-brand-600">{s.granted ? "Reconnect →" : "Connect →"}</div>
            </a>
          ) : (
            <button
              key={s.key}
              onClick={() => toggle(s.key)}
              className={`card p-4 text-left transition ${on ? "ring-2 ring-brand-400" : "hover:border-slate-300"}`}
            >
              {body}
            </button>
          );
        })}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <a
          href={ready && picked.size ? connectHref : undefined}
          aria-disabled={!ready || !picked.size}
          className={`rounded-xl px-5 py-2.5 text-sm font-bold text-white ${ready && picked.size ? "bg-brand-gradient" : "pointer-events-none bg-slate-300"}`}
        >
          {connected ? "Reconnect with these services" : `Connect Google${picked.size ? ` (${picked.size})` : ""}`}
        </a>

        {connected && services.find((s) => s.key === "gmail")?.granted ? (
          <button
            onClick={() => start(async () => {
              const r = await syncGmailAction(locationId);
              setMsg(r.error ? r.error : `✓ Pulled ${r.imported} email${r.imported === 1 ? "" : "s"} into your inbox.`);
              router.refresh();
            })}
            disabled={pending}
            className="btn-secondary text-sm"
          >{pending ? "Syncing…" : "✉️ Sync Gmail now"}</button>
        ) : null}

        {connected && services.find((s) => s.key === "business")?.granted ? (
          <button
            onClick={() => start(async () => {
              const r = await syncReviewsAction(locationId);
              setMsg(r.error ? r.error : `✓ Pulled ${r.imported} review${r.imported === 1 ? "" : "s"} into your inbox.`);
              router.refresh();
            })}
            disabled={pending}
            className="btn-secondary text-sm"
          >{pending ? "Syncing…" : "⭐ Sync Google reviews"}</button>
        ) : null}

        {connected && services.find((s) => s.key === "calendar")?.granted ? (
          <button
            onClick={() => start(async () => {
              const r = await syncCalendarAction(locationId);
              setMsg(r.error ? r.error : "✓ Calendar synced — your Google commitments now block booking slots.");
              router.refresh();
            })}
            disabled={pending}
            className="btn-secondary text-sm"
          >{pending ? "Syncing…" : "📅 Sync calendar"}</button>
        ) : null}

        {msg ? <span className={`text-sm font-semibold ${msg.startsWith("✓") ? "text-emerald-600" : "text-red-600"}`}>{msg}</span> : null}
      </div>
    </div>
  );
}
