import Link from "next/link";
import { requireSuperadmin } from "@/lib/admin";
import { labelMap } from "@/lib/crud";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type RequestRow = {
  id: number;
  user_id: string | null;
  topic: string;
  chain_id: number | null;
  status: string;
  error: string | null;
  captions_created: number;
  duration_ms: number | null;
  created_at: string;
};

const STATUS_TINT: Record<string, string> = {
  succeeded: "bg-green-tint",
  failed: "bg-red-tint",
  pending: "bg-yellow-tint",
};

export default async function RequestsPage() {
  await requireSuperadmin();
  const supabase = await createClient();

  const [{ data }, chains, people] = await Promise.all([
    supabase
      .from("generation_requests")
      .select("id, user_id, topic, chain_id, status, error, captions_created, duration_ms, created_at")
      .order("created_at", { ascending: false })
      .limit(200),
    labelMap("prompt_chains", "name"),
    labelMap("profiles", "first_name"),
  ]);

  const rows = (data ?? []) as RequestRow[];
  const failed = rows.filter((r) => r.status === "failed").length;
  const timed = rows.filter((r) => r.duration_ms);
  const median =
    timed.length > 0
      ? timed.map((r) => r.duration_ms!).sort((a, b) => a - b)[
          Math.floor(timed.length / 2)
        ]
      : null;

  return (
    <main className="mx-auto w-full max-w-6xl flex-1 px-5 py-8">
      <h1 className="font-display text-3xl font-black">Generation requests</h1>
      <p className="mt-1 text-sm text-ink-soft">
        One row per caption request. {rows.length} shown · {failed} failed
        {median !== null && ` · median ${median}ms`}
      </p>

      {rows.length === 0 ? (
        <div className="panel mt-6 p-8 text-center text-sm text-ink-soft">
          No requests recorded yet. Generate a caption in the main app and it
          will appear here.
        </div>
      ) : (
        <div className="panel mt-6 overflow-x-auto">
          <table className="w-full min-w-[52rem] text-sm">
            <thead className="border-b-2 border-ink text-left">
              <tr className="text-[11px] uppercase tracking-wide text-ink-soft">
                <th className="px-4 py-3 font-black">Status</th>
                <th className="px-4 py-3 font-black">Topic</th>
                <th className="px-4 py-3 font-black">Chain</th>
                <th className="px-4 py-3 font-black">By</th>
                <th className="px-4 py-3 font-black">Captions</th>
                <th className="px-4 py-3 font-black">Took</th>
                <th className="px-4 py-3 font-black">When</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-b border-rule last:border-0">
                  <td className="px-4 py-3">
                    <span
                      className={`rounded-full border-2 border-ink px-2 py-0.5 text-[10px] font-black uppercase ${
                        STATUS_TINT[r.status] ?? "bg-paper-raised"
                      }`}
                    >
                      {r.status}
                    </span>
                  </td>
                  <td className="max-w-xs px-4 py-3">
                    <Link
                      href={`/requests/${r.id}`}
                      className="font-medium underline-offset-2 hover:underline"
                    >
                      {r.topic}
                    </Link>
                    {r.error && (
                      <span className="mt-0.5 block text-xs text-ink-soft line-clamp-1">
                        {r.error}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-xs">
                    {r.chain_id ? (chains[String(r.chain_id)] ?? r.chain_id) : "—"}
                  </td>
                  <td className="px-4 py-3 text-xs">
                    {r.user_id ? (people[r.user_id] ?? r.user_id.slice(0, 8)) : "—"}
                  </td>
                  <td className="px-4 py-3 tabular-nums">{r.captions_created}</td>
                  <td className="px-4 py-3 text-xs tabular-nums text-ink-soft">
                    {r.duration_ms ? `${r.duration_ms}ms` : "—"}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-xs text-ink-soft">
                    {new Date(r.created_at).toLocaleString()}
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
