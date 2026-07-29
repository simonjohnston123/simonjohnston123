"use client";

import { useFormState } from "react-dom";
import { createListingAction } from "../actions";
import { CATEGORIES } from "../categories";

export default function NewListing() {
  const [state, action] = useFormState(createListingAction, { error: "" } as { error: string });
  return (
    <main className="mx-auto max-w-lg px-4 py-6">
      <h1 className="mb-1 text-2xl font-bold text-slate-900">List an item</h1>
      <p className="mb-5 text-sm text-slate-500">Reach local buyers on Placid Connect — no listing fees.</p>
      <form action={action} className="space-y-3 rounded-2xl bg-white p-5 shadow-sm">
        <div><label className="label">Title</label><input name="title" required className="input" placeholder="e.g. Toyota HiLux tray" /></div>
        <div className="grid grid-cols-2 gap-3">
          <div><label className="label">Price (AUD)</label><input name="price" type="number" min="0" defaultValue="0" className="input" /></div>
          <div><label className="label">Category</label><select name="category" className="input">{CATEGORIES.map((c) => <option key={c}>{c}</option>)}</select></div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div><label className="label">Condition</label><input name="condition" className="input" placeholder="New / Used" /></div>
          <div><label className="label">Location</label><input name="location" className="input" placeholder="Suburb" /></div>
        </div>
        <div><label className="label">Photo URL</label><input name="imageUrl" className="input" placeholder="https://… (upload coming soon)" /></div>
        <div><label className="label">Description</label><textarea name="description" rows={4} required className="input" placeholder="Describe your item…" /></div>
        {state?.error ? <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</p> : null}
        <button className="w-full rounded-lg bg-brand-gradient py-2.5 font-semibold text-white">Post listing</button>
      </form>
    </main>
  );
}
