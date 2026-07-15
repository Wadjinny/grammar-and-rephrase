/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import express from "express";
import { GoogleGenAI, Type } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = Number(process.env.PORT ?? 3000);

app.use(express.json());

// Global variable for Lazy loading Gemini SDK
let aiInstance: GoogleGenAI | null = null;

function getGeminiClient(): GoogleGenAI {
  if (!aiInstance) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey || apiKey === "MY_GEMINI_API_KEY") {
      throw new Error(
        "GEMINI_API_KEY is not defined. Please add your Gemini API Key in the Settings > Secrets panel of Google AI Studio."
      );
    }
    aiInstance = new GoogleGenAI({
      apiKey: apiKey,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build",
        },
      },
    });
  }
  return aiInstance;
}

// 1. Health check & configuration check
app.get("/api/config", (req, res) => {
  const apiKeyExists = !!process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY !== "MY_GEMINI_API_KEY";
  res.json({
    configOk: apiKeyExists,
    message: apiKeyExists 
      ? "Gemini API key is configured."
      : "Gemini API key is missing. Please add your key in Settings > Secrets."
  });
});

// 2. Grammar check & diff generation API
app.post("/api/check", async (req, res) => {
  try {
    const { text, language = "English", model = "gemini-3.5-flash" } = req.body;
    if (!text || typeof text !== "string" || text.trim() === "") {
      return res.status(400).json({ error: "Text content is required" });
    }

    const ai = getGeminiClient();
    const allowedModels = ["gemini-3.5-flash", "gemini-3.1-pro-preview", "gemini-3.1-flash-lite"];
    const targetModel = allowedModels.includes(model) ? model : "gemini-3.5-flash";

    const systemInstruction = `You are a high-fidelity Grammar Checker, Proofreader, and Linguistic Editor in the style of Reverso.
Your job is to inspect the input text in the specified language, correct all grammar, spelling, punctuation, styling, and vocabulary errors, and explain them.

To enable rich visual highlighting, you must segment the edit relationship into a strict, sequential list of DiffSegments.
Each segment has a 'type':
- 'unmodified': The text is identical in both the original and corrected text.
- 'deleted': The text is part of original text, but has been removed or replaced in the corrected text.
- 'inserted': The text is part of the corrected text, but was added or replaces something in the original text.

CRITICAL MATHEMATICAL CONSTRAINTS FOR SEGMENTS:
1. Concatenating all characters of 'unmodified' and 'deleted' segments in order MUST EXACTLY reconstruct the user's original input text.
2. Concatenating all characters of 'unmodified' and 'inserted' segments in order MUST EXACTLY reconstruct the final corrected text.
3. If an error is corrected, represent it by placing the 'deleted' segment followed immediately by the 'inserted' segment.
4. Every 'deleted' and 'inserted' segment MUST have a friendly, educational 'reason' explaining what was wrong and why it was corrected. Give these reasons and explanations in the target language (which is specified in the prompt). E.g., for 'unmodified' segments, 'reason' is omitted.
5. Do not lose any semantic meaning of the original text.
6. **MINIMIZE LENGTH & MAXIMIZE GRANULARITY**: Keep 'deleted' and 'inserted' segments as short and precise as possible. Break down edits to the word or sub-word level. Do not group multiple words or entire clauses into a single edit unless they are completely rewritten. If only a single word has a typo or grammar issue, only mark that specific word as deleted/inserted, leaving surrounding spaces and words completely 'unmodified'. Every character counts.

Also calculate an overall linguistic quality 'score' from 0 to 100 for the original text, and return a list of categorized explanations. All explanations and reasons throughout the response must be written in the target language to help the learner understand contextually.`;

    const prompt = `Target Language: ${language}
All reasons, explanations, and linguistic comments must be written in "${language}" as well.
Input Text to check:
"${text}"`;

    const response = await ai.models.generateContent({
      model: targetModel,
      contents: prompt,
      config: {
        systemInstruction,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            correctedText: {
              type: Type.STRING,
              description: "The full, polished, grammatically correct version of the input text."
            },
            language: {
              type: Type.STRING,
              description: "The double-checked language name."
            },
            score: {
              type: Type.INTEGER,
              description: " LInguistic score from 0-100 indicating original text's grammar quality. 100 means flawless."
            },
            segments: {
              type: Type.ARRAY,
              description: "Sequential list of segments representing the diff transformation.",
              items: {
                type: Type.OBJECT,
                properties: {
                  type: {
                    type: Type.STRING,
                    description: "Strictly 'unmodified', 'deleted', or 'inserted'"
                  },
                  text: {
                    type: Type.STRING,
                    description: "The actual words or characters in this segment"
                  },
                  reason: {
                    type: Type.STRING,
                    description: "Reason for edit/correction. Mandatory for 'deleted' and 'inserted' segments. Give explanations and reasons in the target language."
                  }
                },
                required: ["type", "text"]
              }
            },
            explanations: {
              type: Type.ARRAY,
              description: "Categorized overview of other specific errors detected.",
              items: {
                type: Type.OBJECT,
                properties: {
                  original: { type: Type.STRING, description: "Snippet of original error" },
                  corrected: { type: Type.STRING, description: "Corrected snippet replacement" },
                  category: {
                    type: Type.STRING,
                    description: "One of: 'Spelling', 'Grammar', 'Punctuation', 'Style', 'Vocabulary'"
                  },
                  explanation: {
                    type: Type.STRING,
                    description: "Brief Reverso-style explanations of the grammatical concept or error. Give explanations entirely in the target language."
                  }
                },
                required: ["original", "corrected", "category", "explanation"]
              }
            }
          },
          required: ["correctedText", "language", "segments", "explanations", "score"]
        }
      }
    });

    const parsedData = JSON.parse(response.text || "{}");
    res.json(parsedData);
  } catch (err: any) {
    console.error("Error in /api/check:", err);
    res.status(500).json({ error: err.message || "Failed to check grammar." });
  }
});

