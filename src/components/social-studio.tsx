"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { saveSocialPostAction, retrySocialPostAction, deleteSocialPostAction } from "@/app/dashboard/l/[locationId]/social/actions";
import { ReelWizard } from "./reel-studio";

export type NetworkStatus = { key: string; label: string; icon: string; ready: boolean; detail: string; connectHref?: string; never?: boolean };
export type QueuePost = {
  id: string; body: string; mediaUrls: string[]; mediaKind: string | null; networks: string[];
  results: Record<string, { ok: boolean; id?: string; error?: string }>;
  scheduledAt: string | null; status: string; createdAt: string;
};
type Media = { url: string; kind: "image" | "video"; name: string };

const STATUS_STYLE: Record<string, string> = {
  PUBLISHED: "bg-emerald-100 text-emerald-700",
  PARTIAL: "bg-amber-100 text-amber-700",
  FAILED: "bg-red-100 text-red-700",
  SCHEDULED: "bg-blue-100 text-blue-700",
  PUBLISHING: "bg-violet-100 text-violet-700",
  DRAFT: "bg-slate-100 text-slate-600",
};

const ADS = [
  { icon: "📘", name: "Meta Ads (Facebook + Instagram)", href: "https://adsmanager.facebook.com", state: "Ads Manager works today with your Pages. In-CRM boosting needs Meta Marketing API approval — queued after App Review." },
  { icon: "🔍", name: "Google Ads + Shopping", href: "https://ads.google.com", state: "Your Shopify store already feeds Google Merchant Center. In-CRM campaign control needs a Google Ads developer token." },
  { icon: "🎵", name: "TikTok Ads", href: "https://ads.tiktok.com", state: "Ads Manager available now; API access comes with the TikTok developer app." },
  { icon: "👻", name: "Snapchat Ads", href: "https://ads.snapchat.com", state: "Snapchat is ads-only (no organic API). Marketing API app needed for in-CRM control." },
  { icon: "🎧", name: "Spotify Ads", href: "https://ads.spotify.com", state: "Runs via Spotify Ad Studio — no public posting/ads API to integrate." },
];

export type ReelJob = { id: string; productName: string; presenter: string; status: string; note: string | null; createdAt: string };

