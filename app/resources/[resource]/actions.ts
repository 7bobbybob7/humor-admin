"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireSuperadmin } from "@/lib/admin";
import { createClient } from "@/lib/supabase/server";
import { payloadFromForm } from "@/lib/crud";
import { can, getResource, type Capability } from "@/lib/resources";

export type ResourceState = { error?: string; success?: string };

/**
 * Resolves the resource named by the form and checks the capability.
 *
 * The slug arrives from the client, so it is matched against the registry
 * rather than used as a table name, and the capability is re-checked here -
 * hiding a button in the UI is not access control.
 */
async function resolve(formData: FormData, capability: Capability) {
  await requireSuperadmin();

  const slug = String(formData.get("__resource") ?? "");
  const resource = getResource(slug);
  if (!resource) return { error: "Unknown resource." } as const;
  if (!can(resource, capability)) {
    return { error: `${resource.title} does not allow ${capability}.` } as const;
  }
  return { resource } as const;
}

export async function createRow(
  _prev: ResourceState,
  formData: FormData,
): Promise<ResourceState> {
  const resolved = await resolve(formData, "create");
  if ("error" in resolved) return { error: resolved.error };
  const { resource } = resolved;

  const built = payloadFromForm(resource, formData);
  if ("error" in built) return { error: built.error };

  const supabase = await createClient();
  const { error } = await supabase.from(resource.table).insert(built.values);
  if (error) return { error: error.message };

  revalidatePath(`/resources/${resource.slug}`);
  redirect(`/resources/${resource.slug}?created=1`);
}

export async function updateRow(
  _prev: ResourceState,
  formData: FormData,
): Promise<ResourceState> {
  const resolved = await resolve(formData, "update");
  if ("error" in resolved) return { error: resolved.error };
  const { resource } = resolved;

  const id = Number(formData.get("__id"));
  if (!Number.isInteger(id) || id <= 0) return { error: "Bad record id." };

  const built = payloadFromForm(resource, formData);
  if ("error" in built) return { error: built.error };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from(resource.table)
    .update(built.values)
    .eq("id", id)
    .select("id");

  if (error) return { error: error.message };
  // An UPDATE filtered out by RLS changes nothing without raising, so a
  // silent no-op would otherwise look like success.
  if (!data || data.length === 0) {
    return { error: "Nothing was updated — the row may have been deleted." };
  }

  revalidatePath(`/resources/${resource.slug}`);
  revalidatePath(`/resources/${resource.slug}/${id}`);
  return { success: "Saved." };
}

export async function deleteRow(formData: FormData): Promise<void> {
  const resolved = await resolve(formData, "delete");
  if ("error" in resolved) return;
  const { resource } = resolved;

  const id = Number(formData.get("__id"));
  if (!Number.isInteger(id) || id <= 0) return;

  const supabase = await createClient();
  await supabase.from(resource.table).delete().eq("id", id);

  revalidatePath(`/resources/${resource.slug}`);
  redirect(`/resources/${resource.slug}?deleted=1`);
}
