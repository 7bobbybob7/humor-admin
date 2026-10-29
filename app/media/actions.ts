"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireSuperadmin } from "@/lib/admin";
import { createClient } from "@/lib/supabase/server";
import { markRequestFailed, runGeneration } from "@/lib/pipeline";

export type MediaState = { error?: string; success?: string };

const MAX_TOPIC = 120;
const MAX_CAPTION = 400;

/* ------------------------------------------------------------------ CREATE */

export async function createMedia(
  _prev: MediaState,
  formData: FormData,
): Promise<MediaState> {
  // Re-checked here, not just in the page: a server action is its own
  // entry point and can be invoked without ever rendering the page.
  const admin = await requireSuperadmin();

  const topic = String(formData.get("topic") ?? "").trim();
  if (!topic) return { error: "Enter a topic for the model." };
  if (topic.length > MAX_TOPIC) {
    return { error: `Keep the topic under ${MAX_TOPIC} characters.` };
  }

  // Generated through the same pipeline the main app uses, so a caption made
  // here honours the configured chain, terms and examples, and is recorded
  // under Requests like any other.
  let result;
  try {
    result = await runGeneration(admin.id, topic);
  } catch (e) {
    return { error: e instanceof Error ? e.message : "The model call failed." };
  }

  // Anything thrown past this point reaches the browser as the generic error
  // page rather than a message this form can show, so the save is guarded as
  // well as checked. redirect() stays outside: it works by throwing.
  try {
    const supabase = await createClient();
    const { error } = await supabase.from("generations").insert(
      result.captions.map((caption) => ({
        user_id: admin.id,
        author_first_name: admin.first_name,
        prompt: topic,
        system_prompt: result.systemPrompt,
        model: result.model,
        request_id: result.requestId,
        caption,
      })),
    );

    if (error) {
      await markRequestFailed(result.requestId, `Saving captions failed: ${error.message}`);
      return { error: `Could not save: ${error.message}` };
    }
  } catch (e) {
    const reason =
      e instanceof Error ? e.message : "The database was unreachable.";
    await markRequestFailed(result.requestId, `Saving captions failed: ${reason}`);
    return { error: `Could not save: ${reason}` };
  }

  revalidatePath("/media");
  revalidatePath("/");
  redirect("/media?created=" + result.captions.length);
}

/* ------------------------------------------------------------------ UPDATE */

export async function updateMedia(
  _prev: MediaState,
  formData: FormData,
): Promise<MediaState> {
  await requireSuperadmin();

  const id = Number(formData.get("id"));
  if (!Number.isInteger(id) || id <= 0) return { error: "Bad record id." };

  const caption = String(formData.get("caption") ?? "").trim();
  const prompt = String(formData.get("prompt") ?? "").trim();

  if (!caption) return { error: "Caption cannot be empty." };
  if (caption.length > MAX_CAPTION) {
    return { error: `Caption must be ${MAX_CAPTION} characters or fewer.` };
  }
  if (!prompt) return { error: "Prompt cannot be empty." };
  if (prompt.length > MAX_TOPIC) {
    return { error: `Prompt must be ${MAX_TOPIC} characters or fewer.` };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("generations")
    .update({ caption, prompt })
    .eq("id", id)
    .select("id");

  if (error) return { error: `Could not update: ${error.message}` };
  // An UPDATE filtered out by RLS affects zero rows without raising, so a
  // silent no-op would otherwise report success.
  if (!data || data.length === 0) {
    return { error: "Nothing was updated — the record may have been deleted." };
  }

  revalidatePath("/media");
  revalidatePath(`/media/${id}`);
  revalidatePath("/");
  return { success: "Saved." };
}

/* ------------------------------------------------------------------ DELETE */

export async function deleteMedia(formData: FormData): Promise<void> {
  await requireSuperadmin();

  const id = Number(formData.get("id"));
  if (!Number.isInteger(id) || id <= 0) return;

  const supabase = await createClient();
  // Votes reference generations with on delete cascade, so this removes the
  // caption and its votes together rather than orphaning them.
  const { data, error } = await supabase
    .from("generations")
    .delete()
    .eq("id", id)
    .select("id");

  revalidatePath("/media");
  revalidatePath("/");

  // A delete the policy filters out removes nothing and does not raise.
  if (error) redirect(`/media?failed=${encodeURIComponent(error.message)}`);
  if (!data || data.length === 0) redirect("/media?failed=nothing-deleted");

  redirect("/media?deleted=1");
}
