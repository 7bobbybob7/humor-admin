import Link from "next/link";
import { notFound } from "next/navigation";
import { requireSuperadmin } from "@/lib/admin";
import { getGeneration } from "@/lib/queries";
import { DeleteButton } from "../delete-button";
import { EditForm } from "./edit-form";

export const dynamic = "force-dynamic";

export default async function EditMediaPage({
  params,
}: PageProps<"/media/[id]">) {
  await requireSuperadmin();

  const { id } = await params;
  const numericId = Number(id);
  if (!Number.isInteger(numericId) || numericId <= 0) notFound();

  const row = await getGeneration(numericId);
  if (!row) notFound();

  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-5 py-8">
      <Link
        href="/media"
        className="text-sm font-semibold text-ink-soft underline underline-offset-2 hover:text-ink"
      >
        ← Back to media
      </Link>

      <div className="mt-3 flex flex-wrap items-start justify-between gap-3">
        <h1 className="font-display text-3xl font-black">Caption #{row.id}</h1>
        <DeleteButton id={row.id} label="Delete this caption" />
      </div>

      <dl className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { k: "Score", v: row.score > 0 ? `+${row.score}` : row.score, tint: "bg-yellow-tint" },
          { k: "Upvotes", v: row.up_votes, tint: "bg-blue-tint" },
          { k: "Downvotes", v: row.down_votes, tint: "bg-red-tint" },
          { k: "Author", v: row.author_first_name ?? "—", tint: "bg-green-tint" },
        ].map((s) => (
          <div key={s.k} className={`panel-sm ${s.tint} px-3 py-2.5`}>
            <dt className="text-[10px] font-black uppercase tracking-wide text-ink-soft">
              {s.k}
            </dt>
            <dd className="font-display text-xl font-black tabular-nums">{s.v}</dd>
          </div>
        ))}
      </dl>

      <div className="panel mt-5 p-6">
        <EditForm row={row} />
      </div>

      <details className="panel mt-5 p-5">
        <summary className="cursor-pointer font-display text-base font-bold">
          Full prompt sent to {row.model}
        </summary>
        <pre className="mt-3 overflow-x-auto whitespace-pre-wrap break-words rounded-lg bg-ink/5 p-3 text-xs">
{row.system_prompt}
        </pre>
      </details>
    </main>
  );
}
