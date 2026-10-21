"use client";

import { useState } from "react";
import { deleteMedia } from "./actions";

export function DeleteButton({ id, label = "Delete" }: { id: number; label?: string }) {
  const [armed, setArmed] = useState(false);

  // Two-step rather than window.confirm: a native dialog is easy to dismiss by
  // reflex, and this makes the destructive state visible in the row itself.
  if (!armed) {
    return (
      <button
        type="button"
        onClick={() => setArmed(true)}
        className="rounded-full px-3 py-1 text-xs font-bold text-ink-soft transition hover:bg-red-tint hover:text-ink"
      >
        {label}
      </button>
    );
  }

  return (
    <form action={deleteMedia} className="flex items-center gap-1">
      <input type="hidden" name="id" value={id} />
      <button
        type="submit"
        className="rounded-full border-2 border-ink bg-series-down px-3 py-1 text-xs font-black text-white"
      >
        Confirm
      </button>
      <button
        type="button"
        onClick={() => setArmed(false)}
        className="rounded-full px-2 py-1 text-xs font-bold text-ink-soft hover:text-ink"
      >
        Cancel
      </button>
    </form>
  );
}
