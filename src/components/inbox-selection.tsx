"use client";

import {
  createContext,
  useCallback,
  useContext,
  useState,
  useTransition,
  type ReactNode,
} from "react";

/**
 * Bulk-select tooling for the Inbox conversation list. A client Context
 * provider wraps the (server-rendered) list so per-row checkboxes and the
 * floating action bar can share selection state without a big refactor.
 */

type SelectionCtx = {
  selected: Set<string>;
  toggle: (id: string) => void;
  clear: () => void;
  setAll: (on: boolean) => void;
  allIds: string[];
};

const Ctx = createContext<SelectionCtx | null>(null);

function useSelection(): SelectionCtx {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useSelection must be used inside <SelectionProvider>");
  return ctx;
}

export function SelectionProvider({ allIds, children }: { allIds: string[]; children: ReactNode }) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const toggle = useCallback((id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);
  const clear = useCallback(() => setSelected(new Set()), []);
  const setAll = useCallback((on: boolean) => setSelected(on ? new Set(allIds) : new Set()), [allIds]);
  return <Ctx.Provider value={{ selected, toggle, clear, setAll, allIds }}>{children}</Ctx.Provider>;
}

/** Per-row checkbox. Stops click propagation so it never triggers row navigation. */
export function RowCheckbox({ id }: { id: string }) {
  const { selected, toggle } = useSelection();
  return (
    <input
      type="checkbox"
      checked={selected.has(id)}
      onChange={() => toggle(id)}
      onClick={(e) => e.stopPropagation()}
      className="ml-2 h-4 w-4 shrink-0 cursor-pointer rounded border-slate-300 text-brand-600 focus:ring-brand-500"
      aria-label="Select conversation"
    />
  );
}

/** "Select all" checkbox for the list header. */
export function SelectAllCheckbox() {
  const { selected, allIds, setAll } = useSelection();
  const allOn = allIds.length > 0 && selected.size === allIds.length;
  const some = selected.size > 0 && !allOn;
  return (
    <label className="flex cursor-pointer select-none items-center gap-1.5 text-[11px] font-medium text-slate-500">
      <input
        type="checkbox"
        checked={allOn}
        ref={(el) => {
          if (el) el.indeterminate = some;
        }}
        onChange={(e) => setAll(e.target.checked)}
        className="h-4 w-4 cursor-pointer rounded border-slate-300 text-brand-600 focus:ring-brand-500"
      />
      Select all
    </label>
  );
}

/**
 * Floating bar shown only when ≥1 conversation is selected. Calls the passed
 * server action with the selected ids. The action is passed as a prop from the
 * server component so this file needn't import from a dynamic-route path.
 */
export function BulkActionBar({
  locationId,
  action,
}: {
  locationId: string;
  action: (locationId: string, ids: string[]) => Promise<void>;
}) {
  const { selected, clear } = useSelection();
  const [pending, start] = useTransition();
  if (selected.size === 0) return null;
  const ids = Array.from(selected);
  const n = ids.length;
  return (
    <div className="sticky bottom-2 z-10 mt-2 flex items-center justify-between gap-2 rounded-xl border border-slate-200 bg-white/95 px-3 py-2 shadow-lg backdrop-blur">
      <span className="text-sm font-semibold text-slate-700">
        {n} selected
      </span>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={clear}
          disabled={pending}
          className="rounded-lg px-2.5 py-1 text-sm text-slate-500 hover:bg-slate-100 disabled:opacity-50"
        >
          Clear
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={() => {
            if (!window.confirm(`Delete ${n} conversation${n > 1 ? "s" : ""} and all their messages? This can't be undone.`)) return;
            start(async () => {
              await action(locationId, ids);
              clear();
            });
          }}
          className="rounded-lg bg-rose-600 px-3 py-1 text-sm font-medium text-white hover:bg-rose-700 disabled:opacity-50"
        >
          {pending ? "Deleting…" : `Delete ${n}`}
        </button>
      </div>
    </div>
  );
}
