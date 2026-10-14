import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { useSearchParams } from "react-router";
import { SUPPORTED_LANGUAGES } from "../languages";
import type {
  CheckOptions,
  GrammarCheckResponse,
  RephraseAlternative,
  SavedItem,
} from "../types";
import { authHeaders, signOut } from "../hooks/useAuth";
import { fromDoc, plainToDoc, type DocNode, type RichText } from "../lib/richText";
import { useHistory } from "./history";
import { useLanguage } from "./language";
import { useWorkspaceTab } from "./workspace-tab";

type WorkspaceContextValue = {
  inputText: string;
  setInputText: (text: string) => void;
  loading: boolean;
  copiedText: string | null;
  checkResult: GrammarCheckResponse | null;
  rephraseResult: RephraseAlternative[] | null;
  errorMsg: string | null;
  maxCharacters: number;
  checkOptions: CheckOptions;
  setCheckOption: (key: keyof CheckOptions, value: boolean) => void;
  /** The editor document; replaced from outside whenever `inputDocVersion` changes */
  inputDoc: DocNode;
  inputDocVersion: number;
  handleEditorChange: (doc: DocNode, rich: RichText) => void;
  /** The formatted input the current check result was computed from (null for history items) */
  checkSource: RichText | null;
  handleCopyRich: (html: string, text: string, label: string) => void;
  handleClearText: () => void;
  handleInjectExample: (exampleText: string) => void;
  handleTrigger: () => Promise<void>;
  handleCopyText: (text: string, label: string) => void;
  handleReadAloud: (text: string) => void;
  applyHistoryItem: (item: SavedItem) => void;
};

const WorkspaceContext = createContext<WorkspaceContextValue | null>(null);

const CHECK_OPTIONS_KEY = "grammar_check_options";
const DEFAULT_CHECK_OPTIONS: CheckOptions = {
  keepAbbreviations: false,
  endWithFullStop: false,
  allowMixedLanguages: false,
};

