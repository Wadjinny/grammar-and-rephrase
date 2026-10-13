import assert from "node:assert/strict";
import { after, beforeEach, describe, test } from "node:test";
import { buildCheckResponse, buildSegments, checkGrammar, type DiffSegment } from "./check.js";
import { MODEL_CHAIN, resetCooldowns } from "./llm.js";

// Tests follow the chain's order instead of hard-coding it; apiId is the model id a provider receives
const [FIRST, SECOND, , LAST] = MODEL_CHAIN;
const apiId = (model: string) => model.split("/").slice(1).join("/");

const rebuild = (segs: DiffSegment[], skip: DiffSegment["type"]) =>
  segs.filter((s) => s.type !== skip).map((s) => s.text).join("");

const pairs: [string, string][] = [
  [
    "Yesterday me and my freind goes to the new restaurant downtown, it was realy crowded.",
    "Yesterday my friend and I went to the new restaurant downtown. It was really crowded.",
  ],
  ["昨日、私は友達と映画を見に行きます。とても面白いでした。", "昨日、私は友達と映画を見に行きました。とても面白かったです。"],
  ["Hier, je suis allé au marché et j'ai acheter des pommes.", "Hier, je suis allé au marché et j'ai acheté des pommes."],
  ["No errors here.", "No errors here."],
  ["", "Added text."],
  ["Remove me entirely", ""],
  ["Two  spaces\nand a newline ", "Two spaces\nand a new line"],
];

test("segments rebuild both texts exactly", () => {
  for (const [original, corrected] of pairs) {
    const segs = buildSegments(original, corrected);
    assert.equal(rebuild(segs, "inserted"), original);
    assert.equal(rebuild(segs, "deleted"), corrected);
  }
});

test("each insertion that replaces text directly follows its deletion", () => {
  for (const [original, corrected] of pairs) {
    const segs = buildSegments(original, corrected);
    segs.forEach((s, i) => {
      if (s.type === "inserted") assert.notEqual(segs[i - 1]?.type, "inserted");
    });
  }
});

test("reasons attach to the matching edit only", () => {
  const segs = buildSegments("He don't know and he have no plans.", "He doesn't know and he has no plans.", [
    { from: "don't", to: "doesn't", category: "Grammar", reason: "third person" },
    { from: "have", to: "has", category: "Grammar", reason: "agreement" },
  ]);
  const changed = segs.filter((s) => s.type !== "unmodified").map((s) => [s.text, s.reason]);
  assert.deepEqual(changed, [
    ["don't", "third person"],
    ["doesn't", "third person"],
    ["have", "agreement"],
    ["has", "agreement"],
  ]);
});

test("unchanged text yields no edits and tolerates malformed model output", () => {
  const res = buildCheckResponse("All good.", { score: 140, edits: [{ from: 1 } as never] }, "English");
  assert.equal(res.correctedText, "All good.");
  assert.equal(res.score, 100);
  assert.deepEqual(res.explanations, []);
  assert.deepEqual(res.segments, [{ type: "unmodified", text: "All good." }]);
});

test("punctuation-only changes get the matching edit's reason", () => {
  const segs = buildSegments("wow this is cool right i mean", "Wow, this is cool, right? I mean", [
    { from: "wow this", to: "Wow, this", category: "Punctuation", reason: "capitalize and comma" },
    { from: "cool", to: "cool,", category: "Punctuation", reason: "comma after cool" },
    { from: "right i", to: "right? I", category: "Punctuation", reason: "question mark" },
  ]);
  const changes = segs.filter((s, i) => s.type === "inserted" || (s.type === "deleted" && segs[i + 1]?.type !== "inserted"));
  assert.ok(changes.length >= 3);
  for (const c of changes) assert.ok(c.reason, `no reason for ${JSON.stringify(c.text)}`);
  assert.equal(segs.find((s) => s.type === "inserted" && s.text === ",")?.reason, "comma after cool");
});

