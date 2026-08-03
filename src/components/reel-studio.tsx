"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { searchReelProductsAction, generateReelScriptAction, createRenderJobAction } from "@/app/dashboard/l/[locationId]/social/actions";
import type { ReelScript } from "@/lib/reels";

type Prod = { id: string; name: string; imageUrl: string; priceCents: number };

const PRESENTERS = [
  { id: "dave", name: "Dave", emoji: "😄", blurb: "Energetic pitchman — warm, fast, deal-hungry." },
  { id: "dick", name: "Dick", emoji: "😐", blurb: "Dry and dead straight — gravel voice, zero fluff." },
  { id: "custom", name: "My own photo", emoji: "📸", blurb: "Upload a front-facing photo — it becomes your talking presenter." },
  { id: "music", name: "Music slideshow", emoji: "🎵", blurb: "No presenter — product photos, captions and a music track." },
];
const VOICE_STYLES = [
  { id: "energetic", label: "Energetic & warm" },
  { id: "gravel", label: "Deep & dry" },
];
const MUSIC_VIBES = [
  { id: "upbeat", label: "Upbeat" },
  { id: "chill", label: "Chill" },
  { id: "epic", label: "Epic" },
];

// 🎬 Reel Studio wizard: product → presenter → AI script (editable) → paid render.
export function ReelWizard({ locationId, priceLabel, onClose }: { locationId: string; priceLabel: string; onClose: () => void }) {
  const router = useRouter();
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [q, setQ] = useState("");
  const [results, setResults] = useState<Prod[]>([]);
  const [product, setProduct] = useState<Prod | null>(null);
  const [presenter, setPresenter] = useState("dave");
  const [portraitUrl, setPortraitUrl] = useState<string | null>(null);
  const [voiceStyle, setVoiceStyle] = useState("energetic");
  const [vibe, setVibe] = useState("upbeat");
  const [uploading, setUploading] = useState(false);
  const [script, setScript] = useState<ReelScript | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [pending, start] = useTransition();

  function search() {
    start(async () => setResults(await searchReelProductsAction(locationId, q)));
  }

  // Auto-feed the newest products the moment the wizard opens.
  useEffect(() => {
    let live = true;
    searchReelProductsAction(locationId, "").then((r) => { if (live) setResults(r); });
    return () => { live = false; };
  }, [locationId]);

  function pickProduct(p: Prod) {
    setProduct(p); setStep(2);
  }

  function loadScript() {
    setStep(3); setScript(null); setMsg(null);
    start(async () => {
      const r = product ? await generateReelScriptAction(locationId, product.id) : null;
      if (r) setScript(r.script);
      else setMsg("Couldn't load that product — go back and pick again.");
    });
  }

  function pickPresenter(id: string) {
    setPresenter(id); setMsg(null);
    // Dave/Dick go straight to the script; custom needs a photo, music a vibe.
    if (id === "dave" || id === "dick") loadScript();
  }

  async function uploadPortrait(files: FileList | null) {
    const file = files?.[0];
    if (!file) return;
    setUploading(true); setMsg(null);
    const fd = new FormData();
    fd.set("locationId", locationId);
    fd.set("file", file);
    try {
      const res = await fetch("/api/media/upload", { method: "POST", body: fd });
      const j = await res.json();
      if (!res.ok || j.kind !== "image") setMsg(j.error || "Upload a clear, front-facing photo (JPG/PNG).");
      else setPortraitUrl(j.url);
    } catch { setMsg("Upload failed — try again."); }
    setUploading(false);
  }

  function create() {
    if (!product || !script) return;
    const extras: Record<string, string> = {};
    if (presenter === "custom" && portraitUrl) { extras.portrait_url = portraitUrl; extras.voice_style = voiceStyle; }
    if (presenter === "music") extras.music_vibe = vibe;
    start(async () => {
      const r = await createRenderJobAction({ locationId, productId: product.id, productName: product.name, presenter, script: { ...script, ...extras } });
      if (r.error) { setMsg(r.error); return; }
      setDone(true);
      router.refresh();
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
      <div onClick={(e) => e.stopPropagation()} className="relative z-10 max-h-[85vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white p-5 shadow-2xl">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-lg font-bold text-slate-900">🎬 Create AI marketing video</h3>
          <button onClick={onClose} className="grid h-8 w-8 place-items-center rounded-full bg-slate-100 hover:bg-slate-200">✕</button>
        </div>

        {done ? (
          <div className="py-10 text-center">
            <div className="text-5xl">🎬</div>
            <h4 className="mt-3 text-lg font-bold text-slate-900">Your video is in the render queue</h4>
            <p className="mx-auto mt-1 max-w-sm text-sm text-slate-500">{PRESENTERS.find((p) => p.id === presenter)?.name} is on it — about 15 minutes on the render farm. It'll appear in your Renders strip below the composer, ready to attach to a post. {priceLabel} has been added to this month's usage.</p>
            <button onClick={onClose} className="mt-4 rounded-xl bg-slate-900 px-5 py-2.5 text-sm font-bold text-white">Done</button>
          </div>
        ) : step === 1 ? (
          <div>
            <div className="mb-2 text-sm font-semibold text-slate-700">1 · Which product is the ad for?</div>
            <div className="flex gap-2">
              <input value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === "Enter" && search()} placeholder="Search your products…" className="flex-1 rounded-full border border-slate-200 px-4 py-2 text-sm outline-none focus:border-brand-400" />
              <button onClick={search} disabled={pending} className="rounded-full bg-slate-900 px-4 py-2 text-sm font-bold text-white">{pending ? "…" : "Search"}</button>
            </div>
            <p className="mt-1 text-[11px] text-slate-400">Showing your newest products — search reaches your entire catalogue.</p>
            <div className="mt-3 grid max-h-72 grid-cols-2 gap-2 overflow-y-auto sm:grid-cols-3">
              {results.map((p) => (
                <button key={p.id} onClick={() => pickProduct(p)} className="overflow-hidden rounded-xl border border-slate-100 text-left hover:ring-2 hover:ring-brand-400">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={p.imageUrl} alt="" className="h-24 w-full object-cover" />
                  <div className="p-2"><div className="line-clamp-2 text-xs font-medium text-slate-800">{p.name}</div>
                    <div className="text-xs font-bold text-slate-500">${(p.priceCents / 100).toFixed(2)}</div></div>
                </button>
              ))}
              {!results.length ? <p className="col-span-full py-8 text-center text-sm text-slate-400">Loading your products…</p> : null}
            </div>
          </div>
        ) : step === 2 ? (
          <div>
            <div className="mb-2 text-sm font-semibold text-slate-700">2 · Pick your presenter (or go presenter-free)</div>
            <div className="grid gap-3 sm:grid-cols-2">
              {PRESENTERS.map((p) => (
                <button key={p.id} onClick={() => pickPresenter(p.id)} className={`rounded-2xl border p-4 text-left transition hover:ring-2 hover:ring-brand-400 ${presenter === p.id ? "border-transparent ring-2 ring-brand-400" : "border-slate-200"}`}>
                  <div className="text-4xl">{p.emoji}</div>
                  <div className="mt-1 font-bold text-slate-900">{p.name}</div>
                  <div className="text-xs text-slate-500">{p.blurb}</div>
                </button>
              ))}
            </div>

            {presenter === "custom" ? (
              <div className="mt-3 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div className="text-sm font-semibold text-slate-700">Your presenter&apos;s photo</div>
                <p className="mb-2 text-xs text-slate-500">A clear, front-facing head-and-shoulders shot works best — you, a team member, or a mascot.</p>
                <div className="flex flex-wrap items-center gap-3">
                  {portraitUrl ? (/* eslint-disable-next-line @next/next/no-img-element */ <img src={portraitUrl} alt="presenter" className="h-20 w-20 rounded-xl border border-slate-200 object-cover" />) : null}
                  <label className="cursor-pointer rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-100">
                    {uploading ? "Uploading…" : portraitUrl ? "Change photo" : "📁 Upload photo"}
                    <input type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={(e) => uploadPortrait(e.target.files)} />
                  </label>
                  <select value={voiceStyle} onChange={(e) => setVoiceStyle(e.target.value)} className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm">
                    {VOICE_STYLES.map((v) => <option key={v.id} value={v.id}>{v.label} voice</option>)}
                  </select>
                  <button onClick={loadScript} disabled={!portraitUrl} className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-bold text-white disabled:opacity-40">Continue →</button>
                </div>
              </div>
            ) : null}

            {presenter === "music" ? (
              <div className="mt-3 flex flex-wrap items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div className="text-sm font-semibold text-slate-700">Music vibe:</div>
                {MUSIC_VIBES.map((v) => (
                  <button key={v.id} onClick={() => setVibe(v.id)} className={`rounded-full border px-3 py-1.5 text-sm font-medium ${vibe === v.id ? "border-transparent bg-slate-900 text-white" : "border-slate-300 bg-white text-slate-700"}`}>{v.label}</button>
                ))}
                <button onClick={loadScript} className="ml-auto rounded-xl bg-slate-900 px-4 py-2 text-sm font-bold text-white">Continue →</button>
              </div>
            ) : null}

            <button onClick={() => setStep(1)} className="mt-3 text-xs font-semibold text-slate-400">‹ Change product</button>
          </div>
        ) : (
          <div>
            <div className="mb-2 text-sm font-semibold text-slate-700">3 · The script — edit anything, it&apos;s your ad</div>
            {!script ? (
              <div className="grid h-40 place-items-center text-sm text-slate-400">{msg ?? "✍️ Writing your 30-second script…"}</div>
            ) : (
              <div className="space-y-2">
                <input value={script.overlay_title} onChange={(e) => setScript({ ...script, overlay_title: e.target.value.slice(0, 48) })} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm font-bold outline-none" />
                {script.chunks.map((c, i) => (
                  <textarea key={i} value={c} rows={3} onChange={(e) => setScript({ ...script, chunks: script.chunks.map((x, j) => (j === i ? e.target.value : x)) })} className="w-full resize-y rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none" />
                ))}
                <div className="flex items-center justify-between rounded-xl bg-slate-50 p-3">
                  <div className="text-sm text-slate-600">{presenter === "music" ? <>Style: <strong>Music slideshow ({vibe})</strong> — the lines above become on-screen captions</> : presenter === "custom" ? <>Presenter: <strong>your photo</strong> ({VOICE_STYLES.find((v) => v.id === voiceStyle)?.label.toLowerCase()} voice)</> : <>Presenter: <strong className="capitalize">{presenter}</strong></>} · ~30s vertical video</div>
                  <button onClick={create} disabled={pending} className="rounded-xl bg-brand-gradient px-5 py-2.5 text-sm font-bold text-white disabled:opacity-50">{pending ? "Queuing…" : `Create my ad · ${priceLabel}`}</button>
                </div>
                {msg ? <p className="text-sm text-red-600">{msg}</p> : null}
              </div>
            )}
            <button onClick={() => setStep(2)} className="mt-3 text-xs font-semibold text-slate-400">‹ Change presenter</button>
          </div>
        )}
      </div>
    </div>
  );
}
