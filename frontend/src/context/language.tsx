import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { SUPPORTED_LANGUAGES } from "../languages";
import type { Language } from "../types";

const STORAGE_KEY = "gemini_linguistic_language";

type LanguageContextValue = {
  selectedLanguage: Language;
  setSelectedLanguage: (language: Language) => void;
  /** Bumps when the user picks a language from the nav (not programmatic restore). */
  languageEpoch: number;
  selectLanguage: (language: Language) => void;
};

const LanguageContext = createContext<LanguageContextValue | null>(null);

function readStoredLanguage(): Language {
  try {
    const code = localStorage.getItem(STORAGE_KEY);
    if (code) {
      const matched = SUPPORTED_LANGUAGES.find((lang) => lang.code === code);
      if (matched) return matched;
    }
  } catch (e) {
    console.warn("Could not read stored language", e);
  }
  return SUPPORTED_LANGUAGES[0];
}

function writeStoredLanguage(language: Language) {
  try {
    localStorage.setItem(STORAGE_KEY, language.code);
  } catch (e) {
    console.error("Could not write language to localStorage", e);
  }
}

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [selectedLanguage, setSelectedLanguageState] =
    useState<Language>(readStoredLanguage);
  const [languageEpoch, setLanguageEpoch] = useState(0);

  const setSelectedLanguage = useCallback((language: Language) => {
    setSelectedLanguageState(language);
    writeStoredLanguage(language);
  }, []);

  const selectLanguage = useCallback((language: Language) => {
    setSelectedLanguageState(language);
    writeStoredLanguage(language);
    setLanguageEpoch((n) => n + 1);
  }, []);

  const value = useMemo(
    () => ({
      selectedLanguage,
      setSelectedLanguage,
      languageEpoch,
      selectLanguage,
    }),
    [selectedLanguage, setSelectedLanguage, languageEpoch, selectLanguage]
  );

  return (
    <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>
  );
}

export function useLanguage() {
  const ctx = useContext(LanguageContext);
  if (!ctx) {
    throw new Error("useLanguage must be used within LanguageProvider");
  }
  return ctx;
}
