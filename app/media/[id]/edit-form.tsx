"use client";

import { useActionState } from "react";
import { updateMedia, type MediaState } from "../actions";
import type { Generation } from "@/lib/queries";

export function EditForm({ row }: { row: Generation }) {
  const [state, formAction, pending] = useActionState<MediaState, FormData>(
    updateMedia,
    {},
  );

  return (
    <form action={formAction} className="space-y-5">
      <input type="hidden" name="id" value={row.id} />

      <label className="block text-sm">
        <span className="mb-1.5 block font-display text-base font-bold">Caption</span>
        <textarea
          name="caption"
          defaultValue={row.caption}
          required
          rows={3}
          maxLength={400}
          className="w-full rounded-xl border-2 border-ink bg-paper-raised px-4 py-3 font-medium focus:outline-none focus:ring-4 focus:ring-comic-yellow"
        />
      </label>

      <label className="block text-sm">
        <span className="mb-1.5 block font-display text-base font-bold">Prompt</span>
        <input
          name="prompt"
          defaultValue={row.prompt}
          required
          maxLength={120}
          className="w-full rounded-xl border-2 border-ink bg-paper-raised px-4 py-2.5 font-medium focus:outline-none focus:ring-4 focus:ring-comic-yellow"
        />
        <span className="mt-1.5 block text-xs text-ink-soft">
          The topic a user typed. The full text sent to the model is shown below
          and is not editable — it is the record of what actually produced this.
        </span>
      </label>

      {state.error && (
        <p className="panel-sm bg-red-tint px-4 py-3 text-sm font-semibold">
          {state.error}
        </p>
      )}
      {state.success && (
        <p className="panel-sm bg-green-tint px-4 py-3 text-sm font-semibold">
          {state.success}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="press panel-sm bg-comic-red px-6 py-3 font-bold text-white disabled:opacity-60"
      >
        {pending ? "Saving…" : "Save changes"}
      </button>
    </form>
  );
}
