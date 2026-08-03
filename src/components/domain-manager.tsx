"use client";

import { useCallback, useEffect, useState } from "react";

type Status = {
  domain: string | null;
  published?: boolean;
  targetIp?: string;
  cnameTarget?: string;
  apex?: { pointing: boolean };
  www?: { pointing: boolean };
  httpsLive?: boolean;
};

/**
 * Domain hub for a business website:
 *  - Buy a domain — Placid Domains (our storefront) embedded right here, so
 *    the owner never leaves the page.
 *  - Connect a domain they already own — save it, show the two DNS records,
 *    live "is it pointing yet" checker; TLS issues itself on first hit.
 */
export function DomainManager({ locationId }: { locationId: string }) {
  const [status, setStatus] = useState<Status | null>(null);
  const [domainInput, setDomainInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [shopOpen, setShopOpen] = useState(false);

  const refresh = useCallback(async () => {
    setChecking(true);
    try {
      const res = await fetch(`/api/domains/status?locationId=${locationId}`);
      if (res.ok) setStatus(await res.json());
    } finally {
      setChecking(false);
    }
  }, [locationId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function connect(domain: string | null) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/domains/connect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ locationId, domain }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Couldn't save that domain.");
        return;
      }
      setDomainInput("");
      await refresh();
    } finally {
      setBusy(false);
    }
  }

  const connected = status?.domain ?? null;
  const pointing = Boolean(status?.apex?.pointing || status?.www?.pointing);

  return (
    <div className="card mt-6 overflow-hidden">
      <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="text-lg">🌐</span>
          <h3 className="font-semibold text-slate-900">Your domain</h3>
          {connected &&
            (status?.httpsLive ? (
              <span className="badge bg-green-50 text-green-700">Live on {connected}</span>
            ) : pointing ? (
              <span className="badge bg-amber-50 text-amber-700">DNS OK — activating…</span>
            ) : (
              <span className="badge bg-slate-100 text-slate-600">Waiting for DNS</span>
            ))}
        </div>
        <button
          className="btn-secondary text-sm"
          onClick={() => setShopOpen((o) => !o)}
          type="button"
        >
          {shopOpen ? "Close domain shop" : "🛒 Buy a domain"}
        </button>
      </div>

      {/* Placid Domains storefront, embedded — purchases stay in this window. */}
      {shopOpen && (
        <div className="border-b border-slate-100">
          <iframe
            src="https://www.placiddomains.com/"
            title="Placid Domains — search & buy a domain"
            className="h-[560px] w-full border-0 bg-white"
          />
          <p className="px-4 py-2 text-xs text-slate-400">
            Powered by Placid Domains. Once your purchase completes, come back here and connect
            the new domain below — same-day activation.
          </p>
        </div>
      )}

      <div className="p-4">
        {!connected ? (
          <form
            className="flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              if (domainInput.trim()) void connect(domainInput);
            }}
          >
            <input
              className="input flex-1"
              placeholder="Already own a domain? Enter it — e.g. yourbusiness.com.au"
              value={domainInput}
              onChange={(e) => setDomainInput(e.target.value)}
              disabled={busy}
            />
            <button className="btn-primary" disabled={busy || !domainInput.trim()} type="submit">
              {busy ? "Saving…" : "Connect"}
            </button>
          </form>
        ) : (
          <div className="space-y-3">
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm">
              <p className="font-semibold text-slate-800">
                Point <span className="font-mono">{connected}</span> at your website — add these
                two records wherever the domain is managed (Placid Domains, GoDaddy, etc.):
              </p>
              <table className="mt-2 w-full text-left font-mono text-xs">
                <thead>
                  <tr className="text-slate-400">
                    <th className="py-1 pr-4">Type</th>
                    <th className="py-1 pr-4">Name</th>
                    <th className="py-1">Value</th>
                  </tr>
                </thead>
                <tbody className="text-slate-700">
                  <tr>
                    <td className="py-1 pr-4">A</td>
                    <td className="py-1 pr-4">@</td>
                    <td className="py-1">{status?.targetIp}</td>
                  </tr>
                  <tr>
                    <td className="py-1 pr-4">CNAME</td>
                    <td className="py-1 pr-4">www</td>
                    <td className="py-1">{status?.cnameTarget}</td>
                  </tr>
                </tbody>
              </table>
              <p className="mt-2 text-xs text-slate-500">
                DNS changes can take a few minutes to a few hours. The security certificate
                issues itself automatically the first time the domain is visited after DNS goes
                live{status?.published === false ? " — and remember to Publish the site above" : ""}.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button className="btn-secondary text-sm" onClick={() => void refresh()} disabled={checking} type="button">
                {checking ? "Checking…" : "Check status"}
              </button>
              <a
                className="btn-secondary text-sm"
                href={`https://${connected}`}
                target="_blank"
                rel="noreferrer"
              >
                Open {connected} ↗
              </a>
              <button
                className="btn-ghost text-sm text-red-600"
                onClick={() => void connect(null)}
                disabled={busy}
                type="button"
              >
                Disconnect
              </button>
            </div>
          </div>
        )}
        {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
      </div>
    </div>
  );
}
