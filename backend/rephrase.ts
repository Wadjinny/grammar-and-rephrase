/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { type GoogleGenAI, Type } from "@google/genai";
import { AUTO_MODEL, type ChainResult, generateJson } from "./llm.js";

export type RephraseAlternative = { text: string; description: string; changesOverview: string };

export type RephraseResponse = {
  originalText: string;
  language: string;
  alternatives: RephraseAlternative[];
};

function systemInstruction(language: string): string {
  return `You are an expert copywriter and multilingual rephrase engine in the style of Reverso Rephraser.
Generate exactly 5 elegant, distinct rephrasing alternatives for the provided text, covering these styles (do not label or return tone names):

1. Polished and fluent, natural phrasing.
2. Polite and professional, suitable for emails or business letters.
3. Laid-back and friendly, like a relaxed chat with a colleague.
4. Short, direct, compact word count.
5. Very casual and informal, like a quick message to a close friend: everyday spoken language and common colloquial expressions, still easy to understand.

Styles 3 and 5 are both informal: make 5 clearly more casual than 3.

For each alternative return:
- text: the rephrased text.
- description: a short, friendly suggestion of where to best use it (e.g. 'Parfait pour envoyer à vos collègues' in French).
- changesOverview: the key change, in 2-5 words (e.g. 'Vocabulaire soutenu' in French).
Write the texts, descriptions and changes overviews entirely in ${language}.`;
}

// Every field is required: strict JSON Schema mode on Cerebras/Groq rejects optional properties
const responseSchema = {
  type: Type.OBJECT,
  properties: {
    alternatives: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          text: { type: Type.STRING },
          description: { type: Type.STRING },
          changesOverview: { type: Type.STRING },
        },
        required: ["text", "description", "changesOverview"],
        propertyOrdering: ["text", "description", "changesOverview"],
      },
    },
  },
  required: ["alternatives"],
};

export type RephraseResult = Omit<ChainResult<RephraseResponse>, "output"> & { response: RephraseResponse };

/** Rephrases on `model`, or with "auto" on the first model of the shared chain that answers. */
export async function rephraseText(
  getGemini: () => GoogleGenAI,
  text: string,
  language: string,
  model: string = AUTO_MODEL
): Promise<RephraseResult> {
  const { output, ...rest } = await generateJson(
    getGemini,
    {
      name: "rephrase",
      system: systemInstruction(language),
      user: `Language: ${language}
Text to rephrase:
"""
${text}
"""`,
      schema: responseSchema,
      // Five rewrites plus their notes
      sizedMaxTokens: 1500 + 3 * text.length,
      validate: (out) => buildRephraseResponse(text, language, out),
    },
    model
  );
  return { response: output, ...rest };
}

export function buildRephraseResponse(originalText: string, language: string, output: unknown): RephraseResponse {
  const raw = (output as { alternatives?: unknown })?.alternatives;
  const alternatives = (Array.isArray(raw) ? raw : [])
    .filter((a): a is Record<string, unknown> => !!a && typeof a.text === "string" && a.text.trim() !== "")
    .map((a) => ({
      text: a.text as string,
      description: typeof a.description === "string" ? a.description : "",
      changesOverview: typeof a.changesOverview === "string" ? a.changesOverview : "",
    }));
  // A partial answer is still useful; an empty one sends the request to the next model
  if (alternatives.length === 0) throw new Error("answer has no alternatives");
  return { originalText, language, alternatives };
}
