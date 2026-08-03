"use client";

import { useRef, useState, useTransition } from "react";
import { practiceTurnAction, teachReceptionistAction } from "@/app/dashboard/l/[locationId]/receptionist/actions";

type Msg = { role: "caller" | "ai"; text: string };

// Train the receptionist like a staff member: practice a call in chat, and hit
// "Teach it" under any answer to correct it — the correction is saved to its
// brain permanently and applies to real phone calls immediately.
export function ReceptionistTrainer({ locationId, greeting }: { locationId: string; greeting: string }) {
  const [msgs, setMsgs] = useState<Msg[]>([{ role: "ai", text: greeting }]);
  const [input, setInput] = useState("");
  const [teaching, setTeaching] = useState<number | null>(null); // index of AI msg being corrected
  const [correction, setCorrection] = useState("");
  const [note, setNote] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const boxRef = useRef<HTMLDivElement>(null);

  function send() {
    const text = input.trim();
    if (!text || pending) return;
    const next: Msg[] = [...msgs, { role: "caller", text }];
    setMsgs(next);
    setInput("");
    start(async () => {
      const r = await practiceTurnAction(locationId, next);
      setMsgs((m) => [...m, { role: "ai", text: r.say ?? r.error ?? "…" }]);
      setTimeout(() => boxRef.current?.scrollTo({ top: 99999, behavior: "smooth" }), 50);
    });
  }

  function saveTeaching(i: number) {
    const askedBefore = [...msgs.slice(0, i)].reverse().find((m) => m.role === "caller")?.text ?? "";
    start(async () => {
      const r = await teachReceptionistAction(locationId, askedBefore, correction);
      setNote(r.ok ? "✓ Learned — applies to real calls immediately." : r.error ?? "Couldn't save.");
      setTeaching(null); setCorrection("");
      setTimeout(() => setNote(null), 3500);
    });
  }

  return (
    <div className="card p-5">
      <div className="mb-1 flex items-center justify-between">
        <h3 className="font-semibold text-slate-900">🎓 Practice call — train your receptionist</h3>
        <button onClick={() => setMsgs([{ role: "ai", text: greeting }])} className="text-xs font-semibold text-slate-400 hover:text-slate-600">↺ New call</button>
      </div>
      <p className="mb-3 text-xs text-slate-500">Play the caller. If an answer isn&apos;t right, hit <strong>✏️ Teach it</strong> — your correction is saved to its brain.</p>

      <div ref={boxRef} className="max-h-72 space-y-2 overflow-y-auto rounded-xl border border-slate-100 bg-slate-50 p-3">
        {msgs.map((m, i) => (
          <div key={i}>
            <div className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm ${m.role === "caller" ? "ml-auto bg-slate-900 text-white" : "bg-white text-slate-800 shadow-sm"}`}>
              {m.role === "ai" ? "📞 " : ""}{m.text}
            </div>
            {m.role === "ai" && i > 0 ? (
              teaching === i ? (
                <div className="mt-1 rounded-xl border border-amber-200 bg-amber-50 p-2">
                  <textarea value={correction} onChange={(e) => setCorrection(e.target.value)} rows={2} placeholder="What should it have said or known?" className="w-full resize-none rounded-lg border border-amber-200 bg-white px-2 py-1.5 text-xs outline-none" />
                  <div className="mt-1 flex gap-2">
                    <button onClick={() => saveTeaching(i)} disabled={pending} className="rounded-lg bg-amber-500 px-3 py-1 text-xs font-bold text-white">Save lesson</button>
                    <button onClick={() => { setTeaching(null); setCorrection(""); }} className="rounded-lg px-2 py-1 text-xs text-slate-500">Cancel</button>
                  </div>
                </div>
              ) : (
                <button onClick={() => setTeaching(i)} className="mt-0.5 text-[11px] font-semibold text-amber-600 hover:text-amber-700">✏️ Teach it</button>
              )
            ) : null}
          </div>
        ))}
        {pending ? <div className="w-14 rounded-2xl bg-white px-3 py-2 text-sm shadow-sm">…</div> : null}
      </div>
      {note ? <p className="mt-2 text-xs font-semibold text-emerald-600">{note}</p> : null}

      <div className="mt-3 flex gap-2">
        <input value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => e.key === "Enter" && send()} placeholder="Type what a caller would say…" className="flex-1 rounded-full border border-slate-200 px-4 py-2 text-sm outline-none focus:border-brand-400" />
        <button onClick={send} disabled={pending} className="rounded-full bg-slate-900 px-4 py-2 text-sm font-bold text-white disabled:opacity-50">Say it</button>
      </div>
    </div>
  );
}
