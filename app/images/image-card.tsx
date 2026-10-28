"use client";

import { useActionState, useState } from "react";
import { deleteImage, updateImageAlt, type ImageState } from "./actions";

export type ImageRow = {
  id: number;
  path: string;
  public_url: string;
  alt_text: string | null;
  created_at: string;
};

export function ImageCard({ image }: { image: ImageRow }) {
  const [state, formAction, pending] = useActionState<ImageState, FormData>(
    updateImageAlt,
    {},
  );
  const [armed, setArmed] = useState(false);

  return (
    <li className="panel p-4">
      {/* eslint-disable-next-line @next/next/no-img-element -- Storage URL */}
      <img
        src={image.public_url}
        alt={image.alt_text ?? ""}
        className="h-40 w-full rounded-lg border-2 border-ink object-cover"
      />

      <p className="mt-2 break-all font-mono text-[11px] text-ink-soft">
        {image.path}
      </p>

      <form action={formAction} className="mt-3 space-y-2">
        <input type="hidden" name="id" value={image.id} />
        <input
          name="alt_text"
          defaultValue={image.alt_text ?? ""}
          maxLength={200}
          placeholder="Alt text"
          className="w-full rounded-lg border-2 border-ink bg-paper-raised px-3 py-1.5 text-sm focus:outline-none focus:ring-4 focus:ring-comic-yellow"
        />
        <div className="flex items-center gap-2">
          <button
            type="submit"
            disabled={pending}
            className="press panel-sm pill bg-paper-raised px-3 py-1 text-xs font-bold disabled:opacity-60"
          >
            {pending ? "Saving…" : "Save"}
          </button>

          {!armed ? (
            <button
              type="button"
              onClick={() => setArmed(true)}
              className="rounded-full px-3 py-1 text-xs font-bold text-ink-soft transition hover:bg-red-tint hover:text-ink"
            >
              Delete
            </button>
          ) : (
            <span className="inline-flex items-center gap-1">
              <button
                type="submit"
                formAction={deleteImage}
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
            </span>
          )}
        </div>
      </form>

      {state.error && (
        <p className="mt-2 rounded bg-red-tint px-2 py-1 text-xs font-semibold">
          {state.error}
        </p>
      )}
      {state.success && (
        <p className="mt-2 rounded bg-green-tint px-2 py-1 text-xs font-semibold">
          {state.success}
        </p>
      )}
    </li>
  );
}
