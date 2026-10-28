import { GoogleGenAI, Type } from "@google/genai";
import { createClient } from "@/lib/supabase/server";

export const CAPTIONS_PER_RUN = 3;

/** Raw model output is stored for inspection; cap it so one row cannot balloon. */
const MAX_RAW_STORED = 4000;

/** Used only when the database has no models configured yet. */
const FALLBACK_MODELS = [
  "gemini-flash-latest",
  "gemini-3.5-flash-lite",
  "gemini-flash-lite-latest",
];

type ModelRow = { id: number; model_key: string };
type StepRow = { step_order: number; template: string };

export type PipelineResult = {
  captions: string[];
  requestId: number | null;
  chainId: number | null;
  chainName: string | null;
  model: string;
  systemPrompt: string;
};

function retryable(status: number | undefined): boolean {
  return (
    status === undefined ||
    status === 503 ||
    status === 429 ||
    status === 500 ||
    status === 504
  );
}

/** Weighted pick across the chains in prompt_chain_mix. Weight 0 retires a chain. */
function pickChain<T extends { chain_id: number; weight: number }>(
  mix: T[],
): number | null {
  const pool = mix.filter((m) => m.weight > 0);
  if (pool.length === 0) return null;
  const total = pool.reduce((n, m) => n + m.weight, 0);
  let roll = Math.random() * total;
  for (const m of pool) {
    roll -= m.weight;
    if (roll <= 0) return m.chain_id;
  }
  return pool[pool.length - 1].chain_id;
}

function renderPrompt(
  steps: StepRow[],
  vars: { topic: string; count: number; terms: string; examples: string },
): string {
  return [...steps]
    .sort((a, b) => a.step_order - b.step_order)
    .map((s) =>
      s.template
        .replaceAll("{{topic}}", vars.topic)
        .replaceAll("{{count}}", String(vars.count))
        .replaceAll("{{terms}}", vars.terms)
        .replaceAll("{{examples}}", vars.examples)
        .trim(),
    )
    .filter(Boolean)
    .join("\n\n");
}

/** The original hand-written prompt, used if no chain is configured. */
function fallbackPrompt(topic: string): string {
  return [
    "You write short, punchy joke captions for a humor site run by and for",
    "college students in New York City. The audience is chronically online,",
    "so the voice is dry, observational and self-aware.",
    "",
    `Write ${CAPTIONS_PER_RUN} distinct joke captions about this topic:`,
    `"${topic}"`,
    "",
    "Rules:",
    "- One sentence each, under 140 characters.",
    "- Each caption must take a genuinely different angle on the topic.",
    "- No emoji, no hashtags, no quotation marks around the caption.",
    "- Keep it good-natured. Nothing cruel, sexual, or aimed at a real person.",
    "",
    "Return a JSON array of strings and nothing else.",
  ].join("\n");
}

function parseCaptions(raw: string | undefined): string[] {
  if (!raw) return [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return [];
  }
  return (Array.isArray(parsed) ? parsed : [])
    .filter((c): c is string => typeof c === "string")
    .map((c) => c.trim())
    .filter(Boolean)
    .slice(0, CAPTIONS_PER_RUN);
}

/**
 * Runs one caption generation, reading its configuration from the database and
 * recording what happened.
 *
 * Shared, byte for byte, with the main app. Both must generate through the
 * same configured path, or a caption created here would ignore every
 * prompting screen in this admin and never appear under Requests.
 *
 * Every piece of configuration falls back to the previous hardcoded behaviour
 * if its table is empty or unreadable, so the app keeps working whether or not
 * the week 7 migration has been applied. Telemetry writes are best-effort for
 * the same reason: failing to log must never fail a generation.
 */
