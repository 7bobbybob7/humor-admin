import { GoogleGenAI, Type } from "@google/genai";

/**
 * Models are tried in order. The full `flash` tier is frequently 503 on the
 * free tier, so the lite models act as fallbacks rather than being the first
 * choice - they answer in under a second and the caption quality holds up.
 * Whichever model actually answered is recorded on each generation row.
 */
const MODEL_CHAIN = [
  "gemini-flash-latest",
  "gemini-3.5-flash-lite",
  "gemini-flash-lite-latest",
] as const;

export const CAPTIONS_PER_RUN = 3;

/**
 * Transient conditions worth trying another model for. A thrown error with no
 * HTTP status is usually a network or timeout failure, which is also worth
 * retrying on the next model rather than aborting the whole chain.
 */
function isRetryable(status: number | undefined): boolean {
  return (
    status === undefined ||
    status === 503 ||
    status === 429 ||
    status === 500 ||
    status === 504
  );
}

/** A model that is gone or not entitled for this key - skip it, don't retry. */
function isMissing(status: number | undefined): boolean {
  return status === 404;
}

/**
 * The full text sent to the model. Stored alongside every generation so each
 * caption is reproducible, as the assignment requires.
 */
export function buildPrompt(topic: string): string {
  return [
    "You write short, punchy joke captions for a humor site run by and for",
    "college students in New York City. The audience is chronically online,",
    "so the voice is dry, observational and self-aware - never corny, never",
    "a dad joke, never explaining itself.",
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

export type GenerationResult = {
  captions: string[];
  prompt: string;
  model: string;
};

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

export async function generateCaptions(topic: string): Promise<GenerationResult> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error(
      "Missing GEMINI_API_KEY. Add it to .env.local locally, and to Environment Variables on Vercel.",
    );
  }

  const prompt = buildPrompt(topic);
  const ai = new GoogleGenAI({ apiKey });
  let lastError: unknown;

  for (const model of MODEL_CHAIN) {
    try {
      const response = await ai.models.generateContent({
        model,
        contents: prompt,
        config: {
          // Ask for JSON directly so we are not regex-parsing prose.
          responseMimeType: "application/json",
          responseSchema: { type: Type.ARRAY, items: { type: Type.STRING } },
          temperature: 1.1,
        },
      });

      const captions = parseCaptions(response.text);
      if (captions.length > 0) return { captions, prompt, model };

      // Answered but unusable - treat like a soft failure and try the next model.
      lastError = new Error(`${model} returned no usable captions.`);
    } catch (e) {
      lastError = e;
      const status = (e as { status?: number }).status;

      // An invalid or unauthorized key will fail identically on every model,
      // so surface it immediately instead of walking the whole chain.
      if (status === 400 || status === 401 || status === 403) {
        throw new Error(
          "Gemini rejected the API key. Check GEMINI_API_KEY is valid and has access.",
        );
      }
      if (!isRetryable(status) && !isMissing(status)) throw e;
    }
  }

  const detail = lastError instanceof Error ? lastError.message : String(lastError);
  throw new Error(
    `Every caption model was unavailable. Gemini is likely under load — try again in a moment. (${detail.slice(0, 140)})`,
  );
}
