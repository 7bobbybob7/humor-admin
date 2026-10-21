"use client";

import { useActionState } from "react";
import { createMedia, type MediaState } from "../actions";

export function CreateForm() {
  const [state, formAction, pending] = useActionState<MediaState, FormData>(
    createMedia,
    {},
  );

  return (
    <form action={formAction} className="space-y-5">
      <label className="block text-sm">
        <span className="mb-1.5 block font-display text-base font-bold">Topic</span>
        <input
          name="topic"
          required
          maxLength={120}
          placeholder="the printer in the library basement"
          className="w-full rounded-xl border-2 border-ink bg-paper-raised px-4 py-3 font-medium focus:outline-none focus:ring-4 focus:ring-comic-yellow"
        />
        <span className="mt-1.5 block text-xs text-ink-soft">
          Gemini writes three captions. They are attributed to your admin
          account and appear in the public feed.
        </span>
      </label>

      {state.error && (
        <p className="panel-sm bg-red-tint px-4 py-3 text-sm font-semibold">
          {state.error}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="press panel-sm bg-comic-red px-6 py-3 font-bold text-white disabled:opacity-60"
      >
        {pending ? "Generating…" : "Generate 3 captions"}
      </button>
      {pending && (
        <p className="text-sm text-ink-soft">
          Calling the model. Usually a second or two.
        </p>
      )}
    </form>
  );
}
