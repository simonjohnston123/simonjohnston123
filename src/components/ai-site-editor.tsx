"use client";

import { useRef, useState } from "react";

/**
 * AI website editor — a live preview of the business's site with a prompt box.
 * Type what you want changed; the AI applies it (site-builder blocks for CRM
 * sites, the live content API for external custom sites) and the preview
 * reloads. Photos attach via 📎 — they upload to the location's media library
 * and the AI places them on the page.
 */
export function AiSiteEditor({
  locationId,
  previewUrl,
  mode,
}: {
  locationId: string;
  previewUrl: string;
  /** "builder" = CRM site-builder site · "external" = custom-built site */
  mode: "builder" | "external";
}) {
  const [instruction, setInstruction] = useState("");
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [attachments, setAttachments] = useState<Array<{ url: string; filename: string }>>([]);
  const [log, setLog] = useState<Array<{ who: "you" | "ai"; text: string; ok?: boolean }>>([]);
  const [tick, setTick] = useState(0);
  const fileRef = useRef<HTMLInputElement | null>(null);

  async function attach(files: FileList | null) {
    if (!files?.length) return;
    setUploading(true);
    try {
      for (const file of Array.from(files).slice(0, 4)) {
        const form = new FormData();
        form.set("locationId", locationId);
        form.set("file", file);
        const res = await fetch("/api/media/upload", { method: "POST", body: form });
        const data = await res.json();
        if (res.ok && data.url) {
          setAttachments((a) => [...a, { url: data.url, filename: data.filename || file.name }]);
        } else {
          setLog((l) => [...l, { who: "ai", ok: false, text: data.error || `Couldn't upload ${file.name}.` }]);
        }
      }
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const ask = instruction.trim();
    if (!ask || busy) return;
    setBusy(true);
    setLog((l) => [
      ...l,
      { who: "you", text: ask + (attachments.length ? ` (📎 ${attachments.map((a) => a.filename).join(", ")})` : "") },
    ]);
    setInstruction("");
    try {
      const res = await fetch("/api/ai/site-edit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ locationId, instruction: ask, attachments }),
      });
      const data = await res.json();
      if (!res.ok) {
        setLog((l) => [...l, { who: "ai", ok: false, text: data.error || "That didn't work — try rephrasing." }]);
      } else {
        setLog((l) => [...l, { who: "ai", ok: true, text: data.summary || "Done — preview updated." }]);
        setAttachments([]);
        setTick((t) => t + 1); // reload the preview
      }
    } catch {
      setLog((l) => [...l, { who: "ai", ok: false, text: "Network error — try again." }]);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="card overflow-hidden">
      <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="text-lg">✨</span>
          <h3 className="font-semibold text-slate-900">AI website editor</h3>
          <span className="badge bg-slate-100 text-slate-600">
            {mode === "external" ? "live site" : "site builder"}
          </span>
        </div>
        <a href={previewUrl} target="_blank" rel="noreferrer" className="text-sm font-medium text-brand-600 hover:underline">
          Open full site ↗
        </a>
      </div>

      {/* Live preview */}
      <iframe key={tick} src={previewUrl} title="Website preview" className="h-[560px] w-full border-0 bg-white" />

      {/* Conversation log */}
      {log.length > 0 && (
        <div className="max-h-44 space-y-2 overflow-y-auto border-t border-slate-100 px-4 py-3">
          {log.map((m, i) => (
            <div key={i} className="flex gap-2 text-sm">
              <span className="shrink-0">{m.who === "you" ? "🧑" : m.ok === false ? "⚠️" : "✨"}</span>
              <p className={m.who === "you" ? "text-slate-700" : m.ok === false ? "text-amber-700" : "text-slate-500"}>
                {m.text}
              </p>
            </div>
          ))}
          {busy && (
            <div className="flex gap-2 text-sm">
              <span>✨</span>
              <p className="animate-pulse text-slate-400">Making the change…</p>
            </div>
          )}
        </div>
      )}

      {/* Attached photos waiting to be used */}
      {attachments.length > 0 && (
        <div className="flex flex-wrap gap-2 border-t border-slate-100 px-4 py-2">
          {attachments.map((a, i) => (
            <span key={i} className="badge bg-brand-50 text-brand-700">
              🖼️ {a.filename}
              <button
                type="button"
                className="ml-1.5 text-brand-400 hover:text-brand-700"
                onClick={() => setAttachments((x) => x.filter((_, j) => j !== i))}
                aria-label={`Remove ${a.filename}`}
              >
                ×
              </button>
            </span>
          ))}
        </div>
      )}

      {/* Prompt box */}
      <form onSubmit={submit} className="flex gap-2 border-t border-slate-100 p-3">
        {mode === "builder" && (
          <>
            <input
              ref={fileRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              multiple
              className="hidden"
              onChange={(e) => attach(e.target.files)}
            />
            <button
              type="button"
              className="btn-secondary px-3"
              title="Attach photos for the AI to place on the page"
              onClick={() => fileRef.current?.click()}
              disabled={uploading || busy}
            >
              {uploading ? "…" : "📎"}
            </button>
          </>
        )}
        <input
          className="input flex-1"
          value={instruction}
          onChange={(e) => setInstruction(e.target.value)}
          placeholder={
            mode === "external"
              ? 'Tell the AI what to change — e.g. "add an announcement: first month half price"'
              : 'e.g. "add an About Us page" · "put this photo in the hero" (attach with 📎)'
          }
          disabled={busy}
        />
        <button className="btn-primary" disabled={busy || !instruction.trim()} type="submit">
          {busy ? "Working…" : "Apply"}
        </button>
      </form>
    </div>
  );
}
