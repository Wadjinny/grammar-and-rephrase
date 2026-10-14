/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { type GoogleGenAI, Type } from "@google/genai";
import { diffArrays } from "diff";
import { AUTO_MODEL, type ChainResult, generateJson } from "./llm.js";

const CATEGORIES = ["Spelling", "Grammar", "Punctuation", "Style", "Vocabulary"] as const;
type Category = (typeof CATEGORIES)[number];

export type DiffSegment = {
  type: "unmodified" | "deleted" | "inserted";
  text: string;
  reason?: string;
};

export type GrammarExplanation = {
  original: string;
  corrected: string;
  category: Category;
  explanation: string;
};

export type GrammarCheckResponse = {
  correctedText: string;
  language: string;
  score: number;
  segments: DiffSegment[];
  explanations: GrammarExplanation[];
};

/** What the model returns. The diff segments are computed here instead of by the model. */
type ModelEdit = { from: string; to: string; category: string; reason: string };
type ModelOutput = { correctedText?: string; score?: number; edits?: ModelEdit[] };

export type CheckOptions = {
  /** Keep abbreviations, acronyms and shortened forms exactly as written */
  keepAbbreviations?: boolean;
  /** On: the corrected text always ends a sentence. Off: no full stop is added at the very end. */
  endWithFullStop?: boolean;
  /** Keep correct words and phrases from other languages instead of translating or flagging them */
  allowMixedLanguages?: boolean;
};