describe("fallback chain", () => {
  const valid = JSON.stringify({ correctedText: "He went home.", score: 60, edits: [{ from: "go", to: "went", category: "Grammar", reason: "past" }] });
  const reply = (body: unknown, status = 200, headers: Record<string, string> = {}) =>
    new Response(typeof body === "string" ? body : JSON.stringify(body), { status, headers });
  const ok = () => reply({ choices: [{ message: { content: valid }, finish_reason: "stop" }] });
  const gemini = (impl: () => Promise<{ text: string }>) => () => ({ models: { generateContent: impl } }) as never;
  const noGemini = gemini(async () => assert.fail("Gemini should not be called"));

  let calls: string[] = [];
  const realFetch = globalThis.fetch;
  const mockFetch = (handler: (model: string) => Response) => {
    globalThis.fetch = (async (_url: unknown, init?: RequestInit) => {
      const model = JSON.parse(String(init?.body)).model as string;
      calls.push(model);
      return handler(model);
    }) as typeof fetch;
  };

  beforeEach(() => {
    process.env.CEREBRAS_API_KEY = "test";
    process.env.GROQ_API_KEY = "test";
    calls = [];
    resetCooldowns();
  });
  after(() => {
    globalThis.fetch = realFetch;
  });

  test("the first model answers when it can", async () => {
    mockFetch(() => ok());
    const res = await checkGrammar(noGemini, "He go home.", "English");
    assert.equal(res.model, MODEL_CHAIN[0]);
    assert.deepEqual(res.fallbacks, []);
    assert.equal(res.response.correctedText, "He went home.");
  });

  test("a rate-limited model falls through and sits out its retry-after", async () => {
    mockFetch((m) => (m === apiId(FIRST) ? reply("slow down", 429, { "retry-after": "60" }) : ok()));
    const first = await checkGrammar(noGemini, "He go home.", "English");
    assert.equal(first.model, SECOND);
    assert.ok(first.fallbacks[0].startsWith(`${FIRST}: `) && first.fallbacks[0].includes("HTTP 429"));

    calls = [];
    const second = await checkGrammar(noGemini, "He go home.", "English");
    assert.equal(second.model, SECOND);
    assert.deepEqual(calls, [apiId(SECOND)], "the cooling-down model is not called again");
    assert.match(second.fallbacks[0], /rate-limited/);
  });

  test("errors, cut-off output and broken JSON all fall through to Gemini", async () => {
    mockFetch((m) =>
      m === apiId(FIRST)
        ? reply({ choices: [{ message: { content: "{" }, finish_reason: "length" }] })
        : m === apiId(SECOND)
          ? reply("upstream down", 503)
          : reply({ choices: [{ message: { content: "not json" }, finish_reason: "stop" }] })
    );
    const res = await checkGrammar(gemini(async () => ({ text: valid })), "He go home.", "English");
    assert.equal(res.model, LAST);
    assert.equal(res.fallbacks.length, 3);
    assert.match(res.fallbacks[0], /cut off/);
    assert.match(res.fallbacks[1], /503/);
  });

  test("a missing API key skips that provider without a request", async () => {
    delete process.env.CEREBRAS_API_KEY;
    mockFetch(() => ok());
    const res = await checkGrammar(noGemini, "He go home.", "English");
    const firstOther = MODEL_CHAIN.find((m) => !m.startsWith("cerebras/"))!;
    assert.equal(res.model, firstOther);
    assert.deepEqual(calls, [apiId(firstOther)]);
  });

  test("when every model fails the error lists each reason", async () => {
    mockFetch(() => reply("nope", 500));
    const failingGemini = gemini(async () => {
      throw new Error("gemini down");
    });
    await assert.rejects(checkGrammar(failingGemini, "He go home.", "English"), /No model could answer.*gemini down/);
  });

  test("an explicit model is used alone, without the chain", async () => {
    mockFetch(() => reply("nope", 500));
    await assert.rejects(checkGrammar(noGemini, "He go home.", "English", "groq/openai/gpt-oss-120b"), /groq HTTP 500/);
    assert.deepEqual(calls, ["openai/gpt-oss-120b"]);
  });
});

test("a check answer without correctedText falls through instead of reporting no errors", async () => {
  resetCooldowns();
  process.env.CEREBRAS_API_KEY = "test";
  const realFetch = globalThis.fetch;
  globalThis.fetch = (async (_url: unknown, init?: RequestInit) => {
    const model = JSON.parse(String(init?.body)).model;
    const content = model === apiId(FIRST) ? { score: 90, edits: [] } : { correctedText: "He went.", score: 50, edits: [] };
    return new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify(content) }, finish_reason: "stop" }] }));
  }) as typeof fetch;
  try {
    const res = await checkGrammar(() => assert.fail("Gemini should not be called"), "He go.", "English");
    assert.equal(res.model, SECOND);
    assert.match(res.fallbacks[0], /no correctedText/);
  } finally {
    globalThis.fetch = realFetch;
  }
});

