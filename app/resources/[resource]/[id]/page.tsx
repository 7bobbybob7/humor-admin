import Link from "next/link";
import { notFound } from "next/navigation";
import { requireSuperadmin } from "@/lib/admin";
import { getRow, loadOptions } from "@/lib/crud";
import { can, getResource } from "@/lib/resources";
import { ResourceForm, type FieldWithOptions } from "../resource-form";
import { DeleteRow } from "../delete-row";

export const dynamic = "force-dynamic";

export default async function EditResourcePage({
  params,
}: PageProps<"/resources/[resource]/[id]">) {
  await requireSuperadmin();

  const { resource: slug, id } = await params;
  const resource = getResource(slug);
  if (!resource || !can(resource, "update")) notFound();

  const numericId = Number(id);
  if (!Number.isInteger(numericId) || numericId <= 0) notFound();

  const row = await getRow(resource, numericId);
  if (!row) notFound();

  const fields: FieldWithOptions[] = await Promise.all(
    resource.fields.map(async (f) => ({
      ...f,
      resolvedOptions: f.type === "select" ? await loadOptions(f) : undefined,
    })),
  );

  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-5 py-8">
      <Link
        href={`/resources/${resource.slug}`}
        className="text-sm font-semibold text-ink-soft underline underline-offset-2 hover:text-ink"
      >
        ← Back to {resource.title.toLowerCase()}
      </Link>

      <div className="mt-3 flex flex-wrap items-start justify-between gap-3">
        <h1 className="font-display text-3xl font-black">
          {resource.singular} #{String(row.id)}
        </h1>
        {can(resource, "delete") && (
          <DeleteRow slug={resource.slug} id={numericId} />
        )}
      </div>

      <div className="panel mt-6 p-6">
        <ResourceForm
          slug={resource.slug}
          fields={fields}
          row={row}
          submitLabel="Save changes"
        />
      </div>
    </main>
  );
}
