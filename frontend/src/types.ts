/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface DiffSegment {
  type: "unmodified" | "deleted" | "inserted";
  text: string;
  reason?: string;
  id: string; // unique ID to correlate or key in lists
}

export interface GrammarExplanation {
  original: string;
  corrected: string;
  category: "Spelling" | "Grammar" | "Punctuation" | "Style" | "Vocabulary" | "General";
  explanation: string;
}

export interface GrammarCheckResponse {
  correctedText: string;
  language: string;
  segments: DiffSegment[];
  explanations: GrammarExplanation[];
  score: number; // overall quality score out of 100
}

export interface RephraseAlternative {
  text: string;
  description?: string;
  changesOverview?: string;
}

export interface RephraseResponse {
  originalText: string;
  language: string;
  alternatives: RephraseAlternative[];
}

export interface Language {
  code: string;
  name: string;
  nativeName: string;
  flag: string;
  placeholder: string;
  examples: Array<{ title: string; text: string }>;
}

export interface SavedItem {
  id: string;
  originalText: string;
  correctedText?: string;
  rephraseOptions?: RephraseAlternative[];
  languageCode: string;
  timestamp: number;
  type: "check" | "rephrase";
}