export function SocialStudio({ locationId, networks, fbPages, queue, productImages, reelJobs, reelPrice }: {
  locationId: string; networks: NetworkStatus[]; fbPages: { id: string; name: string }[]; queue: QueuePost[]; productImages: { id: string; name: string; url: string }[];
  reelJobs: ReelJob[]; reelPrice: string;
}) {
  const router = useRouter();
  const [tab, setTab] = useState<"compose" | "queue" | "ads">("compose");
  const [body, setBody] = useState("");
  const [media, setMedia] = useState<Media[]>([]);
  const [sel, setSel] = useState<Set<string>>(new Set(networks.filter((n) => n.ready).slice(0, 2).map((n) => n.key)));
  // Which Facebook Page(s) this post goes to. One page → preselected; several →
  // an explicit choice so one brand's post never lands on another brand's Page.
  const [selPages, setSelPages] = useState<Set<string>>(new Set(fbPages.length === 1 ? [fbPages[0].id] : []));
  const [when, setWhen] = useState("");
  const [showProducts, setShowProducts] = useState(false);
  const [urlDraft, setUrlDraft] = useState("");
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);
  const [uploading, setUploading] = useState(false);
  const [showReel, setShowReel] = useState(false);
  const [pending, start] = useTransition();
  const fileRef = useRef<HTMLInputElement>(null);

  const mediaKind: "image" | "video" | null = media[0]?.kind ?? null;
  const scheduled = queue.filter((p) => p.status === "SCHEDULED");

  function toggle(key: string) {
    setSel((s) => { const n = new Set(s); if (n.has(key)) n.delete(key); else n.add(key); return n; });
  }

  function addMedia(m: Media) {
    setMsg(null);
    setMedia((cur) => {
      if (cur.length && cur[0].kind !== m.kind) { setMsg({ kind: "err", text: "Keep one post to one media type — images or a video, not both." }); return cur; }
      if (m.kind === "video" && (cur.length || media.length)) { setMsg({ kind: "err", text: "One video per post." }); return cur; }
      if (cur.length >= 10) return cur;
      return [...cur, m];
    });
  }

  async function uploadFiles(files: FileList | null) {
    if (!files?.length) return;
    setUploading(true); setMsg(null);
    for (const file of Array.from(files)) {
      const fd = new FormData();
      fd.set("locationId", locationId);
      fd.set("file", file);
      try {
        const res = await fetch("/api/media/upload", { method: "POST", body: fd });
        const j = await res.json();
        if (!res.ok) { setMsg({ kind: "err", text: j.error || "Upload failed." }); continue; }
        addMedia({ url: j.url, kind: j.kind, name: j.filename });
      } catch { setMsg({ kind: "err", text: "Upload failed — check your connection." }); }
    }
    setUploading(false);
    if (fileRef.current) fileRef.current.value = "";
  }

  function addUrl() {
    const u = urlDraft.trim();
    if (!/^https?:\/\//.test(u)) { setMsg({ kind: "err", text: "Paste a full http(s) URL." }); return; }
    addMedia({ url: u, kind: /\.(mp4|mov|webm)(\?|$)/i.test(u) ? "video" : "image", name: u.split("/").pop()?.slice(0, 40) || "media" });
    setUrlDraft("");
  }

  function submit(mode: "now" | "schedule" | "draft") {
    setMsg(null);
    if (mode !== "draft" && sel.has("facebook") && fbPages.length > 1 && selPages.size === 0) {
      setMsg({ kind: "err", text: "Tick which Facebook Page(s) this post goes to." });
      return;
    }
    start(async () => {
      const res = await saveSocialPostAction({
        locationId, body, mediaUrls: media.map((m) => m.url), mediaKind,
        networks: [...sel], mode, scheduledAt: when ? new Date(when).toISOString() : undefined,
        facebookPageIds: [...selPages],
      });
      if (res.error) { setMsg({ kind: "err", text: res.error }); return; }
      setMsg({ kind: "ok", text: mode === "now" ? "Posted — check the Queue tab for per-network results." : mode === "schedule" ? "Scheduled ✓" : "Draft saved." });
      setBody(""); setMedia([]); setWhen("");
      router.refresh();
      if (mode !== "draft") setTab("queue");
    });
  }

  return (
    <div>
      {/* Accounts strip */}
      <div className="mb-4 flex gap-2 overflow-x-auto pb-1">
        {networks.map((n) => (
          <div key={n.key} className={`flex shrink-0 items-center gap-2 rounded-xl border px-3 py-2 ${n.ready ? "border-emerald-200 bg-emerald-50" : "border-slate-200 bg-white"}`} title={n.detail}>
            <span>{n.icon}</span>
            <div className="leading-tight">
              <div className="text-xs font-semibold text-slate-800">{n.label}</div>
              <div className={`text-[10px] ${n.ready ? "text-emerald-600" : "text-slate-400"}`}>{n.ready ? "Ready" : n.never ? "N/A" : "Not ready"}</div>
            </div>
            {n.connectHref ? <a href={n.connectHref} className="ml-1 rounded-full bg-slate-900 px-2.5 py-1 text-[10px] font-bold text-white">Connect</a> : null}
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="mb-4 inline-flex rounded-xl bg-slate-100 p-1 text-sm font-semibold">
        {([["compose", "✏️ Compose"], ["queue", `📋 Queue${scheduled.length ? ` (${scheduled.length})` : ""}`], ["ads", "🎯 Ads"]] as const).map(([k, label]) => (
          <button key={k} onClick={() => setTab(k)} className={`rounded-lg px-4 py-2 transition ${tab === k ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}>{label}</button>
        ))}
      </div>

      {tab === "compose" ? (
        <div className="card max-w-3xl p-5">
          <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={5} placeholder="What are we posting? First line becomes the YouTube title."
            className="w-full resize-y rounded-xl border border-slate-200 p-3 text-sm outline-none focus:border-brand-400" />

          {/* Media */}
          <div className="mt-3">
            {media.length ? (
              <div className="mb-2 flex flex-wrap gap-2">
                {media.map((m, i) => (
                  <div key={i} className="relative">
                    {m.kind === "image"
                      ? /* eslint-disable-next-line @next/next/no-img-element */ <img src={m.url} alt={m.name} className="h-20 w-20 rounded-lg border border-slate-200 object-cover" />
                      : <video src={m.url} className="h-20 w-32 rounded-lg border border-slate-200 object-cover" muted />}
                    <button onClick={() => setMedia((cur) => cur.filter((_, j) => j !== i))} className="absolute -right-1.5 -top-1.5 grid h-5 w-5 place-items-center rounded-full bg-slate-900 text-[10px] text-white">✕</button>
                  </div>
                ))}
              </div>
            ) : null}
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <button onClick={() => fileRef.current?.click()} disabled={uploading} className="rounded-lg border border-slate-200 px-3 py-1.5 font-medium text-slate-700 hover:bg-slate-50">{uploading ? "Uploading…" : "📁 Upload"}</button>
              <input ref={fileRef} type="file" accept="image/*,video/mp4,video/quicktime,video/webm" multiple hidden onChange={(e) => uploadFiles(e.target.files)} />
              <button onClick={() => setShowProducts((v) => !v)} className="rounded-lg border border-slate-200 px-3 py-1.5 font-medium text-slate-700 hover:bg-slate-50">🛍 From products</button>
              <button onClick={() => setShowReel(true)} className="rounded-lg bg-slate-900 px-3 py-1.5 font-bold text-white hover:bg-slate-800">🎬 Create AI video</button>
              <input value={urlDraft} onChange={(e) => setUrlDraft(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addUrl()} placeholder="…or paste a media URL"
                className="min-w-0 flex-1 rounded-lg border border-slate-200 px-3 py-1.5 outline-none focus:border-brand-400" />
              <button onClick={addUrl} className="rounded-lg bg-slate-100 px-3 py-1.5 font-medium text-slate-700">Add</button>
            </div>
            {showProducts ? (
              <div className="mt-2 grid max-h-56 grid-cols-4 gap-2 overflow-y-auto rounded-xl border border-slate-200 p-2 sm:grid-cols-6">
                {productImages.map((p) => (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <button key={p.id} onClick={() => addMedia({ url: p.url, kind: "image", name: p.name })} title={p.name} className="overflow-hidden rounded-lg border border-slate-100 hover:ring-2 hover:ring-brand-400"><img src={p.url} alt={p.name} className="h-16 w-full object-cover" /></button>
                ))}
                {!productImages.length ? <p className="col-span-full p-2 text-xs text-slate-400">No product images yet.</p> : null}
              </div>
            ) : null}
          </div>

          {/* Renders in progress / done */}
          {reelJobs.length ? (
            <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-2.5">
              <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-400">🎬 Your AI videos</div>
              <div className="space-y-1">
                {reelJobs.map((j) => (
                  <div key={j.id} className="flex items-center justify-between gap-2 text-xs">
                    <span className="min-w-0 truncate text-slate-700"><strong className="capitalize">{j.presenter}</strong> · {j.productName}</span>
                    <span className={`shrink-0 rounded-full px-2 py-0.5 font-bold ${j.status === "DONE" ? "bg-emerald-100 text-emerald-700" : j.status === "FAILED" ? "bg-red-100 text-red-600" : "bg-blue-100 text-blue-700"}`}>{j.status === "QUEUED" ? "⏳ queued" : j.status === "RENDERING" ? "🎥 rendering" : j.status.toLowerCase()}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          {/* Networks */}
          <div className="mt-4">
            <div className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-slate-400">Post to</div>
            <div className="flex flex-wrap gap-2">
              {networks.filter((n) => !n.never).map((n) => (
                <button key={n.key} disabled={!n.ready} onClick={() => toggle(n.key)} title={n.detail}
                  className={`rounded-full border px-3 py-1.5 text-sm font-medium transition ${sel.has(n.key) && n.ready ? "border-transparent bg-slate-900 text-white" : n.ready ? "border-slate-200 text-slate-700 hover:bg-slate-50" : "cursor-not-allowed border-slate-100 text-slate-300"}`}>
                  {n.icon} {n.label}{!n.ready ? " 🔒" : ""}
                </button>
              ))}
            </div>
            {sel.has("facebook") && fbPages.length > 1 ? (
              <div className="mt-2 rounded-xl border border-slate-200 bg-slate-50 p-2.5">
                <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-400">Which Facebook Page(s)?</div>
                <div className="flex flex-wrap gap-2">
                  {fbPages.map((pg) => (
                    <label key={pg.id} className="flex cursor-pointer items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700">
                      <input type="checkbox" checked={selPages.has(pg.id)} onChange={() => setSelPages((s) => { const n = new Set(s); if (n.has(pg.id)) n.delete(pg.id); else n.add(pg.id); return n; })} />
                      {pg.name}
                    </label>
                  ))}
                </div>
              </div>
            ) : null}
          </div>

          {/* Schedule + submit */}
          <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-4">
            <button onClick={() => submit("now")} disabled={pending} className="rounded-xl bg-brand-gradient px-5 py-2.5 text-sm font-bold text-white disabled:opacity-50">{pending ? "Working…" : "🚀 Post now"}</button>
            <div className="flex items-center gap-2">
              <input type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} className="rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-brand-400" />
              <button onClick={() => submit("schedule")} disabled={pending || !when} className="rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-40">🕑 Schedule</button>
            </div>
            <button onClick={() => submit("draft")} disabled={pending} className="rounded-xl px-3 py-2.5 text-sm font-semibold text-slate-500 hover:text-slate-700">Save draft</button>
          </div>
          {msg ? <p className={`mt-3 text-sm ${msg.kind === "ok" ? "text-emerald-600" : "text-red-600"}`}>{msg.text}</p> : null}
        </div>
      ) : tab === "queue" ? (
        <div className="max-w-3xl space-y-3">
          {queue.length === 0 ? <div className="card p-8 text-center text-sm text-slate-400">Nothing here yet — compose your first post.</div> : null}
          {queue.map((p) => (
            <div key={p.id} className="card p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${STATUS_STYLE[p.status] ?? STATUS_STYLE.DRAFT}`}>{p.status}</span>
                    {p.scheduledAt ? <span className="text-xs text-slate-400">🕑 {new Date(p.scheduledAt).toLocaleString()}</span> : null}
                  </div>
                  <p className="mt-1.5 line-clamp-2 text-sm text-slate-700">{p.body || <em className="text-slate-400">(media only)</em>}</p>
                </div>
                {p.mediaUrls[0] ? (
                  p.mediaKind === "video"
                    ? <span className="grid h-14 w-14 shrink-0 place-items-center rounded-lg bg-slate-100 text-xl">🎬</span>
                    : /* eslint-disable-next-line @next/next/no-img-element */ <img src={p.mediaUrls[0]} alt="" className="h-14 w-14 shrink-0 rounded-lg object-cover" />
                ) : null}
              </div>
              {p.networks.length ? (
                <div className="mt-2 space-y-1">
                  {p.networks.map((n) => {
                    const r = p.results[n];
                    return (
                      <div key={n} className="flex items-baseline gap-2 text-xs">
                        <span className="font-semibold capitalize text-slate-600">{n.replace("_", " ")}</span>
                        {r ? (r.ok ? <span className="text-emerald-600">✓ {r.id}</span> : <span className="text-red-500">✗ {r.error}</span>) : <span className="text-slate-400">pending</span>}
                      </div>
                    );
                  })}
                </div>
              ) : null}
              <div className="mt-2 flex gap-2">
                {(p.status === "FAILED" || p.status === "PARTIAL") ? (
                  <button onClick={() => start(async () => { await retrySocialPostAction(locationId, p.id); router.refresh(); })} disabled={pending} className="rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-bold text-white">↻ Retry failed</button>
                ) : null}
                <button onClick={() => start(async () => { await deleteSocialPostAction(locationId, p.id); router.refresh(); })} disabled={pending} className="rounded-lg px-3 py-1.5 text-xs font-semibold text-slate-400 hover:text-red-500">Delete</button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="max-w-3xl space-y-3">
          <div className="card border-l-4 border-brand-400 p-4 text-sm text-slate-600">
            <strong className="text-slate-900">Paid ads — where each platform stands.</strong> Organic posting runs from the Compose tab today. Running ads from inside the CRM needs each platform&apos;s marketing API approval; until those land, the buttons below deep-link straight into each ads manager with your accounts.
          </div>
          {ADS.map((a) => (
            <div key={a.name} className="card flex items-center gap-3 p-4">
              <span className="text-2xl">{a.icon}</span>
              <div className="min-w-0 flex-1">
                <div className="text-sm font-semibold text-slate-900">{a.name}</div>
                <div className="text-xs text-slate-500">{a.state}</div>
              </div>
              <a href={a.href} target="_blank" rel="noreferrer" className="shrink-0 rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-bold text-white">Open ↗</a>
            </div>
          ))}
        </div>
      )}

      {showReel ? <ReelWizard locationId={locationId} priceLabel={reelPrice} onClose={() => setShowReel(false)} /> : null}
    </div>
  );
}
