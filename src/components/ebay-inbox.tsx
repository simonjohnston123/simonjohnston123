"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  syncEbayMessagesAction,
  draftEbayReplyAction,
  sendEbayReplyAction,
  draftAllEbayRepliesAction,
} from "@/app/dashboard/l/[locationId]/conversations/ebay-actions";

/** Header controls: pull buyer questions in, and pre-draft the open ones. */
export function EbaySyncButton({ locationId }: { locationId: string }) {
  const router = useRouter();
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const run = (fn: () => Promise<{ ok: boolean; message: string }>) =>
    start(async () => {
      const r = await fn();
      setMsg(r.message);
      router.refresh();
    });

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={() => run(() => syncEbayMessagesAction(locationId, 30))}
        disabled={pending}
        className="btn-secondary text-sm"
        title="Import buyer questions from eBay"
      >
        {pending ? "Working…" : "🏷️ Pull eBay questions"}
      </button>
      <button
        onClick={() => run(() => draftAllEbayRepliesAction(locationId))}
        disabled={pending}
        className="btn-secondary text-sm"
        title="Write an AI draft for each unanswered question — nothing is sent"
      >
        ✨ Draft all
      </button>
      {msg ? <span className="text-xs font-medium text-slate-500">{msg}</span> : null}
    </div>
  );
}

/**
 * eBay reply composer. The AI writes a draft; a human reads, edits and sends.
 * Nothing reaches the buyer without that click.
 */
export function EbayReplyBox({
  locationId,
  conversationId,
  initialDraft,
  itemUrl,
}: {
  locationId: string;
  conversationId: string;
  initialDraft: string | null;
  itemUrl: string | null;
}) {
  const router = useRouter();
  const [text, setText] = useState(initialDraft ?? "");
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState(false);
  const [pending, start] = useTransition();

  // Switching threads must not carry the previous thread's draft across.
  useEffect(() => {
    setText(initialDraft ?? "");
    setMsg(null);
    setErr(false);
  }, [conversationId, initialDraft]);

  const draft = () =>
    start(async () => {
      const r = await draftEbayReplyAction(locationId, conversationId);
      setErr(!r.ok);
      setMsg(r.message);
      if (r.draft) setText(r.draft);
    });

  const send = () =>
    start(async () => {
      const r = await sendEbayReplyAction(locationId, conversationId, text);
      setErr(!r.ok);
      setMsg(r.message);
      if (r.ok) {
        setText("");
        router.refresh();
      }
    });

  return (
    <div className="border-t border-slate-100 p-3">
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <button onClick={draft} disabled={pending} className="btn-secondary text-sm">
          {pending ? "Thinking…" : text ? "✨ Redraft with AI" : "✨ Draft with AI"}
        </button>
        {itemUrl ? (
          <a href={itemUrl} target="_blank" rel="noreferrer" className="text-xs font-medium text-slate-500 underline">
            View listing ↗
          </a>
        ) : null}
        <span className="text-xs text-slate-400">Read it before sending — it goes straight to the buyer.</span>
      </div>

      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={5}
        placeholder="Write a reply, or let the AI draft one for you…"
        className="input w-full resize-y"
      />

      <div className="mt-2 flex items-center gap-3">
        <button onClick={send} disabled={pending || !text.trim()} className="btn-primary">
          Send to buyer on eBay
        </button>
        {msg ? (
          <span className={`text-xs font-semibold ${err ? "text-rose-600" : "text-emerald-600"}`}>{msg}</span>
        ) : null}
      </div>
    </div>
  );
}