describe("end with full stop option", () => {
  const build = (corrected: string, language = "English") =>
    buildCheckResponse("x", { correctedText: corrected, score: 80, edits: [] }, language, { endWithFullStop: true });

  test("adds a full stop the model left out, with a reason on the diff", () => {
    const res = buildCheckResponse("thanks for the help", { correctedText: "Thanks for the help", score: 80, edits: [] }, "English", {
      endWithFullStop: true,
    });
    assert.equal(res.correctedText, "Thanks for the help.");
    const stop = res.segments.find((s) => s.type === "inserted" && s.text === ".");
    assert.ok(stop?.reason, "the added full stop carries a reason");
    assert.equal(res.explanations.at(-1)?.category, "Punctuation");
  });

  test("keeps existing sentence endings, including after closing quotes", () => {
    for (const ending of ["Done.", "Really?", "Wow!", 'He said "yes."', "Done.  "]) {
      assert.equal(build(ending).correctedText, ending);
    }
  });

  test("uses the language's own full stop and keeps trailing whitespace after it", () => {
    assert.equal(build("ありがとうございます", "Japanese").correctedText, "ありがとうございます。");
    assert.equal(build("All done\n").correctedText, "All done.\n");
  });

});

describe("full stop option off", () => {
  const edit = (from: string, to: string) => ({ from, to, category: "Punctuation", reason: "r" });

  test("removes a full stop the model added, with its edit and diff", () => {
    const res = buildCheckResponse(
      "thanks i will review it tomorow",
      {
        correctedText: "Thanks, I will review it tomorrow.",
        score: 60,
        edits: [edit("thanks", "Thanks,"), edit("i", "I"), edit("tomorow", "tomorrow.")],
      },
      "English"
    );
    assert.equal(res.correctedText, "Thanks, I will review it tomorrow");
    assert.equal(res.explanations.at(-1)?.corrected, "tomorrow", "the spelling fix stays, minus the full stop");
    assert.ok(!res.segments.some((s) => s.type === "inserted" && s.text.includes(".")));
  });

  test("drops an edit that only added the full stop", () => {
    const res = buildCheckResponse("see you soon", { correctedText: "See you soon.", score: 80, edits: [edit("see", "See"), edit("soon", "soon.")] }, "English");
    assert.equal(res.correctedText, "See you soon");
    assert.deepEqual(res.explanations.map((e) => e.corrected), ["See"]);
    const ja = buildCheckResponse("ありがとう", { correctedText: "ありがとう。", score: 80, edits: [] }, "Japanese");
    assert.equal(ja.correctedText, "ありがとう");
  });

  test("keeps the author's own ending, question marks and ellipses", () => {
    const keep = (original: string, corrected: string) =>
      buildCheckResponse(original, { correctedText: corrected, score: 80, edits: [] }, "English").correctedText;
    assert.equal(keep("i am done.", "I am done."), "I am done.");
    assert.equal(keep("can you come", "Can you come?"), "Can you come?");
    assert.equal(keep("well", "Well..."), "Well...");
    assert.equal(keep("No stop", "No stop"), "No stop");
  });
});

test("options reach the prompt only when enabled", async () => {
  resetCooldowns();
  process.env.CEREBRAS_API_KEY = "test";
  const systems: string[] = [];
  const realFetch = globalThis.fetch;
  globalThis.fetch = (async (_url: unknown, init?: RequestInit) => {
    systems.push(JSON.parse(String(init?.body)).messages[0].content);
    const content = { correctedText: "pls check it.", score: 90, edits: [] };
    return new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify(content) }, finish_reason: "stop" }] }));
  }) as typeof fetch;
  try {
    const noGemini = () => assert.fail("Gemini should not be called");
    await checkGrammar(noGemini, "pls check it", "English");
    await checkGrammar(noGemini, "pls check it", "English", "auto", {
      keepAbbreviations: true,
      endWithFullStop: true,
      allowMixedLanguages: true,
    });
    assert.doesNotMatch(systems[0], /abbreviations/);
    assert.doesNotMatch(systems[0], /other languages/);
    assert.match(systems[1], /other languages/);
    assert.match(systems[0], /Do not add a full stop/);
    assert.match(systems[1], /abbreviations/);
    assert.match(systems[1], /must end with a full stop/);
  } finally {
    globalThis.fetch = realFetch;
  }
});
