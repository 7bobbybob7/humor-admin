import Link from "next/link";
import { notFound } from "next/navigation";
import { requireSuperadmin } from "@/lib/admin";
import { labelMap, listRows, type Row } from "@/lib/crud";
import { can, getResource } from "@/lib/resources";
import { DeleteRow } from "./delete-row";

export const dynamic = "force-dynamic";

/** Foreign keys rendered as names rather than bare ids. */
const FK: Record<string, { table: string; label: string }> = {
  chain_id: { table: "prompt_chains", label: "name" },
  provider_id: { table: "llm_providers", label: "name" },
};

function Cell({
  value,
  kind,
}: {
  value: unknown;
  kind?: "bool" | "date" | "mono" | "long";
}) {
  if (value === null || value === undefined || value === "") {
    return <span className="text-ink-soft">—</span>;
  }
  if (kind === "bool") {
    return value ? (
      <span className="rounded-full border-2 border-ink bg-green-tint px-2 py-0.5 text-[10px] font-black uppercase">
        yes
      </span>
    ) : (
      <span className="text-ink-soft">no</span>
    );
  }
  if (kind === "date") {
    return (
      <span className="text-xs text-ink-soft">
        {new Date(String(value)).toLocaleDateString()}
      </span>
    );
  }
  if (kind === "mono") {
    return <span className="font-mono text-xs">{String(value)}</span>;
  }
  if (kind === "long") {
    return (
      <span className="line-clamp-2 text-xs text-ink-soft">{String(value)}</span>
    );
  }
  return <span>{String(value)}</span>;
}

export default async function ResourceListPage({
  params,
  searchParams,
}: PageProps<"/resources/[resource]">) {
  await requireSuperadmin();

  const { resource: slug } = await params;
  const resource = getResource(slug);
  if (!resource) notFound();

  const { created, deleted } = await searchParams;
  const rows = await listRows(resource);

  // Resolve any foreign keys appearing in the list columns.
  const fkCols = resource.list.map((c) => c.name).filter((n) => n in FK);
  const maps: Record<string, Record<string, string>> = {};
  for (const col of fkCols) {
    maps[col] = await labelMap(FK[col].table, FK[col].label);
  }

  const editable = can(resource, "update");
  const deletable = can(resource, "delete");

  return (
    <main className="mx-auto w-full max-w-6xl flex-1 px-5 py-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="max-w-2xl">
          <h1 className="font-display text-3xl font-black">{resource.title}</h1>
          <p className="mt-1 text-sm text-ink-soft">{resource.blurb}</p>
          <p className="mt-2 text-[11px] font-bold uppercase tracking-wide text-ink-soft">
            {resource.capabilities.join(" · ")}
          </p>
        </div>
        {can(resource, "create") && (
          <Link
            href={`/resources/${resource.slug}/new`}
            className="press panel-sm bg-comic-red px-4 py-2 font-bold text-white"
          >
            + New
          </Link>
        )}
      </div>

      {created && (
        <p className="panel-sm mt-4 bg-green-tint px-4 py-3 text-sm font-semibold">
          Created.
        </p>
      )}
      {deleted && (
        <p className="panel-sm mt-4 bg-red-tint px-4 py-3 text-sm font-semibold">
          Deleted.
        </p>
      )}

      {rows.length === 0 ? (
        <div className="panel mt-6 p-8 text-center text-sm text-ink-soft">
          No rows yet.
        </div>
      ) : (
        <div className="panel mt-6 overflow-x-auto">
          <table className="w-full min-w-[46rem] text-sm">
            <thead className="border-b-2 border-ink text-left">
              <tr className="text-[11px] uppercase tracking-wide text-ink-soft">
                {resource.list.map((c) => (
                  <th key={c.name} className="px-4 py-3 font-black">
                    {c.label}
                  </th>
                ))}
                {(editable || deletable) && (
                  <th className="px-4 py-3 font-black">Actions</th>
                )}
              </tr>
            </thead>
            <tbody>
              {rows.map((row: Row) => (
                <tr key={String(row.id)} className="border-b border-rule last:border-0">
                  {resource.list.map((c) => (
                    <td key={c.name} className="max-w-xs px-4 py-3 align-top">
                      <Cell
                        value={
                          c.name in maps
                            ? (maps[c.name][String(row[c.name])] ?? row[c.name])
                            : row[c.name]
                        }
                        kind={c.kind}
                      />
                    </td>
                  ))}
                  {(editable || deletable) && (
                    <td className="whitespace-nowrap px-4 py-3 align-top">
                      {editable && (
                        <Link
                          href={`/resources/${resource.slug}/${row.id}`}
                          className="rounded-full px-3 py-1 text-xs font-bold text-ink-soft transition hover:bg-blue-tint hover:text-ink"
                        >
                          Edit
                        </Link>
                      )}
                      {deletable && (
                        <DeleteRow slug={resource.slug} id={Number(row.id)} />
                      )}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}
