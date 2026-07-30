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
}: {
  locationId: string;
  productId: string;
  name: string;
  price: number | null;
  description: string;
  imageUrl: string;
  active: boolean;
}) {
  const [state, action] = useFormState(updateProductAction, INIT);
  const [img, setImg] = useState(imageUrl);

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

      <div>
        <label className="label">Image URL</label>
        <input name="imageUrl" value={img} onChange={(e) => setImg(e.target.value)} placeholder="https://…" className="input" />
        {img ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={img} alt="" className="mt-2 h-32 rounded-lg object-cover" />
        ) : null}
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
