import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ChangeEvent,
  type ReactNode,
} from "react";
import { SUPPORTED_LANGUAGES } from "../languages";
import type {
  GrammarCheckResponse,
  RephraseAlternative,
  SavedItem,
} from "../types";
import { authHeaders, signOut } from "../hooks/useAuth";
import { useHistory } from "./history";
import { useLanguage } from "./language";
import { useWorkspaceTab } from "./workspace-tab";

const MODEL_ID = "gemini-3.1-flash-lite";

type WorkspaceContextValue = {
  inputText: string;
  setInputText: (text: string) => void;
  loading: boolean;
  copiedText: string | null;
  checkResult: GrammarCheckResponse | null;
  rephraseResult: RephraseAlternative[] | null;
  errorMsg: string | null;
  maxCharacters: number;
  handleTextChange: (e: ChangeEvent<HTMLTextAreaElement>) => void;
  handleClearText: () => void;
  handleInjectExample: (exampleText: string) => void;
  handleTrigger: () => Promise<void>;
  handleCopyText: (text: string, label: string) => void;
  handleReadAloud: (text: string) => void;
  applyHistoryItem: (item: SavedItem) => void;
};

const WorkspaceContext = createContext<WorkspaceContextValue | null>(null);

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const { selectedLanguage, setSelectedLanguage, languageEpoch } = useLanguage();
  const { addItem } = useHistory();
  const { activeTab, setActiveTab } = useWorkspaceTab();

  const [inputText, setInputText] = useState("");
  const [loading, setLoading] = useState(false);
  const [copiedText, setCopiedText] = useState<string | null>(null);
  const [checkResult, setCheckResult] = useState<GrammarCheckResponse | null>(
    null
  );
  const [rephraseResult, setRephraseResult] = useState<
    RephraseAlternative[] | null
  >(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const maxCharacters = 1500;

  useEffect(() => {
    if (languageEpoch === 0) return;
    setCheckResult(null);
    setRephraseResult(null);
  }, [languageEpoch]);

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
        setRephraseResult(null);
      } else if (item.type === "rephrase" && item.rephraseOptions) {
        setActiveTab("rephrase");
        setRephraseResult(item.rephraseOptions);
        setCheckResult(null);
      }
    },
    [setActiveTab, setSelectedLanguage]
  );

  const handleTextChange = (e: ChangeEvent<HTMLTextAreaElement>) => {
    const text = e.target.value;
    if (text.length <= maxCharacters) {
      setInputText(text);
    }
  };

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
    setLoading(true);
    setErrorMsg(null);
    try {
      const response = await fetch("/api/check", {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({
          text: inputText,
          language: selectedLanguage.name,
          model: MODEL_ID,
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
      const response = await fetch("/api/rephrase", {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({
          text: inputText,
          language: selectedLanguage.name,
          model: MODEL_ID,
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
        handleTextChange,
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
