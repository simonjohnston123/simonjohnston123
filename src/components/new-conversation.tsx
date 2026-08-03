"use client";

import { useMemo, useState } from "react";
import { startConversationAction } from "@/app/dashboard/l/[locationId]/conversations/actions";

type ContactOption = { id: string; label: string; email?: string | null; phone?: string | null };

// Compose: type or paste ANY email address / phone number in "To" — matching
// contacts appear as you type, and anything new is saved as a contact
// automatically when you send. No need to leave the inbox first.
export function NewConversationButton({
  locationId,
  contacts,
}: {
  locationId: string;
  contacts: ContactOption[];
}) {
  const [open, setOpen] = useState(false);
  const [to, setTo] = useState("");
  const [picked, setPicked] = useState<ContactOption | null>(null);
  const [channel, setChannel] = useState("EMAIL");

  const matches = useMemo(() => {
    const q = to.trim().toLowerCase();
    if (!q || picked) return [];
    return contacts
      .filter((c) => `${c.label} ${c.email ?? ""} ${c.phone ?? ""}`.toLowerCase().includes(q))
      .slice(0, 6);
  }, [to, picked, contacts]);

  const looksEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to.trim());
  const looksPhone = /^\+?[\d\s()-]{7,16}$/.test(to.trim());
  const valid = !!picked || looksEmail || looksPhone;

  function reset() {
    setOpen(false); setTo(""); setPicked(null); setChannel("EMAIL");
  }

  return (
    <>
      <button className="btn-primary text-sm" onClick={() => setOpen(true)}>+ New</button>
      {open ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4" onClick={reset}>
          <div className="card w-full max-w-md p-6" onClick={(e) => e.stopPropagation()}>
            <h2 className="mb-4 text-lg font-semibold text-slate-900">New message</h2>
            <form action={startConversationAction} className="space-y-4">
              <input type="hidden" name="locationId" value={locationId} />
              <input type="hidden" name="contactId" value={picked?.id ?? ""} />

              <div className="relative">
                <label className="label" htmlFor="to">To</label>
                {picked ? (
                  <div className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                    <span className="text-sm font-medium text-slate-800">
                      {picked.label}
                      <span className="ml-2 text-slate-400">{picked.email || picked.phone}</span>
                    </span>
                    <button type="button" onClick={() => { setPicked(null); setTo(""); }} className="text-xs font-semibold text-slate-400 hover:text-red-500">change</button>
                  </div>
                ) : (
                  <>
                    <input
                      id="to"
                      name="to"
                      value={to}
                      onChange={(e) => setTo(e.target.value)}
                      autoComplete="off"
                      placeholder="Paste an email or phone, or search a contact…"
                      className="input"
                    />
                    {matches.length ? (
                      <ul className="absolute z-10 mt-1 w-full overflow-hidden rounded-lg border border-slate-200 bg-white shadow-lg">
                        {matches.map((c) => (
                          <li key={c.id}>
                            <button
                              type="button"
                              onClick={() => { setPicked(c); setTo(""); }}
                              className="flex w-full items-baseline gap-2 px-3 py-2 text-left text-sm hover:bg-slate-50"
                            >
                              <span className="font-medium text-slate-800">{c.label}</span>
                              <span className="text-xs text-slate-400">{c.email || c.phone}</span>
                            </button>
                          </li>
                        ))}
                      </ul>
                    ) : null}
                    {to && !valid ? (
                      <p className="mt-1 text-xs text-amber-600">Enter a full email address or phone number.</p>
                    ) : null}
                    {to && valid && !matches.length ? (
                      <p className="mt-1 text-xs text-emerald-600">✓ New contact — we&apos;ll save {to.trim()} to your contacts automatically.</p>
                    ) : null}
                  </>
                )}
              </div>

              <div>
                <label className="label" htmlFor="channel">Channel</label>
                <select id="channel" name="channel" value={channel} onChange={(e) => setChannel(e.target.value)} className="input">
                  <option value="EMAIL">Email</option>
                  <option value="SMS">SMS</option>
                  <option value="WHATSAPP">WhatsApp</option>
                  <option value="WEBCHAT">Web chat</option>
                </select>
              </div>

              {channel === "EMAIL" ? (
                <div>
                  <label className="label" htmlFor="subject">Subject</label>
                  <input id="subject" name="subject" className="input" placeholder="Subject" />
                </div>
              ) : null}

              <div>
                <label className="label" htmlFor="body">Message</label>
                <textarea id="body" name="body" rows={4} className="input" placeholder="Type a message…" />
              </div>

              <div className="flex justify-end gap-2">
                <button type="button" className="btn-secondary" onClick={reset}>Cancel</button>
                <button className="btn-primary" disabled={!valid}>Send</button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </>
  );
}
