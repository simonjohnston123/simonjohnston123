"use client";

import { useState } from "react";
import { createCategoryAction, renameCategoryAction, deleteCategoryAction } from "@/app/dashboard/l/[locationId]/products/actions";

export type Category = { id: string; name: string; count: number };

// Create categories first, then assign products to them. Deleting a category
// never deletes products — they just become uncategorised.
export function CategoryManager({ locationId, categories }: { locationId: string; categories: Category[] }) {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);

  return (
    <>
      <button onClick={() => setOpen(true)} className="btn-secondary text-sm">🗂 Categories{categories.length ? ` (${categories.length})` : ""}</button>
      {open ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4" onClick={() => setOpen(false)}>
          <div className="card w-full max-w-md p-6" onClick={(e) => e.stopPropagation()}>
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-slate-900">Product categories</h2>
              <button onClick={() => setOpen(false)} className="grid h-8 w-8 place-items-center rounded-full bg-slate-100 hover:bg-slate-200">✕</button>
            </div>

            <form action={createCategoryAction} className="mb-4 flex gap-2">
              <input type="hidden" name="locationId" value={locationId} />
              <input name="name" placeholder="New category name…" className="input flex-1" required />
              <button className="btn-primary text-sm">Add</button>
            </form>

            {categories.length === 0 ? (
              <p className="py-6 text-center text-sm text-slate-400">No categories yet — create your first above.</p>
            ) : (
              <ul className="space-y-1">
                {categories.map((c) => (
                  <li key={c.id} className="flex items-center justify-between rounded-lg border border-slate-100 px-3 py-2">
                    {editing === c.id ? (
                      <form action={renameCategoryAction} className="flex flex-1 gap-2">
                        <input type="hidden" name="locationId" value={locationId} />
                        <input type="hidden" name="categoryId" value={c.id} />
                        <input name="name" defaultValue={c.name} className="input flex-1 py-1 text-sm" autoFocus />
                        <button className="btn-primary px-2 py-1 text-xs">Save</button>
                        <button type="button" onClick={() => setEditing(null)} className="text-xs text-slate-400">Cancel</button>
                      </form>
                    ) : (
                      <>
                        <span className="text-sm text-slate-800">{c.name} <span className="text-slate-400">· {c.count}</span></span>
                        <span className="flex gap-2">
                          <button onClick={() => setEditing(c.id)} className="text-xs font-semibold text-slate-500 hover:text-slate-800">Rename</button>
                          <form action={deleteCategoryAction}>
                            <input type="hidden" name="locationId" value={locationId} />
                            <input type="hidden" name="categoryId" value={c.id} />
                            <button className="text-xs font-semibold text-slate-400 hover:text-red-500">Delete</button>
                          </form>
                        </span>
                      </>
                    )}
                  </li>
                ))}
              </ul>
            )}
            <p className="mt-3 text-xs text-slate-400">Deleting a category keeps its products — they just become uncategorised.</p>
          </div>
        </div>
      ) : null}
    </>
  );
}