function systemInstruction(options: CheckOptions): string {
  const rules = [
    options.keepAbbreviations &&
      "- Leave abbreviations, acronyms and shortened forms (e.g. 'pls', 'btw', 'ASAP', 'approx.', 'e.g.') exactly as the author wrote them: do not expand them, change their case, or add or remove their dots. Correct everything around them as usual.",
    options.allowMixedLanguages &&
      "- The text may mix in words or phrases from other languages. Keep any that are correct in their own language exactly as written: do not translate them, replace them with an equivalent in the main language, or count them as errors. Still fix real mistakes around them, and obvious misspellings of them by the rules of their own language.",
    options.endWithFullStop
      ? "- The corrected text must end with a full stop (the language's own, e.g. '。' in Japanese and Chinese), or with '?' or '!' when the last sentence calls for it. If you add one, list it as an edit."
      : "- Do not add a full stop at the very end of the text if the author did not end it with one.",
  ].filter(Boolean);

  return `You are a meticulous proofreader and language teacher.
Correct every grammar, spelling, punctuation, and word-choice error in the user's text.
Keep the author's meaning, tone, and wording wherever they are already correct: do not rephrase correct sentences.
Keep every line break exactly where it is: each line can be a separate paragraph or list item.
${rules.length ? `\nThe author's preferences:\n${rules.join("\n")}\n` : ""}
Return:
- correctedText: the full corrected text.
- score: the grammatical quality of the ORIGINAL text, from 0 to 100 (100 = flawless).
- edits: one entry per correction, in order of appearance. 'from' is the exact original snippet and 'to' its replacement, both as short as possible (usually one word). 'category' is exactly one of: ${CATEGORIES.join(", ")} (always in English). 'reason' is one short, friendly sentence explaining the rule.
If the text has no errors, return it unchanged with an empty edits list.`;
}

const responseSchema = {
  type: Type.OBJECT,
  properties: {
    correctedText: { type: Type.STRING },
    // Loose types on purpose: providers that validate after generating (Groq) reject the whole answer
    // on an off-list category or a fractional score, so those are normalized in buildCheckResponse
    score: { type: Type.NUMBER },
    edits: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          from: { type: Type.STRING },
          to: { type: Type.STRING },
          category: { type: Type.STRING },
          reason: { type: Type.STRING },
        },
        required: ["from", "to", "category", "reason"],
        propertyOrdering: ["from", "to", "category", "reason"],
      },
    },
  },
  required: ["correctedText", "score", "edits"],
  // Writing the corrected text first gives the edits list something to refer back to
  propertyOrdering: ["correctedText", "score", "edits"],
};

function userPrompt(text: string, language: string): string {
  return `Language: ${language}
Write every 'reason' in ${language}.
Text to check:
"""
${text}
"""`;
}

export type CheckResult = Omit<ChainResult<GrammarCheckResponse>, "output"> & { response: GrammarCheckResponse };

/** Runs the check on `model`, or with "auto" on the first model of the shared chain that answers. */
export async function checkGrammar(
  getGemini: () => GoogleGenAI,
  text: string,
  language: string,
  model: string = AUTO_MODEL,
  options: CheckOptions = {}
): Promise<CheckResult> {
  const { output, ...rest } = await generateJson(
    getGemini,
    {
      name: "grammar_check",
      system: systemInstruction(options),
      user: userPrompt(text, language),
      schema: responseSchema,
      sizedMaxTokens: 1000 + 2 * text.length,
      validate: (out) => {
        const o = out as ModelOutput;
        if (typeof o?.correctedText !== "string") throw new Error("answer has no correctedText");
        return buildCheckResponse(text, o, language, options);
      },
    },
    model
  );
  return { response: output, ...rest };
}

export function buildCheckResponse(
  original: string,
  output: ModelOutput,
  language: string,
  options: CheckOptions = {}
): GrammarCheckResponse {
  let correctedText = typeof output.correctedText === "string" ? output.correctedText : original;
  const edits = (output.edits ?? []).filter((e) => e && typeof e.from === "string" && typeof e.to === "string");

  // The prompt states the full-stop preference either way; this enforces it when a model ignores it
  if (options.endWithFullStop) {
    const added = addFullStop(correctedText, language);
    if (added) {
      correctedText = added.text;
      edits.push(added.edit);
    }
  } else if (!ENDS_SENTENCE.test(original.trimEnd())) {
    correctedText = removeFinalFullStop(correctedText, edits);
  }

  return {
    correctedText,
    language,
    score: Math.max(0, Math.min(100, Math.round(Number(output.score) || 0))),
    segments: buildSegments(original, correctedText, edits),
    explanations: edits.map((e) => ({
      original: e.from,
      corrected: e.to,
      category: (CATEGORIES as readonly string[]).includes(e.category) ? (e.category as Category) : "Grammar",
      explanation: e.reason ?? "",
    })),
  };
}

/** Sentence-ending punctuation, optionally followed by closing quotes or brackets. */
const ENDS_SENTENCE = /[.!?…。！？؟][\s"'”’»)\]」』]*$/u;

/** Appends the language's full stop (before trailing whitespace) if the text doesn't end a sentence yet. */
function addFullStop(text: string, language: string): { text: string; edit: ModelEdit } | undefined {
  const body = text.trimEnd();
  if (!body || ENDS_SENTENCE.test(body)) return undefined;
  const stop = language === "Japanese" || language === "Chinese" ? "。" : ".";
  const lastWord = body.split(/\s+/).pop() ?? "";
  return {
    text: body + stop + text.slice(body.length),
    edit: {
      from: lastWord,
      to: lastWord + stop,
      category: "Punctuation",
      reason: "Added a full stop at the end, as set in your check options.",
    },
  };
}

/** A single full stop (not an ellipsis) at the very end, before any closing quotes or brackets. */
const FINAL_FULL_STOP = /(?<!\.)[.。](?=[\s"'”’»)\]」』]*$)/u;

/**
 * Drops a full stop the model put at the end of a text the author left without one, and the
 * matching part of its edit (removing the edit if nothing else changed), so no stale reason remains.
 */
function removeFinalFullStop(text: string, edits: ModelEdit[]): string {
  const match = FINAL_FULL_STOP.exec(text);
  if (!match) return text;
  const stop = match[0];

  for (let i = edits.length - 1; i >= 0; i--) {
    const e = edits[i];
    if (!FINAL_FULL_STOP.test(e.to) || FINAL_FULL_STOP.test(e.from)) continue;
    const to = e.to.replace(FINAL_FULL_STOP, "");
    if (to.trim() === e.from.trim()) edits.splice(i, 1);
    else edits[i] = { ...e, to };
    break;
  }
  return text.slice(0, match.index) + text.slice(match.index + stop.length);
}

const segmenter = new Intl.Segmenter(undefined, { granularity: "word" });

/** Words, spaces and punctuation as separate tokens; Intl.Segmenter also splits CJK text into words. */
function tokenize(text: string): string[] {
  return Array.from(segmenter.segment(text), (s) => s.segment);
}

function words(text: string): Set<string> {
  return new Set(
    Array.from(segmenter.segment(text.toLowerCase()))
      .filter((s) => s.isWordLike)
      .map((s) => s.segment)
  );
}

type Hunk = { kind: "same"; text: string } | { kind: "change"; deleted: string; inserted: string };

/**
 * Word-level diff of original vs corrected text. By construction, unmodified+deleted segments
 * rebuild the original and unmodified+inserted rebuild the corrected text, with each deletion
 * immediately followed by its insertion (the pairing DiffHighlight expects).
 */
export function buildSegments(original: string, corrected: string, edits: ModelEdit[] = []): DiffSegment[] {
  const hunks: Hunk[] = [];
  for (const change of diffArrays(tokenize(original), tokenize(corrected))) {
    const text = change.value.join("");
    const last = hunks[hunks.length - 1];
    if (!change.added && !change.removed) {
      hunks.push({ kind: "same", text });
    } else if (last?.kind === "change") {
      // Adjacent removal/addition runs form one replacement
      if (change.removed) last.deleted += text;
      else last.inserted += text;
    } else {
      hunks.push({ kind: "change", deleted: change.removed ? text : "", inserted: change.added ? text : "" });
    }
  }

  // Changes separated only by spaces read better as one replacement ("me and" -> "my friend and").
  // The whitespace goes on both sides, so the rebuild guarantees still hold. Line breaks never
  // merge: each line can be its own paragraph or list item in formatted input.
  const merged: Hunk[] = [];
  for (const h of hunks) {
    const prev = merged[merged.length - 1];
    const prev2 = merged[merged.length - 2];
    if (h.kind === "change" && prev?.kind === "same" && /^[^\S\n]+$/.test(prev.text) && prev2?.kind === "change") {
      prev2.deleted += prev.text + h.deleted;
      prev2.inserted += prev.text + h.inserted;
      merged.pop();
    } else {
      merged.push(h);
    }
  }

  const used = new Set<ModelEdit>();
  const segments: DiffSegment[] = [];
  const pushText = (text: string) => {
    if (!text) return;
    const last = segments[segments.length - 1];
    if (last?.type === "unmodified") last.text += text;
    else segments.push({ type: "unmodified", text });
  };
  for (const h of merged) {
    if (h.kind === "same") {
      pushText(h.text);
      continue;
    }
    // Whitespace shared by both sides stays unhighlighted
    let { deleted, inserted } = h;
    let lead = "";
    let trail = "";
    if (deleted && inserted) {
      lead = commonWhitespace(deleted, inserted, "start");
      deleted = deleted.slice(lead.length);
      inserted = inserted.slice(lead.length);
      trail = commonWhitespace(deleted, inserted, "end");
      deleted = deleted.slice(0, deleted.length - trail.length);
      inserted = inserted.slice(0, inserted.length - trail.length);
    }
    pushText(lead);
    const reason = findReason(deleted, inserted, edits, used);
    if (deleted) segments.push({ type: "deleted", text: deleted, reason });
    if (inserted) segments.push({ type: "inserted", text: inserted, reason });
    pushText(trail);
  }
  return segments;
}

function commonWhitespace(a: string, b: string, side: "start" | "end"): string {
  const re = side === "start" ? /^\s+/ : /\s+$/;
  const x = a.match(re)?.[0] ?? "";
  const y = b.match(re)?.[0] ?? "";
  let n = 0;
  while (n < x.length && n < y.length && (side === "start" ? x[n] === y[n] : x[x.length - 1 - n] === y[y.length - 1 - n])) n++;
  // Never strip a side down to nothing
  n = Math.min(n, a.length - 1, b.length - 1);
  return side === "start" ? x.slice(0, n) : x.slice(x.length - n);
}

/** Jaccard similarity of the word sets of two snippets. */
function similarity(a: string, b: string): number {
  const x = words(a);
  const y = words(b);
  if (x.size === 0 || y.size === 0) return 0;
  let shared = 0;
  for (const w of x) if (y.has(w)) shared++;
  return shared / (x.size + y.size - shared);
}

/**
 * Fallback for punctuation-only changes, which have no words to compare: strip what an edit's
 * 'from' and 'to' share ("cool" -> "cool," leaves "" -> ",") and look for that change in the hunk.
 */
function coreMatch(e: ModelEdit, deleted: string, inserted: string): number {
  let a = e.from;
  let b = e.to;
  let n = 0;
  while (n < a.length && n < b.length && a[n] === b[n]) n++;
  a = a.slice(n);
  b = b.slice(n);
  n = 0;
  while (n < a.length && n < b.length && a[a.length - 1 - n] === b[b.length - 1 - n]) n++;
  const from = a.slice(0, a.length - n).trim();
  const to = b.slice(0, b.length - n).trim();
  if (!from && !to) return 0;
  const fits = (core: string, side: string) => (core ? side.includes(core) : side.trim() === "");
  return fits(from, deleted) && fits(to, inserted) ? 0.5 : 0;
}

/** Match a diff hunk to the model's explanation for it, preferring edits not used yet. */
function findReason(deleted: string, inserted: string, edits: ModelEdit[], used: Set<ModelEdit>): string | undefined {
  let best: ModelEdit | undefined;
  let bestScore = 0;
  for (const e of edits) {
    const match = similarity(e.from, deleted) + similarity(e.to, inserted) || coreMatch(e, deleted, inserted);
    const s = match > 0 ? match + (used.has(e) ? 0 : 0.01) : 0;
    if (s > bestScore) {
      best = e;
      bestScore = s;
    }
  }
  if (!best) return undefined;
  used.add(best);
  return best.reason;
}
