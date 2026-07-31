"use client";

import { useFormStatus } from "react-dom";

/**
 * Delete-conversation submit button. Lives inside a form bound to the
 * deleteConversationAction server action; asks for confirmation first so a
 * whole thread isn't removed by accident.
 */
export function DeleteConversationButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      onClick={(e) => {
        if (!window.confirm("Delete this conversation and all its messages? This can't be undone.")) {
          e.preventDefault();
        }
      }}
      className="grid h-9 w-9 shrink-0 place-items-center rounded-xl text-slate-400 hover:bg-rose-50 hover:text-rose-600 disabled:opacity-50"
      aria-label="Delete conversation"
      title="Delete conversation"
    >
      {pending ? "…" : "🗑"}
    </button>
  );
}
