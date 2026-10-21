import Link from "next/link";
import { requireSuperadmin } from "@/lib/admin";
import { listVotes, listGenerations, listProfiles } from "@/lib/queries";

export const dynamic = "force-dynamic";

export default async function VotesPage() {
  await requireSuperadmin();
  const [votes, gens, profiles] = await Promise.all([
    listVotes(),
    listGenerations(),
    listProfiles(),
  ]);

  const captionById = new Map(gens.map((g) => [g.id, g.caption]));
  const nameById = new Map(
    profiles.map((p) => [p.id, [p.first_name, p.last_name].filter(Boolean).join(" ")]),
  );

  const up = votes.filter((v) => v.value === 1).length;

  return (
    <main className="mx-auto w-full max-w-6xl flex-1 px-5 py-8">
      <h1 className="font-display text-3xl font-black">Votes</h1>
      <p className="mt-1 text-sm text-ink-soft">
        {votes.length} vote{votes.length === 1 ? "" : "s"} · {up} up ·{" "}
        {votes.length - up} down. Read-only.
      </p>

      {votes.length === 0 ? (
        <div className="panel mt-6 p-8 text-center text-sm text-ink-soft">
          No votes recorded yet.
        </div>
      ) : (
        <div className="panel mt-6 overflow-x-auto">
          <table className="w-full min-w-[48rem] text-sm">
            <thead className="border-b-2 border-ink text-left">
              <tr className="text-[11px] uppercase tracking-wide text-ink-soft">
                <th className="px-4 py-3 font-black">Vote</th>
                <th className="px-4 py-3 font-black">Caption</th>
                <th className="px-4 py-3 font-black">Voter</th>
                <th className="px-4 py-3 font-black">Cast</th>
              </tr>
            </thead>
            <tbody>
              {votes.map((v) => (
                <tr key={v.id} className="border-b border-rule last:border-0">
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex h-7 w-7 items-center justify-center rounded-full border-2 border-ink text-xs font-black text-white ${
                        v.value === 1 ? "bg-series-up" : "bg-series-down"
                      }`}
                      title={v.value === 1 ? "Upvote" : "Downvote"}
                    >
                      {v.value === 1 ? "▲" : "▼"}
                    </span>
                  </td>
                  <td className="max-w-md px-4 py-3">
                    <Link
                      href={`/media/${v.generation_id}`}
                      className="line-clamp-2 underline-offset-2 hover:underline"
                    >
                      {captionById.get(v.generation_id) ?? (
                        <span className="text-ink-soft">
                          caption #{v.generation_id}
                        </span>
                      )}
                    </Link>
                  </td>
                  <td className="px-4 py-3">
                    {nameById.get(v.user_id) || (
                      <span className="font-mono text-xs text-ink-soft">
                        {v.user_id.slice(0, 8)}…
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-xs text-ink-soft">
                    {new Date(v.created_at).toLocaleString()}
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
