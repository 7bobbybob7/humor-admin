import Link from "next/link";
import { requireSuperadmin } from "@/lib/admin";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function ResponsesPage() {
  await requireSuperadmin();
  const supabase = await createClient();

  const { data } = await supabase
    .from("llm_responses")
    .select("id, request_id, model_key, ok, status_code, latency_ms, error, created_at")
    .order("created_at", { ascending: false })
    .limit(200);

  const rows = data ?? [];
  const ok = rows.filter((r) => r.ok).length;

  return (
    <main className="mx-auto w-full max-w-6xl flex-1 px-5 py-8">
      <h1 className="font-display text-3xl font-black">LLM responses</h1>
      <p className="mt-1 text-sm text-ink-soft">
        Every model call the generator has made. {rows.length} shown · {ok} ok ·{" "}
        {rows.length - ok} failed. Open a request to see the raw body.
      </p>

      {rows.length === 0 ? (
        <div className="panel mt-6 p-8 text-center text-sm text-ink-soft">
          No model calls recorded yet.
        </div>
      ) : (
        <div className="panel mt-6 overflow-x-auto">
          <table className="w-full min-w-[48rem] text-sm">
            <thead className="border-b-2 border-ink text-left">
              <tr className="text-[11px] uppercase tracking-wide text-ink-soft">
                <th className="px-4 py-3 font-black">Result</th>
                <th className="px-4 py-3 font-black">Model</th>
                <th className="px-4 py-3 font-black">HTTP</th>
                <th className="px-4 py-3 font-black">Latency</th>
                <th className="px-4 py-3 font-black">Error</th>
                <th className="px-4 py-3 font-black">Request</th>
                <th className="px-4 py-3 font-black">When</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-b border-rule last:border-0">
                  <td className="px-4 py-3">
                    <span
                      className={`rounded-full border-2 border-ink px-2 py-0.5 text-[10px] font-black uppercase ${
                        r.ok ? "bg-green-tint" : "bg-red-tint"
                      }`}
                    >
                      {r.ok ? "ok" : "failed"}
                    </span>
                  </td>
                  <td className="px-4 py-3 font-mono text-xs">{r.model_key}</td>
                  <td className="px-4 py-3 text-xs tabular-nums">
                    {r.status_code ?? "—"}
                  </td>
                  <td className="px-4 py-3 text-xs tabular-nums">
                    {r.latency_ms !== null ? `${r.latency_ms}ms` : "—"}
                  </td>
                  <td className="max-w-xs px-4 py-3">
                    <span className="line-clamp-2 text-xs text-ink-soft">
                      {r.error ?? "—"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs">
                    {r.request_id ? (
                      <Link
                        href={`/requests/${r.request_id}`}
                        className="underline underline-offset-2"
                      >
                        #{r.request_id}
                      </Link>
                    ) : (
                      "—"
                    )}
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
