import { createClient } from "@/lib/supabase/server";
import type { Field, Resource } from "@/lib/resources";

export type Row = Record<string, unknown>;

export async function listRows(resource: Resource): Promise<Row[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from(resource.table)
    .select(resource.select)
    .order(resource.order.column, { ascending: resource.order.ascending })
    .limit(300);
  if (error) throw new Error(`${resource.table}: ${error.message}`);
  return (data ?? []) as unknown as Row[];
}

export async function getRow(resource: Resource, id: number): Promise<Row | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from(resource.table)
    .select(resource.select)
    .eq("id", id)
    .maybeSingle();
  return (data as Row | null) ?? null;
}

/** Options for a `select` field whose values come from another table. */
export async function loadOptions(
  field: Field,
): Promise<{ value: string; label: string }[]> {
  if (field.options) return field.options;
  if (!field.optionsFrom) return [];

  const supabase = await createClient();
  const { from } = { from: field.optionsFrom };
  const { data } = await supabase
    .from(from.table)
    .select(`${from.value}, ${from.label}`)
    .limit(200);

  return (data ?? []).map((r) => {
    // The select list is built at runtime, so supabase-js cannot infer a row
    // type here and widens to a parser-error type; go through unknown.
    const row = r as unknown as Row;
    return {
      value: String(row[from.value]),
      label: String(row[from.label] ?? row[from.value]),
    };
  });
}

/** id -> human label, for rendering foreign keys in list views. */
export async function labelMap(
  table: string,
  labelColumn: string,
): Promise<Record<string, string>> {
  const supabase = await createClient();
  const { data } = await supabase.from(table).select(`id, ${labelColumn}`).limit(300);
  return Object.fromEntries(
    (data ?? []).map((r) => {
      const row = r as unknown as Row;
      return [String(row.id), String(row[labelColumn] ?? row.id)];
    }),
  );
}

/**
 * Builds the payload for an insert or update.
 *
 * Only fields declared in the registry are read, and each is coerced by its
 * declared type, so a crafted form post cannot write a column the resource
 * does not expose.
 */
export function payloadFromForm(
  resource: Resource,
  formData: FormData,
): { values: Row } | { error: string } {
  const values: Row = {};

  for (const field of resource.fields) {
    const raw = formData.get(field.name);

    if (field.type === "boolean") {
      values[field.name] = raw === "on" || raw === "true";
      continue;
    }

    const text = typeof raw === "string" ? raw.trim() : "";

    if (!text) {
      if (field.required) return { error: `${field.label} is required.` };
      values[field.name] = null;
      continue;
    }

    if (field.max && text.length > field.max) {
      return { error: `${field.label} must be ${field.max} characters or fewer.` };
    }

    if (field.type === "number" || (field.type === "select" && field.optionsFrom)) {
      const n = Number(text);
      // Every numeric column here is an integer, so reject a decimal in the
      // form rather than letting Postgres reject it with a type error.
      if (!Number.isInteger(n)) {
        return { error: `${field.label} must be a whole number.` };
      }
      values[field.name] = n;
      continue;
    }

    if (field.type === "select" && field.options) {
      if (!field.options.some((o) => o.value === text)) {
        return { error: `${field.label} is not a valid choice.` };
      }
    }

    values[field.name] = text;
  }

  return { values };
}
