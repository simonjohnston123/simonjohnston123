"use client";

import { useState } from "react";
import { startConversationAction } from "@/app/dashboard/l/[locationId]/conversations/actions";

export function NewConversationButton({
  locationId,
  contacts,
}: {
  locationId: string;
  contacts: { id: string; label: string }[];
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button className="btn-primary text-sm" onClick={() => setOpen(true)}>+ New</button>
      {open ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4" onClick={() => setOpen(false)}>
          <div className="card w-full max-w-md p-6" onClick={(e) => e.stopPropagation()}>
            <h2 className="mb-4 text-lg font-semibold text-slate-900">New conversation</h2>
            {contacts.length === 0 ? (
              <p className="text-sm text-slate-500">Add a contact first to start a conversation.</p>
            ) : (
              <form action={startConversationAction} className="space-y-4">
                <input type="hidden" name="locationId" value={locationId} />
                <div>
                  <label className="label" htmlFor="contactId">Contact</label>
                  <select id="contactId" name="contactId" className="input" required>
                    {contacts.map((c) => (
                      <option key={c.id} value={c.id}>{c.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="label" htmlFor="channel">Channel</label>
                  <select id="channel" name="channel" className="input">
                    <option value="SMS">SMS</option>
                    <option value="EMAIL">Email</option>
                    <option value="WHATSAPP">WhatsApp</option>
                    <option value="WEBCHAT">Web chat</option>
                  </select>
                </div>
                <div>
                  <label className="label" htmlFor="body">First message</label>
                  <textarea id="body" name="body" rows={3} className="input" placeholder="Type a message…" />
                </div>
                <div className="flex justify-end gap-2">
                  <button type="button" className="btn-secondary" onClick={() => setOpen(false)}>Cancel</button>
                  <button className="btn-primary">Start</button>
                </div>
              </form>
            )}
          </div>
        </div>
      ) : null}
    </>
  );
}
