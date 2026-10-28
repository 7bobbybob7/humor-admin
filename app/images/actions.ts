"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireSuperadmin } from "@/lib/admin";
import { createClient } from "@/lib/supabase/server";

/** savedId changes on every successful save, so the form can tell one
 *  success from the next and clear itself. */
export type ImageState = { error?: string; success?: string; savedId?: number };

const BUCKET = "images";

/**
 * Records an image after the browser has uploaded it straight to Storage.
 *
 * The bytes never pass through a Server Action, which keeps them clear of
 * Next's 1 MB body cap, and the table holds only the pointer.
 */
export async function registerImage(
  _prev: ImageState,
  formData: FormData,
): Promise<ImageState> {
  const admin = await requireSuperadmin();

  const path = String(formData.get("path") ?? "").trim();
  const publicUrl = String(formData.get("public_url") ?? "").trim();
  const altText = String(formData.get("alt_text") ?? "").trim();

  if (!path || !publicUrl) return { error: "Upload did not complete." };

  const allowedPrefix = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/${BUCKET}/`;
  if (!publicUrl.startsWith(allowedPrefix)) {
    return { error: "That URL is not in this project's images bucket." };
  }
  if (altText.length > 200) {
    return { error: "Alt text must be 200 characters or fewer." };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("images")
    .insert({
      bucket: BUCKET,
      path,
      public_url: publicUrl,
      alt_text: altText || null,
      uploaded_by: admin.id,
    })
    .select("id")
    .maybeSingle();

  if (error) return { error: error.message };

  revalidatePath("/images");
  return { success: "Image added.", savedId: Number(data?.id ?? Date.now()) };
}

export async function updateImageAlt(
  _prev: ImageState,
  formData: FormData,
): Promise<ImageState> {
  await requireSuperadmin();

  const id = Number(formData.get("id"));
  if (!Number.isInteger(id) || id <= 0) return { error: "Bad record id." };

  const altText = String(formData.get("alt_text") ?? "").trim();
  if (altText.length > 200) {
    return { error: "Alt text must be 200 characters or fewer." };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("images")
    .update({ alt_text: altText || null })
    .eq("id", id)
    .select("id");

  if (error) return { error: error.message };
  if (!data || data.length === 0) return { error: "Nothing was updated." };

  revalidatePath("/images");
  return { success: "Saved." };
}

export async function deleteImage(formData: FormData): Promise<void> {
  await requireSuperadmin();

  const id = Number(formData.get("id"));
  if (!Number.isInteger(id) || id <= 0) return;

  const supabase = await createClient();
  const { data: row } = await supabase
    .from("images")
    .select("path")
    .eq("id", id)
    .maybeSingle();

  if (!row) redirect("/images?failed=gone");

  // Remove the object first; deleting only the row would orphan the bytes.
  // If the object cannot be removed, keep the row: a row pointing at bytes
  // that still exist is recoverable, bytes nobody has a pointer to are not.
  const { error: storageError } = await supabase.storage
    .from(BUCKET)
    .remove([row.path as string]);

  if (storageError) {
    redirect(`/images?failed=${encodeURIComponent(storageError.message)}`);
  }

  const { data: deleted, error } = await supabase
    .from("images")
    .delete()
    .eq("id", id)
    .select("id");

  revalidatePath("/images");

  if (error) redirect(`/images?failed=${encodeURIComponent(error.message)}`);
  if (!deleted || deleted.length === 0) redirect("/images?failed=nothing-deleted");

  redirect("/images?deleted=1");
}