// 3. Multi Rephrase API
app.post("/api/rephrase", async (req, res) => {
  try {
    const { text, language = "English", model = "gemini-3.5-flash" } = req.body;
    if (!text || typeof text !== "string" || text.trim() === "") {
      return res.status(400).json({ error: "Text content is required" });
    }

    const ai = getGeminiClient();
    const allowedModels = ["gemini-3.5-flash", "gemini-3.1-pro-preview", "gemini-3.1-flash-lite"];
    const targetModel = allowedModels.includes(model) ? model : "gemini-3.5-flash";

    const systemInstruction = `You are an expert copywriter and multilingual rephrase engine in the style of Reverso Rephraser.
Generate exactly 5 elegant, distinct rephrasing alternatives for the provided text, each matching a specific tone:

1. 'Regular / Natural': polished and fluent alternative, natural phrasing.
2. 'Formal / Business': polite, professional, suitable for emails, resume, or business letters.
3. 'Casual / Warm': laid-back, friendly, conversational.
4. 'Concise / Bulletproof': short, direct, space-saver, compact word count.
5. 'Creative / Vivid': rich expression, inspiring, stylistic flair.

Make sure the rephrased texts, their helpful descriptions (description), and their changes overviews (changesOverview) are entirely in the target Language: '${language}'.
Explain briefly where to best use each alternative in a simple, friendly suggestion written entirely in the target language '${language}'.`;

    const prompt = `Input Text: "${text}"
Target Language: ${language}
All descriptions, changes overview, and suggestions MUST be written in "${language}".`;

    const response = await ai.models.generateContent({
      model: targetModel,
      contents: prompt,
      config: {
        systemInstruction,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            originalText: { type: Type.STRING },
            language: { type: Type.STRING },
            alternatives: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  text: { type: Type.STRING, description: "The beautiful rephrased content." },
                  tone: { type: Type.STRING, description: "Exact tone name: 'Regular / Natural', 'Formal / Business', 'Casual / Warm', 'Concise / Bulletproof', or 'Creative / Vivid'" },
                  description: { type: Type.STRING, description: "A very clear, human suggestion on when to use this, written entirely in the target language (e.g. 'Parfait pour envoyer Ã  vos collÃ¨gues' if selected language is French)." },
                  changesOverview: { type: Type.STRING, description: "What key change was made, in 2-5 words, written entirely in the target language (e.g. 'Vocabulaire soutenu' if selected language is French)." }
                },
                required: ["text", "tone", "description"]
              }
            }
          },
          required: ["originalText", "language", "alternatives"]
        }
      }
    });

    const parsedData = JSON.parse(response.text || "{}");
    res.json(parsedData);
  } catch (err: any) {
    console.error("Error in /api/rephrase:", err);
    res.status(500).json({ error: err.message || "Failed to rephrase text." });
  }
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`API server successfully running on port ${PORT}`);
});
