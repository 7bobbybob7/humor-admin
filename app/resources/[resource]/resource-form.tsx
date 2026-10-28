"use client";

import { useActionState } from "react";
import { createRow, updateRow, type ResourceState } from "./actions";
import type { Field } from "@/lib/resources";

export type FieldWithOptions = Field & {
  resolvedOptions?: { value: string; label: string }[];
};

const INPUT =
  "w-full rounded-xl border-2 border-ink bg-paper-raised px-4 py-2.5 font-medium focus:outline-none focus:ring-4 focus:ring-comic-yellow";

export function ResourceForm({
  slug,
  fields,
  row,
  submitLabel,
}: {
  slug: string;
  fields: FieldWithOptions[];
  row?: Record<string, unknown>;
  submitLabel: string;
}) {
  const editing = Boolean(row);
  const [state, formAction, pending] = useActionState<ResourceState, FormData>(
    editing ? updateRow : createRow,
    {},
  );

  return (
    <form action={formAction} className="space-y-5">
      <input type="hidden" name="__resource" value={slug} />
      {editing && <input type="hidden" name="__id" value={String(row!.id)} />}

      {fields.map((field) => {
        const current = row?.[field.name];
        const defaultText =
          current === null || current === undefined ? "" : String(current);

        return (
          <label key={field.name} className="block text-sm">
            <span className="mb-1.5 block font-display text-base font-bold">
              {field.label}
              {field.required && <span className="text-comic-red"> *</span>}
            </span>

            {field.type === "boolean" ? (
              <span className="flex items-center gap-2">
                <input
                  type="checkbox"
                  name={field.name}
                  defaultChecked={current === undefined ? true : Boolean(current)}
                  className="h-5 w-5 rounded border-2 border-ink"
                />
                <span className="text-ink-soft">Enabled</span>
              </span>
            ) : field.type === "textarea" ? (
              <textarea
                name={field.name}
                defaultValue={defaultText}
                required={field.required}
                maxLength={field.max}
                rows={4}
                className={INPUT}
              />
            ) : field.type === "select" ? (
              <select
                name={field.name}
                defaultValue={defaultText}
                required={field.required}
                className={INPUT}
              >
                <option value="">— none —</option>
                {(field.resolvedOptions ?? []).map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            ) : (
              <input
                type={field.type === "number" ? "number" : "text"}
                name={field.name}
                defaultValue={defaultText}
                required={field.required}
                maxLength={field.max}
                className={INPUT}
              />
            )}

            {field.help && (
              <span className="mt-1.5 block text-xs text-ink-soft">{field.help}</span>
            )}
          </label>
        );
      })}

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
        {pending ? "Saving…" : submitLabel}
      </button>
    </form>
  );
}
