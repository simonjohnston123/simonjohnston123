"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  syncEbayMessagesAction,
  draftEbayReplyAction,
  sendEbayReplyAction,
  draftAllEbayRepliesAction,
  listAndOfferAction,
} from "@/app/dashboard/l/[locationId]/conversations/ebay-actions";

type StockHit = {
  id: string;
  name: string;
  sku: string | null;
  price: string | null;
  inventory: number | null;
  listedOnEbay: boolean;
  ebayItemId: string | null;
  extract: string | null;
};

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
  const [toList, setToList] = useState<StockHit[]>([]);
  const [pending, start] = useTransition();

  // Switching threads must not carry the previous thread's draft across.
  useEffect(() => {
    setText(initialDraft ?? "");
    setMsg(null);
    setErr(false);
    setToList([]);
  }, [conversationId, initialDraft]);

  const draft = () =>
    start(async () => {
      const r = await draftEbayReplyAction(locationId, conversationId);
      setErr(!r.ok);
      setMsg(r.message);
      if (r.draft) setText(r.draft);
      setToList(r.toList ?? []);
    });

  // "We stock it but it isn't up yet" — list it, then drop the item number into
  // the reply so the buyer never has to leave eBay to find it.
  const listIt = (p: StockHit) =>
    start(async () => {
      const r = await listAndOfferAction(locationId, conversationId, p.id);
      setErr(!r.ok);
      setMsg(r.message);
      if (r.ok) {
        if (r.sentence) setText((t) => (t ? `${t.trimEnd()} ${r.sentence}` : r.sentence!));
        setToList((list) => list.filter((x) => x.id !== p.id));
      }
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

      {toList.length ? (
        <div className="mb-2 rounded-lg border border-amber-200 bg-amber-50 p-3">
          <div className="mb-1 text-xs font-semibold text-amber-900">
            In stock but not on eBay yet — list it to give the buyer an item number
          </div>
          <div className="space-y-1.5">
            {toList.map((p) => (
              <div key={p.id} className="flex flex-wrap items-center gap-2">
                <span className="min-w-0 flex-1 truncate text-xs text-slate-700">
                  {p.name}
                  {p.price ? <span className="text-slate-500"> · {p.price}</span> : null}
                  {typeof p.inventory === "number" ? <span className="text-slate-500"> · {p.inventory} in stock</span> : null}
                </span>
                <button onClick={() => listIt(p)} disabled={pending} className="btn-secondary shrink-0 text-xs">
                  List on eBay
                </button>
              </div>
            ))}
          </div>
        </div>
      ) : null}

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
