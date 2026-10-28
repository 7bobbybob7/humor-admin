import Link from "next/link";
import { requireSuperadmin } from "@/lib/admin";
import { listGenerations } from "@/lib/queries";
import { DeleteButton } from "./delete-button";

export const dynamic = "force-dynamic";

export default async function MediaPage({ searchParams }: PageProps<"/media">) {
  await requireSuperadmin();

  const { q, created, deleted, failed } = await searchParams;
  const search = (Array.isArray(q) ? q[0] : q)?.slice(0, 100) ?? "";
  const rows = await listGenerations(search);

  const createdCount = Math.min(
    Math.max(Number(Array.isArray(created) ? created[0] : created) || 0, 0),
    10,
  );

  return (
    <main className="mx-auto w-full max-w-6xl flex-1 px-5 py-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-black">AI media</h1>
          <p className="mt-1 text-sm text-ink-soft">
            {rows.length} caption{rows.length === 1 ? "" : "s"}
            {search ? ` matching “${search}”` : ""} · create, edit and delete
          </p>
        </div>
        <Link
          href="/media/new"
          className="press panel-sm bg-comic-red px-4 py-2 font-bold text-white"
        >
          + Generate captions
        </Link>
      </div>

      {createdCount > 0 && (
        <p className="panel-sm mt-4 bg-green-tint px-4 py-3 text-sm font-semibold">
          Added {createdCount} caption{createdCount === 1 ? "" : "s"}.
        </p>
      )}
      {deleted && (
        <p className="panel-sm mt-4 bg-red-tint px-4 py-3 text-sm font-semibold">
          Caption deleted, along with its votes.
        </p>
      )}
      {failed && (
        <p className="panel-sm mt-4 bg-red-tint px-4 py-3 text-sm font-semibold">
          {failed === "nothing-deleted"
            ? "Nothing was deleted — the caption may already be gone."
            : `Could not delete: ${failed}`}
        </p>
      )}

      <form method="get" className="mt-5 flex gap-2">
        <input
          name="q"
          defaultValue={search}
          maxLength={100}
          placeholder="Search captions and prompts…"
          className="w-full max-w-sm rounded-xl border-2 border-ink bg-paper-raised px-4 py-2 text-sm font-medium focus:outline-none focus:ring-4 focus:ring-comic-yellow"
        />
        <button className="press panel-sm bg-paper-raised px-4 py-2 text-sm font-bold">
          Search
        </button>
        {search && (
          <Link
            href="/media"
            className="self-center px-2 text-sm font-semibold text-ink-soft underline underline-offset-2"
          >
            Clear
          </Link>
        )}
      </form>

      {rows.length === 0 ? (
        <div className="panel mt-6 p-8 text-center text-sm text-ink-soft">
          No captions found.
        </div>
      ) : (
        <div className="panel mt-6 overflow-x-auto">
          <table className="w-full min-w-[52rem] text-sm">
            <thead className="border-b-2 border-ink text-left">
              <tr className="text-[11px] uppercase tracking-wide text-ink-soft">
                <th className="px-4 py-3 font-black">Caption</th>
                <th className="px-4 py-3 font-black">Prompt</th>
                <th className="px-4 py-3 font-black">Score</th>
                <th className="px-4 py-3 font-black">Author</th>
                <th className="px-4 py-3 font-black">Created</th>
                <th className="px-4 py-3 font-black">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((g) => (
                <tr key={g.id} className="border-b border-rule last:border-0">
                  <td className="max-w-sm px-4 py-3">
                    <Link
                      href={`/media/${g.id}`}
                      className="break-words font-medium underline-offset-2 hover:underline"
                    >
                      {g.caption}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-xs text-ink-soft">
                    <span className="line-clamp-2">{g.prompt}</span>
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 font-bold tabular-nums">
                    {g.score > 0 ? `+${g.score}` : g.score}
                    <span className="ml-1 font-normal text-xs text-ink-soft">
                      ▲{g.up_votes} ▼{g.down_votes}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs">
                    {g.author_first_name ?? <span className="text-ink-soft">—</span>}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-xs text-ink-soft">
                    {new Date(g.created_at).toLocaleDateString()}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3">
                    <Link
                      href={`/media/${g.id}`}
                      className="rounded-full px-3 py-1 text-xs font-bold text-ink-soft transition hover:bg-blue-tint hover:text-ink"
                    >
                      Edit
                    </Link>
                    <DeleteButton id={g.id} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}
