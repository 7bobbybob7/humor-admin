import Link from "next/link";
import { notFound } from "next/navigation";
import { requireSuperadmin } from "@/lib/admin";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function RequestDetailPage({
  params,
}: PageProps<"/requests/[id]">) {
  await requireSuperadmin();

  const { id } = await params;
  const requestId = Number(id);
  if (!Number.isInteger(requestId) || requestId <= 0) notFound();

  const supabase = await createClient();
  const { data: request } = await supabase
    .from("generation_requests")
    .select("id, user_id, topic, chain_id, status, error, captions_created, duration_ms, created_at")
    .eq("id", requestId)
    .maybeSingle();

  if (!request) notFound();

  const [{ data: responses }, { data: captions }, { data: chain }] =
    await Promise.all([
      supabase
        .from("llm_responses")
        .select("id, model_key, ok, status_code, latency_ms, raw_response, error, created_at")
        .eq("request_id", requestId)
        .order("created_at", { ascending: true }),
      supabase
        .from("generations")
        .select("id, caption, score")
        .eq("request_id", requestId),
      request.chain_id
        ? supabase.from("prompt_chains").select("name").eq("id", request.chain_id).maybeSingle()
        : Promise.resolve({ data: null }),
    ]);

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-5 py-8">
      <Link
        href="/requests"
        className="text-sm font-semibold text-ink-soft underline underline-offset-2 hover:text-ink"
      >
        ← Back to requests
      </Link>

      <h1 className="mt-3 font-display text-3xl font-black">Request #{request.id}</h1>
      <p className="mt-1 text-sm text-ink-soft">
        “{request.topic}” · {request.status}
        {request.duration_ms ? ` · ${request.duration_ms}ms end to end` : ""}
        {chain?.name ? ` · chain: ${chain.name}` : ""}
      </p>

      {request.error && (
        <p className="panel-sm mt-4 bg-red-tint px-4 py-3 text-sm font-semibold">
          {request.error}
        </p>
      )}

      <h2 className="mt-8 font-display text-xl font-black">
        Model attempts ({responses?.length ?? 0})
      </h2>
      <p className="mt-0.5 text-xs text-ink-soft">
        One row per model tried, in order. A failed attempt here is the
        fallback chain doing its job.
      </p>

      <div className="mt-4 space-y-3">
        {(responses ?? []).map((r) => (
          <div
            key={r.id}
            className={`panel p-4 ${r.ok ? "" : "bg-red-tint"}`}
          >
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <span className="font-mono text-xs font-bold">{r.model_key}</span>
              <span
                className={`rounded-full border-2 border-ink px-2 py-0.5 text-[10px] font-black uppercase ${
                  r.ok ? "bg-green-tint" : "bg-paper-raised"
                }`}
              >
                {r.ok ? "ok" : "failed"}
              </span>
              {r.status_code && (
                <span className="text-xs text-ink-soft">HTTP {r.status_code}</span>
              )}
              {r.latency_ms !== null && (
                <span className="text-xs tabular-nums text-ink-soft">
                  {r.latency_ms}ms
                </span>
              )}
            </div>
            {r.error && (
              <p className="mt-2 break-words text-xs text-ink-soft">{r.error}</p>
            )}
            {r.raw_response && (
              <details className="mt-2">
                <summary className="cursor-pointer text-xs font-bold">
                  Raw response
                </summary>
                <pre className="mt-2 overflow-x-auto whitespace-pre-wrap break-words rounded-lg bg-ink/5 p-3 text-[11px]">
{r.raw_response}
                </pre>
              </details>
            )}
          </div>
        ))}
        {(responses ?? []).length === 0 && (
          <p className="panel p-5 text-sm text-ink-soft">
            No model attempts were recorded for this request.
          </p>
        )}
      </div>

      <h2 className="mt-8 font-display text-xl font-black">
        Captions produced ({captions?.length ?? 0})
      </h2>
      <ul className="mt-3 space-y-2">
        {(captions ?? []).map((c) => (
          <li key={c.id} className="panel-sm bg-paper-raised px-4 py-3 text-sm">
            <Link href={`/media/${c.id}`} className="underline-offset-2 hover:underline">
              {c.caption}
            </Link>
            <span className="ml-2 text-xs text-ink-soft">score {c.score}</span>
          </li>
        ))}
        {(captions ?? []).length === 0 && (
          <li className="text-sm text-ink-soft">None.</li>
        )}
      </ul>
    </main>
  );
}