export async function runGeneration(
  userId: string,
  topic: string,
): Promise<PipelineResult> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error(
      "Missing GEMINI_API_KEY. Add it to .env.local locally, and to Environment Variables on Vercel.",
    );
  }

  const supabase = await createClient();
  const startedAt = Date.now();

  // ---- configuration ------------------------------------------------------
  const [mixRes, modelsRes, termsRes] = await Promise.all([
    supabase.from("prompt_chain_mix").select("chain_id, weight"),
    supabase
      .from("llm_models")
      .select("id, model_key")
      .eq("is_active", true)
      .order("priority", { ascending: true }),
    supabase.from("terms").select("term, kind").eq("is_active", true).limit(60),
  ]);

  const chainId = pickChain(mixRes.data ?? []);

  let chainName: string | null = null;
  let steps: StepRow[] = [];
  let examplesText = "";

  if (chainId) {
    const [chainRes, stepsRes, examplesRes] = await Promise.all([
      supabase.from("prompt_chains").select("name").eq("id", chainId).maybeSingle(),
      supabase
        .from("prompt_chain_steps")
        .select("step_order, template")
        .eq("chain_id", chainId)
        .eq("is_active", true),
      supabase
        .from("ai_generation_examples")
        .select("topic, example_caption")
        .eq("chain_id", chainId)
        .eq("is_active", true)
        .limit(5),
    ]);

    chainName = (chainRes.data?.name as string | undefined) ?? null;
    steps = (stepsRes.data ?? []) as StepRow[];

    const examples = examplesRes.data ?? [];
    if (examples.length > 0) {
      examplesText =
        "Examples of the right voice:\n" +
        examples
          .map((e) => `- "${e.topic}" -> ${e.example_caption}`)
          .join("\n");
    }
  }

  const terms = termsRes.data ?? [];
  const avoid = terms.filter((t) => t.kind === "avoid").map((t) => t.term);
  const prefer = terms.filter((t) => t.kind === "prefer").map((t) => t.term);
  const termsText = [
    avoid.length ? `Avoid these words: ${avoid.join(", ")}.` : "",
    prefer.length ? `These land well when they fit: ${prefer.join(", ")}.` : "",
  ]
    .filter(Boolean)
    .join(" ");

  const rendered =
    steps.length > 0
      ? renderPrompt(steps, {
          topic,
          count: CAPTIONS_PER_RUN,
          terms: termsText,
          examples: examplesText,
        })
      : "";

  // A chain whose steps are all blank renders to nothing. Sending an empty
  // prompt would get an empty or nonsense answer, so fall back instead.
  const systemPrompt = rendered.trim() ? rendered : fallbackPrompt(topic);

  // ---- open a request row -------------------------------------------------
  const { data: requestRow } = await supabase
    .from("generation_requests")
    .insert({ user_id: userId, topic, chain_id: chainId, status: "pending" })
    .select("id")
    .maybeSingle();

  const requestId = (requestRow?.id as number | undefined) ?? null;

  // ---- walk the models ----------------------------------------------------
  const models: ModelRow[] =
    (modelsRes.data as ModelRow[] | null)?.length
      ? (modelsRes.data as ModelRow[])
      : FALLBACK_MODELS.map((k) => ({ id: 0, model_key: k }));

  const ai = new GoogleGenAI({ apiKey });
  let lastError = "No model was attempted.";

  for (const model of models) {
    const attemptStart = Date.now();
    try {
      const response = await ai.models.generateContent({
        model: model.model_key,
        contents: systemPrompt,
        config: {
          responseMimeType: "application/json",
          responseSchema: { type: Type.ARRAY, items: { type: Type.STRING } },
          temperature: 1.1,
        },
      });

      const latency = Date.now() - attemptStart;
      const captions = parseCaptions(response.text);
      // Telemetry is best-effort, but it must still be awaited: a PostgREST
      // builder is a lazy thenable, so dropping the promise means the request
      // is never dispatched at all and the row silently never appears.

      if (requestId) {
        await supabase.from("llm_responses").insert({
          request_id: requestId,
          model_id: model.id || null,
          model_key: model.model_key,
          ok: captions.length > 0,
          status_code: 200,
          latency_ms: latency,
          raw_response: (response.text ?? "").slice(0, MAX_RAW_STORED),
          error: captions.length > 0 ? null : "No usable captions in response.",
        });
      }

      if (captions.length > 0) {
        if (requestId) {
          await supabase
            .from("generation_requests")
            .update({
              status: "succeeded",
              captions_created: captions.length,
              duration_ms: Date.now() - startedAt,
            })
            .eq("id", requestId);
        }
        return {
          captions,
          requestId,
          chainId,
          chainName,
          model: model.model_key,
          systemPrompt,
        };
      }

      lastError = `${model.model_key} returned no usable captions.`;
    } catch (e) {
      const latency = Date.now() - attemptStart;
      const status = (e as { status?: number }).status;
      const message = e instanceof Error ? e.message : String(e);
      lastError = message;

      if (requestId) {
        await supabase.from("llm_responses").insert({
          request_id: requestId,
          model_id: model.id || null,
          model_key: model.model_key,
          ok: false,
          status_code: status ?? null,
          latency_ms: latency,
          error: message.slice(0, MAX_RAW_STORED),
        });
      }

      if (status === 400 || status === 401 || status === 403) {
        if (requestId) {
          await supabase
            .from("generation_requests")
            .update({ status: "failed", error: "API key rejected." })
            .eq("id", requestId);
        }
        throw new Error(
          "Gemini rejected the API key. Check GEMINI_API_KEY is valid and has access.",
        );
      }
      if (!retryable(status) && status !== 404) throw e;
    }
  }

  if (requestId) {
    await supabase
      .from("generation_requests")
      .update({
        status: "failed",
        error: lastError.slice(0, 500),
        duration_ms: Date.now() - startedAt,
      })
      .eq("id", requestId);
  }

  throw new Error(
    `Every caption model was unavailable. Gemini is likely under load — try again in a moment. (${lastError.slice(0, 140)})`,
  );
}

/**
 * Marks a request failed after the fact.
 *
 * runGeneration marks a request succeeded as soon as the model returns, but
 * the captions are saved by the caller afterwards. If that save fails the
 * request would otherwise still read "succeeded" while no captions exist.
 */
export async function markRequestFailed(
  requestId: number | null,
  reason: string,
): Promise<void> {
  if (!requestId) return;
  const supabase = await createClient();
  await supabase
    .from("generation_requests")
    .update({ status: "failed", error: reason.slice(0, 500), captions_created: 0 })
    .eq("id", requestId);
}
