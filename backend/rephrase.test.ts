import assert from "node:assert/strict";
import { after, beforeEach, test } from "node:test";
import { MODEL_CHAIN, resetCooldowns } from "./llm.js";
import { buildRephraseResponse, rephraseText } from "./rephrase.js";

test("keeps usable alternatives and fills in missing notes", () => {
  const res = buildRephraseResponse("hi", "English", {
    alternatives: [
      { text: "Hello.", description: "Neutral", changesOverview: "Greeting" },
      { text: "Hey!" },
      { text: "   " },
      null,
    ],
  });
  assert.deepEqual(res, {
    originalText: "hi",
    language: "English",
    alternatives: [
      { text: "Hello.", description: "Neutral", changesOverview: "Greeting" },
      { text: "Hey!", description: "", changesOverview: "" },
    ],
  });
});

test("an answer without alternatives is rejected", () => {
  assert.throws(() => buildRephraseResponse("hi", "English", { alternatives: [] }), /no alternatives/);
  assert.throws(() => buildRephraseResponse("hi", "English", {}), /no alternatives/);
});

const realFetch = globalThis.fetch;
beforeEach(() => {
  process.env.CEREBRAS_API_KEY = "test";
  process.env.GROQ_API_KEY = "test";
  resetCooldowns();
});
after(() => {
  globalThis.fetch = realFetch;
});

test("an empty answer falls through to the next model in the chain", async () => {
  const content = (alternatives: unknown[]) =>
    new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify({ alternatives }) }, finish_reason: "stop" }] }));
  globalThis.fetch = (async (_url: unknown, init?: RequestInit) =>
    JSON.parse(String(init?.body)).model === MODEL_CHAIN[0].split("/").slice(1).join("/")
      ? content([])
      : content([{ text: "Hello there.", description: "Friendly", changesOverview: "Warmer tone" }])) as typeof fetch;

  const res = await rephraseText(() => assert.fail("Gemini should not be called"), "hi there", "English");
  assert.equal(res.model, MODEL_CHAIN[1]);
  assert.match(res.fallbacks[0], /no alternatives/);
  assert.equal(res.response.alternatives[0].text, "Hello there.");
});