function readStoredCheckOptions(): CheckOptions {
  try {
    const stored = localStorage.getItem(CHECK_OPTIONS_KEY);
    if (stored) return { ...DEFAULT_CHECK_OPTIONS, ...JSON.parse(stored) };
  } catch (e) {
    console.warn("Could not read stored check options", e);
  }
  return DEFAULT_CHECK_OPTIONS;
}

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const { selectedLanguage, setSelectedLanguage, languageEpoch } = useLanguage();
  const { addItem } = useHistory();
  const { activeTab, setActiveTab } = useWorkspaceTab();
  const [, setSearchParams] = useSearchParams();

  // The editor document is the source of truth; inputText is its plain text, which is what the
  // API checks. Seed it from the URL so a shared link restores the user's text.
  const [input, setInput] = useState(() => {
    const doc = plainToDoc(new URLSearchParams(window.location.search).get("q") ?? "");
    return { doc, rich: fromDoc(doc), version: 0 };
  });
  const inputText = input.rich.text;
  const [checkSource, setCheckSource] = useState<RichText | null>(null);

  /** Replaces the input from outside the editor (examples, history, clear) as plain text. */
  const setInputText = useCallback((text: string) => {
    const doc = plainToDoc(text);
    setInput((prev) => ({ doc, rich: fromDoc(doc), version: prev.version + 1 }));
  }, []);

  const handleEditorChange = useCallback((doc: DocNode, rich: RichText) => {
    setInput((prev) => ({ doc, rich, version: prev.version }));
  }, []);
  const [loading, setLoading] = useState(false);
  const [copiedText, setCopiedText] = useState<string | null>(null);
  const [checkResult, setCheckResult] = useState<GrammarCheckResponse | null>(
    null
  );
  const [rephraseResult, setRephraseResult] = useState<
    RephraseAlternative[] | null
  >(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [checkOptions, setCheckOptions] = useState<CheckOptions>(
    readStoredCheckOptions
  );

  const setCheckOption = useCallback(
    (key: keyof CheckOptions, value: boolean) => {
      setCheckOptions((prev) => {
        const next = { ...prev, [key]: value };
        try {
          localStorage.setItem(CHECK_OPTIONS_KEY, JSON.stringify(next));
        } catch (e) {
          console.warn("Could not store check options", e);
        }
        return next;
      });
    },
    []
  );

  const maxCharacters = 1500;

  useEffect(() => {
    if (languageEpoch === 0) return;
    setCheckResult(null);
    setRephraseResult(null);
  }, [languageEpoch]);

  // Keep the query in the URL so the current text is shareable / restorable.
  useEffect(() => {
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        if (inputText) {
          next.set("q", inputText);
        } else {
          next.delete("q");
        }
        return next;
      },
      { replace: true }
    );
  }, [inputText, setSearchParams]);

  const applyHistoryItem = useCallback(
    (item: SavedItem) => {
      setInputText(item.originalText);
      const matchedLang = SUPPORTED_LANGUAGES.find(
        (lang) => lang.code === item.languageCode
      );
      if (matchedLang) {
        setSelectedLanguage(matchedLang);
      }

      if (item.type === "check" && item.correctedText) {
        setActiveTab("check");
        setCheckResult({
          correctedText: item.correctedText,
          language: item.languageCode,
          score: 95,
          segments: [
            { type: "unmodified", text: item.correctedText, id: "hist-1" },
          ],
          explanations: [],
        });
        setCheckSource(null);
        setRephraseResult(null);
      } else if (item.type === "rephrase" && item.rephraseOptions) {
        setActiveTab("rephrase");
        setRephraseResult(item.rephraseOptions);
        setCheckResult(null);
      }
    },
    [setActiveTab, setSelectedLanguage, setInputText]
  );

  const handleClearText = () => {
    setInputText("");
    setCheckResult(null);
    setRephraseResult(null);
    setErrorMsg(null);
  };

  const handleInjectExample = (exampleText: string) => {
    setInputText(exampleText);
    setCheckResult(null);
    setRephraseResult(null);
    setErrorMsg(null);
  };

  const handleCheckGrammar = async () => {
    if (!inputText.trim()) return;
    // The result's diff positions refer to exactly this text, so keep its formatting with it
    const source = input.rich;
    setLoading(true);
    setErrorMsg(null);
    try {
      // No model: the server picks one from its fallback chain
      const response = await fetch("/api/check", {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({
          text: source.text,
          language: selectedLanguage.name,
          options: checkOptions,
        }),
      });
      const data = await response.json();
      if (response.status === 401) {
        signOut();
        throw new Error("Session expired. Please sign in again.");
      }
      if (!response.ok) {
        throw new Error(data.error || "Linguistic analysis failed.");
      }
      setCheckResult(data);
      setCheckSource(source);

      addItem({
        id: "sav-" + Date.now().toString(36),
        originalText: inputText,
        correctedText: data.correctedText,
        languageCode: selectedLanguage.code,
        timestamp: Date.now(),
        type: "check",
      });
    } catch (err: unknown) {
      console.error(err);
      setErrorMsg(
        err instanceof Error
          ? err.message
          : "Something went wrong during check. Please retry."
      );
    } finally {
      setLoading(false);
    }
  };

  const handleRephraseText = async () => {
    if (!inputText.trim()) return;
    setLoading(true);
    setErrorMsg(null);
    try {
      // No model: the server picks one from its fallback chain
      const response = await fetch("/api/rephrase", {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({
          text: inputText,
          language: selectedLanguage.name,
        }),
      });
      const data = await response.json();
      if (response.status === 401) {
        signOut();
        throw new Error("Session expired. Please sign in again.");
      }
      if (!response.ok) {
        throw new Error(data.error || "Alternatives generation failed.");
      }
      setRephraseResult(data.alternatives);

      addItem({
        id: "sav-" + Date.now().toString(36),
        originalText: inputText,
        rephraseOptions: data.alternatives,
        languageCode: selectedLanguage.code,
        timestamp: Date.now(),
        type: "rephrase",
      });
    } catch (err: unknown) {
      console.error(err);
      setErrorMsg(
        err instanceof Error
          ? err.message
          : "An error occurred while generating alternatives."
      );
    } finally {
      setLoading(false);
    }
  };

  const handleTrigger = async () => {
    if (activeTab === "check") {
      await handleCheckGrammar();
    } else {
      await handleRephraseText();
    }
  };

  const handleCopyText = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopiedText(label);
    setTimeout(() => setCopiedText(null), 2000);
  };

  /** Copies formatted text for mail, Teams or Word, with plain text for fields that don't take HTML. */
  const handleCopyRich = (html: string, text: string, label: string) => {
    const write =
      typeof ClipboardItem === "undefined"
        ? Promise.reject(new Error("ClipboardItem is not supported"))
        : navigator.clipboard.write([
            new ClipboardItem({
              "text/html": new Blob([html], { type: "text/html" }),
              "text/plain": new Blob([text], { type: "text/plain" }),
            }),
          ]);
    write.catch(() => navigator.clipboard.writeText(text));
    setCopiedText(label);
    setTimeout(() => setCopiedText(null), 2000);
  };

  const handleReadAloud = (text: string) => {
    if ("speechSynthesis" in window) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      const langMap: { [key: string]: string } = {
        English: "en-US",
        French: "fr-FR",
        Spanish: "es-ES",
        German: "de-DE",
        Italian: "it-IT",
        Portuguese: "pt-PT",
        Arabic: "ar-SA",
        Russian: "ru-RU",
        Japanese: "ja-JP",
        Chinese: "zh-CN",
      };
      utterance.lang = langMap[selectedLanguage.code] || "en-US";
      window.speechSynthesis.speak(utterance);
    } else {
      alert("TTS audio playback is not supported by your browser.");
    }
  };

  return (
    <WorkspaceContext.Provider
      value={{
        inputText,
        setInputText,
        loading,
        copiedText,
        checkResult,
        rephraseResult,
        errorMsg,
        maxCharacters,
        checkOptions,
        setCheckOption,
        inputDoc: input.doc,
        inputDocVersion: input.version,
        handleEditorChange,
        checkSource,
        handleCopyRich,
        handleClearText,
        handleInjectExample,
        handleTrigger,
        handleCopyText,
        handleReadAloud,
        applyHistoryItem,
      }}
    >
      {children}
    </WorkspaceContext.Provider>
  );
}

export function useWorkspace() {
  const ctx = useContext(WorkspaceContext);
  if (!ctx) {
    throw new Error("useWorkspace must be used within WorkspaceProvider");
  }
  return ctx;
}
