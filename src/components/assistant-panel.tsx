"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";

type Msg = { role: "user" | "assistant"; content: string; actions?: string[] };

export function AssistantPanel({ locationId }: { locationId: string }) {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [msgs, setMsgs] = useState<Msg[]>([
    {
      role: "assistant",
      content:
        "Hi! I'm your setup assistant. Tell me what you'd like to build and I'll do it — e.g. “Set up a Sales track with stages New order, Packed, Shipped, Delivered, and email the buyer when it hits Shipped.”",
    },
  ]);
  const scroller = useRef<HTMLDivElement>(null);
  const router = useRouter();

  useEffect(() => {
    scroller.current?.scrollTo({ top: scroller.current.scrollHeight, behavior: "smooth" });
  }, [msgs, open]);

  const send = async () => {
    const text = input.trim();
    if (!text || busy) return;
    const next = [...msgs, { role: "user" as const, content: text }];
    setMsgs(next);
    setInput("");
    setBusy(true);
    try {
      const res = await fetch("/api/assistant", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          locationId,
          messages: next.filter((m) => m.role === "user" || m.role === "assistant").map((m) => ({ role: m.role, content: m.content })),
        }),
      });
      const data = await res.json();
      setMsgs((m) => [...m, { role: "assistant", content: data.reply || "Done.", actions: data.actions }]);
      if (Array.isArray(data.actions) && data.actions.length) router.refresh(); // reflect new tracks/folders
    } catch {
      setMsgs((m) => [...m, { role: "assistant", content: "Sorry, something went wrong. Try again." }]);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      {/* Launcher */}
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="fixed bottom-5 right-5 z-40 flex items-center gap-2 rounded-full bg-brand-gradient px-4 py-3 text-sm font-semibold text-white shadow-glow"
        aria-label="Open AI assistant"
      >
        ✨ Assistant
      </button>

      {open ? (
        <div className="fixed bottom-20 right-5 z-40 flex h-[70vh] max-h-[560px] w-[min(92vw,380px)] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
          <div className="flex items-center justify-between bg-brand-gradient px-4 py-3 text-white">
            <div className="text-sm font-semibold">✨ Setup assistant</div>
            <button type="button" onClick={() => setOpen(false)} className="text-white/80 hover:text-white">✕</button>
          </div>

          <div ref={scroller} className="flex-1 space-y-3 overflow-y-auto bg-slate-50 p-3">
            {msgs.map((m, i) => (
              <div key={i} className={m.role === "user" ? "flex justify-end" : "flex justify-start"}>
                <div
                  className={`max-w-[85%] whitespace-pre-line rounded-2xl px-3 py-2 text-sm ${
                    m.role === "user" ? "bg-brand-gradient text-white" : "bg-white text-slate-800 shadow-sm"
                  }`}
                >
                  {m.content}
                  {m.actions && m.actions.length ? (
                    <ul className="mt-2 space-y-0.5 border-t border-slate-100 pt-2 text-xs text-slate-500">
                      {m.actions.map((a, j) => (
                        <li key={j}>✓ {a}</li>
                      ))}
                    </ul>
                  ) : null}
                </div>
              </div>
            ))}
            {busy ? <div className="text-xs text-slate-400">Working…</div> : null}
          </div>

          <div className="flex items-center gap-2 border-t border-slate-100 p-2">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  send();
                }
              }}
              placeholder="Ask me to set something up…"
              className="input h-10 flex-1 text-sm"
              disabled={busy}
            />
            <button type="button" onClick={send} disabled={busy || !input.trim()} className="btn-primary shrink-0">
              Send
            </button>
          </div>
        </div>
      ) : null}
    </>
  );
}
