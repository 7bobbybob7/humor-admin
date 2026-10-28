import Link from "next/link";
import { notFound } from "next/navigation";
import { requireSuperadmin } from "@/lib/admin";
import { loadOptions } from "@/lib/crud";
import { can, getResource } from "@/lib/resources";
import { ResourceForm, type FieldWithOptions } from "../resource-form";

export const dynamic = "force-dynamic";

export default async function NewResourcePage({
  params,
}: PageProps<"/resources/[resource]/new">) {
  await requireSuperadmin();

  const { resource: slug } = await params;
  const resource = getResource(slug);
  if (!resource || !can(resource, "create")) notFound();

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
      <h1 className="mt-3 font-display text-3xl font-black">
        New {resource.singular.toLowerCase()}
      </h1>
      <div className="panel mt-6 p-6">
        <ResourceForm slug={resource.slug} fields={fields} submitLabel="Create" />
      </div>
    </main>
  );
}
