/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import express, { type NextFunction, type Request, type Response } from "express";
import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";
import { type CheckOptions, checkGrammar } from "./check.js";
import { AUTO_MODEL, SUPPORTED_MODELS } from "./llm.js";
import { rephraseText } from "./rephrase.js";

dotenv.config();

const app = express();
const PORT = Number(process.env.PORT ?? 3000);
const PB_URL = (process.env.PB_URL ?? "").replace(/\/$/, "");

app.use(express.json());

type AuthedRequest = Request & {
  user?: Record<string, unknown>;
};

async function requireAuth(req: AuthedRequest, res: Response, next: NextFunction) {
  if (!PB_URL) {
    console.error("PB_URL is not configured");
    return res.status(500).json({ error: "Auth is not configured on the server." });
  }

  const authorization = req.header("authorization");
  if (!authorization) {
    return res.status(401).json({ error: "Authentication required." });
  }

  try {
    const response = await fetch(`${PB_URL}/api/collections/users/auth-refresh`, {
      method: "POST",
      headers: { Authorization: authorization },
    });

    if (!response.ok) {
      return res.status(401).json({ error: "Invalid or expired session." });
    }

    const data = (await response.json()) as { record?: Record<string, unknown> };
    if (!data.record) {
      return res.status(401).json({ error: "Invalid or expired session." });
    }

    req.user = data.record;
    next();
  } catch (err) {
    console.error("Auth verification failed:", err);
    return res.status(401).json({ error: "Could not verify session." });
  }
}

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

/** Which link of the fallback chain answered, to see how often the free tiers run out. */
function logChainResult(route: string, started: number, result: { model: string; fallbacks: string[] }) {
  console.info(
    `[${route}] ${result.model} in ${Date.now() - started}ms` +
      (result.fallbacks.length ? ` after: ${result.fallbacks.join("; ")}` : "")
  );
}

// 1. Health check & configuration check
app.get("/api/config", requireAuth, (req, res) => {
  const apiKeyExists = !!process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY !== "MY_GEMINI_API_KEY";
  res.json({
    configOk: apiKeyExists,
    message: apiKeyExists 
      ? "Gemini API key is configured."
      : "Gemini API key is missing. Please add your key in Settings > Secrets."
  });
});

// 2. Grammar check & diff generation API
app.post("/api/check", requireAuth, async (req, res) => {
  try {
    const { text, language = "English", model = AUTO_MODEL } = req.body;
    if (!text || typeof text !== "string" || text.trim() === "") {
      return res.status(400).json({ error: "Text content is required" });
    }

    const started = Date.now();
    const targetModel = SUPPORTED_MODELS.includes(model) ? model : AUTO_MODEL;
    const options: CheckOptions = {
      keepAbbreviations: req.body.options?.keepAbbreviations === true,
      endWithFullStop: req.body.options?.endWithFullStop === true,
      allowMixedLanguages: req.body.options?.allowMixedLanguages === true,
    };
    const result = await checkGrammar(getGeminiClient, text, language, targetModel, options);
    logChainResult("check", started, result);
    res.setHeader("X-Model", result.model);
    res.json(result.response);
  } catch (err: any) {
    console.error("Error in /api/check:", err);
    res.status(500).json({ error: err.message || "Failed to check grammar." });
  }
});

// 3. Multi Rephrase API
app.post("/api/rephrase", requireAuth, async (req, res) => {
  try {
    const { text, language = "English", model = AUTO_MODEL } = req.body;
    if (!text || typeof text !== "string" || text.trim() === "") {
      return res.status(400).json({ error: "Text content is required" });
    }

    const started = Date.now();
    const targetModel = SUPPORTED_MODELS.includes(model) ? model : AUTO_MODEL;
    const result = await rephraseText(getGeminiClient, text, language, targetModel);
    logChainResult("rephrase", started, result);
    res.setHeader("X-Model", result.model);
    res.json(result.response);
  } catch (err: any) {
    console.error("Error in /api/rephrase:", err);
    res.status(500).json({ error: err.message || "Failed to rephrase text." });
  }
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`API server successfully running on port ${PORT}`);
});
