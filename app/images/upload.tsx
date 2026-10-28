"use client";

import { useActionState, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { registerImage, type ImageState } from "./actions";

const MAX_BYTES = 5 * 1024 * 1024;

export function Upload() {
  const [state, formAction, pending] = useActionState<ImageState, FormData>(
    registerImage,
    {},
  );
  const [path, setPath] = useState("");
  const [url, setUrl] = useState("");
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [clearedFor, setClearedFor] = useState<number | null>(null);

  // Clear the picker once the row is saved. Leaving the previous upload in
  // place let a second submit re-register the same object, which trips the
  // unique (bucket, path) constraint. Adjusted during render rather than in
  // an effect: the state derives from the action's result, so an effect would
  // render the stale value first and then immediately render again.
  if (state.savedId !== undefined && state.savedId !== clearedFor) {
    setClearedFor(state.savedId);
    setPath("");
    setUrl("");
    setError(null);
  }

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);

    if (!file.type.startsWith("image/")) {
      setError("That file is not an image.");
      if (fileRef.current) fileRef.current.value = "";
      return;
    }
    if (file.size > MAX_BYTES) {
      setError("Image is larger than 5 MB.");
      if (fileRef.current) fileRef.current.value = "";
      return;
    }

    setUploading(true);
    const supabase = createClient();
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "-").slice(-60);
    const objectPath = `${Date.now()}-${safeName}`;

    const { error: uploadError } = await supabase.storage
      .from("images")
      .upload(objectPath, file, { contentType: file.type, upsert: false });

    if (uploadError) {
      setError(`Upload failed: ${uploadError.message}`);
      setUploading(false);
      return;
    }

    setPath(objectPath);
    setUrl(supabase.storage.from("images").getPublicUrl(objectPath).data.publicUrl);
    setUploading(false);
  }

  return (
    <form key={state.savedId ?? 0} action={formAction} className="space-y-4">
      <input type="hidden" name="path" value={path} />
      <input type="hidden" name="public_url" value={url} />

      <label className="block text-sm">
        <span className="mb-1.5 block font-display text-base font-bold">
          Choose an image
        </span>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          onChange={handleFile}
          disabled={uploading}
          className="block w-full text-sm file:mr-3 file:rounded-full file:border-2 file:border-ink file:bg-comic-yellow file:px-3 file:py-1.5 file:text-sm file:font-bold file:text-ink-fixed disabled:opacity-60"
        />
        <span className="mt-1.5 block text-xs text-ink-soft">
          {uploading ? "Uploading…" : "PNG or JPG, up to 5 MB."}
        </span>
      </label>

      {url && (
        <div className="flex items-center gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element -- Storage URL */}
          <img
            src={url}
            alt=""
            className="h-16 w-16 rounded-lg border-2 border-ink object-cover"
          />
          <span className="font-mono text-xs text-ink-soft">{path}</span>
        </div>
      )}

      <label className="block text-sm">
        <span className="mb-1.5 block font-display text-base font-bold">Alt text</span>
        <input
          name="alt_text"
          maxLength={200}
          placeholder="What the image shows"
          className="w-full rounded-xl border-2 border-ink bg-paper-raised px-4 py-2.5 font-medium focus:outline-none focus:ring-4 focus:ring-comic-yellow"
        />
      </label>

      {(error || state.error) && (
        <p className="panel-sm bg-red-tint px-4 py-3 text-sm font-semibold">
          {error ?? state.error}
        </p>
      )}
      {state.success && (
        <p className="panel-sm bg-green-tint px-4 py-3 text-sm font-semibold">
          {state.success}
        </p>
      )}

      <button
        type="submit"
        disabled={pending || uploading || !url}
        className="press panel-sm bg-comic-red px-6 py-3 font-bold text-white disabled:opacity-60"
      >
        {pending ? "Saving…" : uploading ? "Waiting for upload…" : "Add image"}
      </button>
    </form>
  );
}
