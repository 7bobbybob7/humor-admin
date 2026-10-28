"use client";

import { useState } from "react";
import { deleteRow } from "./actions";

export function DeleteRow({ slug, id }: { slug: string; id: number }) {
  const [armed, setArmed] = useState(false);

  if (!armed) {
    return (
      <button
        type="button"
        onClick={() => setArmed(true)}
        className="rounded-full px-3 py-1 text-xs font-bold text-ink-soft transition hover:bg-red-tint hover:text-ink"
      >
        Delete
      </button>
    );
  }

  return (
    <form action={deleteRow} className="inline-flex items-center gap-1">
      <input type="hidden" name="__resource" value={slug} />
      <input type="hidden" name="__id" value={id} />
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
