/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { type GoogleGenAI, ThinkingLevel } from "@google/genai";

/**
 * Shared model chain for the JSON-producing endpoints (grammar check, rephrase): fast free tiers
 * first, Gemini last, falling through on any failure.
 */

/** OpenAI-compatible providers, addressed as "<provider>/<model id>". Timeouts sit well above the eval's p90. */
const OPENAI_COMPATIBLE = {
  cerebras: { url: "https://api.cerebras.ai/v1/chat/completions", keyEnv: "CEREBRAS_API_KEY", timeoutMs: 6_000, sizeMaxTokens: false },
  // Groq's free tier counts the requested max_tokens, not the tokens used, against its 8k tokens/minute limit
  groq: { url: "https://api.groq.com/openai/v1/chat/completions", keyEnv: "GROQ_API_KEY", timeoutMs: 8_000, sizeMaxTokens: true },
} as const;
type Provider = keyof typeof OPENAI_COMPATIBLE;

/** Last in the chain, so it gets the most patience. */
const GEMINI_TIMEOUT_MS = 30_000;

/** Fixed output budget where it doesn't cost quota. Qwen reasons at length even on short texts. */
const MAX_TOKENS = 4000;

/**
 * Fallback order for model "auto", from the evals in eval/. gpt-oss-120b leads (on two providers)
 * because it is the most accurate and respects "keep abbreviations"; Qwen, which sometimes rewrites
 * abbreviations it doesn't know (e.g. French "dcp"), absorbs traffic once their small free quotas
 * run out; Gemini, a different company, is the last resort. Each model has its own quota, so one
 * that gets rate-limited is skipped until the provider says to retry.
 */
export const MODEL_CHAIN = [
  "cerebras/gpt-oss-120b",
  "groq/openai/gpt-oss-120b",
  "cerebras/qwen-3.8-27b",
  "gemini-3.1-flash-lite",
];
export const AUTO_MODEL = "auto";
export const SUPPORTED_MODELS = [AUTO_MODEL, ...MODEL_CHAIN, "gemini-3.5-flash", "gemini-3.1-pro-preview"];

/** A JSON-producing request, independent of the provider that ends up answering it. */
export type JsonTask<T> = {
  /** Schema name for OpenAI-compatible APIs */
  name: string;
  system: string;
  user: string;
  /** Gemini Schema dialect; converted to strict JSON Schema for the other providers */
  schema: object;
  /** Output budget to request where the requested amount costs quota (Groq) */
  sizedMaxTokens: number;
  /** Throws if a parsed answer is unusable, so the chain moves on to the next model */
  validate: (output: unknown) => T;
};

export type ChainResult<T> = {
  output: T;
  /** The model that answered */
  model: string;
  /** Models tried before it, with why each was skipped */
  fallbacks: string[];
};

/** A provider asked us to slow down; the model sits out until retryAfterMs has passed. */
class RateLimitError extends Error {
  constructor(
    message: string,
    readonly retryAfterMs: number
  ) {
    super(message);
  }
}

// Shared by all tasks: the quota belongs to the model, not the endpoint
const cooldownUntil = new Map<string, number>();

const errorMessage = (err: unknown) => (err instanceof Error ? err.message : String(err));

/** Runs the task on `model`, or with "auto" walks MODEL_CHAIN until a model gives a usable answer. */
export async function generateJson<T>(
  getGemini: () => GoogleGenAI,
  task: JsonTask<T>,
  model: string = AUTO_MODEL
): Promise<ChainResult<T>> {
  const chain = model === AUTO_MODEL ? MODEL_CHAIN : [model];
  const fallbacks: string[] = [];

  for (const candidate of chain) {
    if (chain.length > 1 && (cooldownUntil.get(candidate) ?? 0) > Date.now()) {
      fallbacks.push(`${candidate}: rate-limited`);
      continue;
    }
    try {
      const output = task.validate(await runModel(getGemini, candidate, task));
      return { output, model: candidate, fallbacks };
    } catch (err) {
      if (err instanceof RateLimitError) cooldownUntil.set(candidate, Date.now() + err.retryAfterMs);
      fallbacks.push(`${candidate}: ${errorMessage(err).slice(0, 160)}`);
    }
  }
  throw new Error(`No model could answer (${fallbacks.join("; ")})`);
}

/** Lets tests start from a clean slate. */
export function resetCooldowns() {
  cooldownUntil.clear();
}

function runModel(getGemini: () => GoogleGenAI, model: string, task: JsonTask<unknown>): Promise<unknown> {
  const [prefix, ...rest] = model.split("/");
  return prefix in OPENAI_COMPATIBLE
    ? runOpenAICompatible(prefix as Provider, rest.join("/"), task)
    : runGemini(getGemini(), model, task);
}

/** These tasks need little deliberation; Pro models don't accept MINIMAL, so they get LOW. */
function thinkingLevelFor(model: string): ThinkingLevel {
  return model.includes("pro") ? ThinkingLevel.LOW : ThinkingLevel.MINIMAL;
}

async function runGemini(ai: GoogleGenAI, model: string, task: JsonTask<unknown>): Promise<unknown> {
  try {
    const response = await ai.models.generateContent({
      model,
      contents: task.user,
      config: {
        systemInstruction: task.system,
        responseMimeType: "application/json",
        responseSchema: task.schema,
        thinkingConfig: { thinkingLevel: thinkingLevelFor(model) },
        abortSignal: AbortSignal.timeout(GEMINI_TIMEOUT_MS),
      },
    });
    return JSON.parse(response.text || "{}");
  } catch (err) {
    if ((err as { status?: number }).status === 429) throw new RateLimitError(errorMessage(err), 60_000);
    throw err;
  }
}

async function runOpenAICompatible(provider: Provider, model: string, task: JsonTask<unknown>): Promise<unknown> {
  const { url, keyEnv, timeoutMs, sizeMaxTokens } = OPENAI_COMPATIBLE[provider];
  const apiKey = process.env[keyEnv];
  if (!apiKey) throw new Error(`${keyEnv} is not configured.`);

  const response = await fetch(url, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: task.system },
        { role: "user", content: task.user },
      ],
      response_format: {
        type: "json_schema",
        json_schema: { name: task.name, strict: true, schema: toJsonSchema(task.schema) },
      },
      reasoning_effort: "low",
      max_tokens: sizeMaxTokens ? Math.min(MAX_TOKENS, task.sizedMaxTokens) : MAX_TOKENS,
    }),
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (response.status === 429) {
    const retryAfter = Number(response.headers.get("retry-after"));
    throw new RateLimitError(`${provider} HTTP 429`, (retryAfter > 0 ? retryAfter : 30) * 1000);
  }
  if (!response.ok) {
    throw new Error(`${provider} HTTP ${response.status}: ${(await response.text()).slice(0, 300)}`);
  }

  const data = (await response.json()) as { choices?: { message?: { content?: string }; finish_reason?: string }[] };
  const choice = data.choices?.[0];
  if (choice?.finish_reason === "length") throw new Error(`${provider} response was cut off (max_tokens).`);
  return JSON.parse(choice?.message?.content || "{}");
}

/** Gemini's Schema dialect to standard JSON Schema, strict-mode style (every object closed). */
function toJsonSchema(schema: unknown): unknown {
  if (Array.isArray(schema)) return schema.map(toJsonSchema);
  if (!schema || typeof schema !== "object") return schema;
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(schema)) {
    if (key === "propertyOrdering") continue;
    out[key] = key === "type" && typeof value === "string" ? value.toLowerCase() : toJsonSchema(value);
  }
  if (out.type === "object") out.additionalProperties = false;
  return out;
}
