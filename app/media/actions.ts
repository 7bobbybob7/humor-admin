"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireSuperadmin } from "@/lib/admin";
import { createClient } from "@/lib/supabase/server";
import { generateCaptions } from "@/lib/gemini";

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

  let result;
  try {
    result = await generateCaptions(topic);
  } catch (e) {
    return { error: e instanceof Error ? e.message : "The model call failed." };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("generations").insert(
    result.captions.map((caption) => ({
      user_id: admin.id,
      author_first_name: admin.first_name,
      prompt: topic,
      system_prompt: result.prompt,
      model: result.model,
      caption,
    })),
  );

  if (error) return { error: `Could not save: ${error.message}` };

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
  await supabase.from("generations").delete().eq("id", id);

  revalidatePath("/media");
  revalidatePath("/");
  redirect("/media?deleted=1");
}
