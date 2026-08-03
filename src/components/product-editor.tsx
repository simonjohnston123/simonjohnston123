"use client";

import { useState } from "react";
import { useFormState } from "react-dom";
import { SubmitButton } from "@/components/submit-button";
import { updateProductAction } from "@/app/dashboard/l/[locationId]/products/actions";

const INIT = { error: "", ok: false as boolean | undefined };

export function ProductEditor({
  locationId,
  productId,
  name: n,
  price,
  description,
  imageUrl,
  active,
  categoryId,
  categories,
}: {
  locationId: string;
  productId: string;
  name: string;
  price: number | null;
  description: string;
  imageUrl: string;
  active: boolean;
  categoryId?: string;
  categories?: { id: string; name: string }[];
}) {
  const [state, action] = useFormState(updateProductAction, INIT);
  const [img, setImg] = useState(imageUrl);
  const [uploading, setUploading] = useState(false);
  const [upErr, setUpErr] = useState<string | null>(null);

  async function uploadPhoto(files: FileList | null) {
    const file = files?.[0];
    if (!file) return;
    setUploading(true); setUpErr(null);
    const fd = new FormData();
    fd.set("locationId", locationId);
    fd.set("file", file);
    try {
      const res = await fetch("/api/media/upload", { method: "POST", body: fd });
      const j = await res.json();
      if (!res.ok || j.kind !== "image") setUpErr(j.error || "Use a JPG, PNG or WebP image.");
      else setImg(j.url);
    } catch { setUpErr("Upload failed — try again."); }
    setUploading(false);
  }

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="locationId" value={locationId} />
      <input type="hidden" name="productId" value={productId} />

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="sm:col-span-2">
          <label className="label">Name</label>
          <input name="name" defaultValue={n} className="input" />
        </div>
        <div>
          <label className="label">Price ($)</label>
          <input name="price" defaultValue={price ?? ""} inputMode="decimal" className="input" />
        </div>
      </div>

      <div>
        <label className="label">Description</label>
        <textarea name="description" defaultValue={description} rows={4} className="input" />
      </div>

      {categories?.length ? (
        <div>
          <label className="label" htmlFor="categoryId">Category</label>
          <select id="categoryId" name="categoryId" defaultValue={categoryId ?? ""} className="input">
            <option value="">— Uncategorised —</option>
            {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
      ) : null}

      <div>
        <label className="label">Product photo</label>
        <input type="hidden" name="imageUrl" value={img} />
        <div className="flex flex-wrap items-center gap-3">
          {img ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={img} alt="" className="h-24 w-24 rounded-lg border border-slate-200 object-cover" />
          ) : (
            <div className="grid h-24 w-24 place-items-center rounded-lg border border-dashed border-slate-300 text-2xl text-slate-300">📷</div>
          )}
          <div className="space-y-1.5">
            <label className="inline-block cursor-pointer rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50">
              {uploading ? "Uploading…" : img ? "Change photo" : "📁 Upload photo"}
              <input type="file" accept="image/jpeg,image/png,image/webp,image/gif" hidden onChange={(e) => uploadPhoto(e.target.files)} />
            </label>
            {img ? <button type="button" onClick={() => setImg("")} className="ml-2 text-xs font-semibold text-slate-400 hover:text-red-500">Remove</button> : null}
            <div>
              <input value={img} onChange={(e) => setImg(e.target.value)} placeholder="…or paste an image URL" className="w-64 rounded-lg border border-slate-200 px-2 py-1 text-xs text-slate-500 outline-none focus:border-brand-400" />
            </div>
            {upErr ? <p className="text-xs text-red-600">{upErr}</p> : null}
          </div>
        </div>
      </div>

      <label className="flex items-center gap-2 text-sm text-slate-700">
        <input type="checkbox" name="active" defaultChecked={active} className="h-4 w-4" />
        Show on the shop page
      </label>

      <div className="flex items-center gap-3">
        <SubmitButton className="btn-primary">Save product</SubmitButton>
        {state.ok ? <span className="text-sm text-green-600">Saved ✓</span> : null}
        {state.error ? <span className="text-sm text-red-600">{state.error}</span> : null}
      </div>
    </form>
  );
}
