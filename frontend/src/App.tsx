/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from "react";
import { 
  Sparkles, 
  Languages, 
  Clipboard, 
  Check, 
  RefreshCw, 
  ArrowRight, 
  Volume2, 
  HelpCircle, 
  TrendingUp, 
  AlertCircle,
  Info
} from "lucide-react";
import { SUPPORTED_LANGUAGES } from "./languages";
import type {
  GrammarCheckResponse,
  RephraseAlternative,
  SavedItem,
  Language
} from "./types";
import DiffHighlight from "./components/DiffHighlight";
import SavedCollection from "./components/SavedCollection";
import LoginScreen from "./components/LoginScreen";
import { motion, AnimatePresence } from "motion/react";
import { authHeaders, signOut, useAuth } from "./hooks/useAuth";

export default function App() {
  const { user, isValid } = useAuth();
  const [inputText, setInputText] = useState<string>("");
  const [selectedLanguage, setSelectedLanguage] = useState<Language>(SUPPORTED_LANGUAGES[0]);
  const [isDropdownOpen, setIsDropdownOpen] = useState<boolean>(false);
  const [searchLangQuery, setSearchLangQuery] = useState<string>("");

  // Model (single fixed option)
  const MODEL_ID = "gemini-3.1-flash-lite";
  const MODEL_NAME = "Gemini 3.1 Flash Lite";

  // UI states
  const [activeTab, setActiveTab ] = useState<"check" | "rephrase" >("check");
  const [loading, setLoading] = useState<boolean>(false);
  const [copiedText, setCopiedText] = useState<string | null>(null);
  
  // Check results state
  const [checkResult, setCheckResult] = useState<GrammarCheckResponse | null>(null);
  
  // Rephrase results state
  const [rephraseResult, setRephraseResult] = useState<RephraseAlternative[] | null>(null);
  
  // App Config feedback
  const [isApiKeySet, setIsApiKeySet] = useState<boolean | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  
  // Saved / history collection
  const [historyItems, setHistoryItems] = useState<SavedItem[]>([]);

  // Load history & Check API Key status (only when signed in)
  useEffect(() => {
    if (!isValid) return;

    try {
      const storedHistory = localStorage.getItem("gemini_linguistic_history");
      if (storedHistory) {
        setHistoryItems(JSON.parse(storedHistory));
      }
    } catch (e) {
      console.warn("Could not read localstorage history", e);
    }

    fetch("/api/config", { headers: authHeaders() })
      .then(async (res) => {
        const data = await res.json().catch(() => ({}));
        if (res.status === 401) {
          signOut();
          return;
        }
        setIsApiKeySet(data.configOk);
        if (!data.configOk) {
          setErrorMsg("Gemini API key is missing. Please populate GEMINI_API_KEY in the Secrets panel in AI Studio.");
        }
      })
      .catch((err) => {
        console.error("Config check failed", err);
        setIsApiKeySet(false);
      });
  }, [isValid]);

  if (!isValid) {
    return <LoginScreen />;
  }

  // Sync history to localStorage
  const saveHistory = (newHistory: SavedItem[]) => {
    setHistoryItems(newHistory);
    try {
      localStorage.setItem("gemini_linguistic_history", JSON.stringify(newHistory));
    } catch (e) {
      console.error("Could not write history to localStorage", e);
    }
  };

  const handleClearHistory = () => {
    saveHistory([]);
  };

  const handleDeleteHistoryItem = (id: string) => {
    const updated = historyItems.filter((it) => it.id !== id);
    saveHistory(updated);
  };

  const handleApplyHistoryItem = (item: SavedItem) => {
    setInputText(item.originalText);
    const matchedLang = SUPPORTED_LANGUAGES.find((lang) => lang.code === item.languageCode);
    if (matchedLang) {
      setSelectedLanguage(matchedLang);
    }
    
    if (item.type === "check" && item.correctedText) {
      setActiveTab("check");
      // Reconstitute suitable local dummy view state
      setCheckResult({
        correctedText: item.correctedText,
        language: item.languageCode,
        score: 95,
        segments: [
          { type: "unmodified", text: item.correctedText, id: "hist-1" }
        ],
        explanations: []
      });
      setRephraseResult(null);
    } else if (item.type === "rephrase" && item.rephraseOptions) {
      setActiveTab("rephrase");
      setRephraseResult(item.rephraseOptions);
      setCheckResult(null);
    }
  };

  // Character Limit
  const maxCharacters = 1500;
  const currentLen = inputText.length;

  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
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
          model: MODEL_ID
        })
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
      
      // Cache this result in History
      const textId = "sav-" + Date.now().toString(36);
      const newHistoryItem: SavedItem = {
        id: textId,
        originalText: inputText,
        correctedText: data.correctedText,
        languageCode: selectedLanguage.code,
        timestamp: Date.now(),
        type: "check"
      };
      
      const updatedHistory = [newHistoryItem, ...historyItems.slice(0, 19)];
      saveHistory(updatedHistory);
      
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.message || "Something went wrong during check. Please retry.");
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
          model: MODEL_ID
        })
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
      
      // Cache in history
      const textId = "sav-" + Date.now().toString(36);
      const newHistoryItem: SavedItem = {
        id: textId,
        originalText: inputText,
        rephraseOptions: data.alternatives,
        languageCode: selectedLanguage.code,
        timestamp: Date.now(),
        type: "rephrase"
      };
      
      const updatedHistory = [newHistoryItem, ...historyItems.slice(0, 19)];
      saveHistory(updatedHistory);

    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.message || "An error occurred while generating alternatives.");
    } finally {
      setLoading(false);
    }
  };

  const handleTriggerCorrectAndRephrase = async () => {
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

  // Filter languages according to search query
  const filteredLanguages = SUPPORTED_LANGUAGES.filter((lang) =>
    lang.name.toLowerCase().includes(searchLangQuery.toLowerCase()) ||
    lang.nativeName.toLowerCase().includes(searchLangQuery.toLowerCase())
  );

  // Audio text to speech (using native Synthesis if available)
  const handleReadAloud = (text: string) => {
    if ("speechSynthesis" in window) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      // Attempt mapping language code rough guess
      const langMap: { [key: string]: string } = {
        "English": "en-US",
        "French": "fr-FR",
        "Spanish": "es-ES",
        "German": "de-DE",
        "Italian": "it-IT",
        "Portuguese": "pt-PT",
        "Arabic": "ar-SA",
        "Russian": "ru-RU",
        "Japanese": "ja-JP",
        "Chinese": "zh-CN"
      };
      utterance.lang = langMap[selectedLanguage.code] || "en-US";
      window.speechSynthesis.speak(utterance);
    } else {
      alert("TTS audio playback is not supported by your browser.");
    }
  };

  return (
    <div className="flex flex-col min-h-screen bg-canvas font-sans antialiased text-gray-900" id="main-container">
      
      {/* 1. Header Navigation — pill nav */}
      <nav className="flex items-center justify-between gap-4 px-4 sm:px-6 py-4 sticky top-0 z-40">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-indigo-600 rounded-ctrl flex items-center justify-center shadow-pop">
            <span className="text-white font-bold text-lg select-none">G</span>
          </div>
          <div>
            <h1 className="text-[15px] font-bold text-gray-900 tracking-tight leading-tight">
              Grammar and Rephrase
            </h1>
            <p className="text-[11px] text-gray-400 font-medium">Linguistic assistant</p>
          </div>
        </div>

        {/* Feature selection — floating pill tabs */}
        <div className="hidden md:flex items-center gap-1 bg-white p-[5px] rounded-full shadow-card">
          <button
            onClick={() => { setActiveTab("check"); setErrorMsg(null); }}
            className={`px-5 py-2 rounded-full text-[13px] transition-all ${
              activeTab === "check"
                ? "bg-indigo-600 text-white font-semibold"
                : "text-gray-500 hover:text-gray-900 font-medium"
            }`}
            id="nav-tab-check"
          >
            Grammar checker
          </button>
          <button
            onClick={() => { setActiveTab("rephrase"); setErrorMsg(null); }}
            className={`px-5 py-2 rounded-full text-[13px] transition-all ${
              activeTab === "rephrase"
                ? "bg-indigo-600 text-white font-semibold"
                : "text-gray-500 hover:text-gray-900 font-medium"
            }`}
            id="nav-tab-rephrase"
          >
            Multi-rephraser
          </button>
        </div>

        {/* Live Language Selector Toggle Dropdown */}
        <div className="flex items-center gap-3">
          <div className="relative">
            <button
              onClick={() => {
                setIsDropdownOpen(!isDropdownOpen);
              }}
              className="flex items-center gap-2 pl-3.5 pr-3 py-2 rounded-full bg-white hover:shadow-hover cursor-pointer transition-all text-[13px] font-semibold text-gray-700 shadow-card max-w-44"
              title="Select target language"
              id="language-select-button"
            >
              <span className="text-base select-none shrink-0">{selectedLanguage.flag}</span>
              <span className="truncate">{selectedLanguage.name}</span>
              <svg 
                className={`w-3.5 h-3.5 text-gray-400 ml-0.5 shrink-0 transition-transform ${isDropdownOpen ? "rotate-180" : ""}`} 
                fill="none" 
                stroke="currentColor" 
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M19 9l-7 7-7-7"></path>
              </svg>
            </button>

            {/* Dropdown Menu block */}
            <AnimatePresence>
              {isDropdownOpen && (
                <div 
                  className="absolute right-0 mt-2.5 w-64 bg-white rounded-card shadow-hover z-50 p-2 overflow-hidden"
                  id="language-dropdown-menu"
                >
                  <div className="p-1 mb-1.5">
                    <input
                      type="text"
                      className="w-full text-[12.5px] px-3 py-2 rounded-ctrl bg-white border-[1.5px] border-gray-200 outline-none focus:border-indigo-600 focus:ring-[3px] focus:ring-indigo-50 text-gray-900 transition"
                      placeholder="Search language..."
                      value={searchLangQuery}
                      onChange={(e) => setSearchLangQuery(e.target.value)}
                      onClick={(e) => e.stopPropagation()}
                      autoFocus
                    />
                  </div>
                  <div className="max-h-60 overflow-y-auto space-y-0.5">
                    {filteredLanguages.length === 0 ? (
                      <div className="text-[12px] text-gray-400 text-center py-4">No matching language found</div>
                    ) : (
                      filteredLanguages.map((lang) => (
                        <button
                          key={lang.code}
                          onClick={() => {
                            setSelectedLanguage(lang);
                            setIsDropdownOpen(false);
                            setSearchLangQuery("");
                            setCheckResult(null);
                            setRephraseResult(null);
                          }}
                          className={`w-full text-left px-3 py-2 rounded-ctrl text-[13px] font-semibold flex items-center justify-between transition-colors ${
                            selectedLanguage.code === lang.code
                              ? "bg-indigo-50 text-indigo-600"
                              : "text-gray-700 hover:bg-gray-50"
                          }`}
                        >
                          <span className="flex items-center gap-2">
                            <span className="text-sm select-none">{lang.flag}</span>
                            <span>{lang.name}</span>
                          </span>
                          <span className="text-[11px] text-gray-400 font-normal">
                            {lang.nativeName}
                          </span>
                        </button>
                      ))
                    )}
                  </div>
                </div>
              )}
            </AnimatePresence>
          </div>

          <div className="hidden sm:flex items-center gap-2">
            <span className="max-w-[140px] truncate rounded-full bg-indigo-50 px-3 py-1.5 text-[11px] font-bold text-indigo-600">
              {(typeof user?.name === "string" && user.name) ||
                (typeof user?.email === "string" && user.email) ||
                "Signed in"}
            </span>
            <button
              type="button"
              onClick={() => signOut()}
              className="rounded-full bg-white px-3.5 py-2 text-[12.5px] font-semibold text-gray-700 shadow-card transition hover:shadow-hover"
            >
              Sign out
            </button>
          </div>
          <button
            type="button"
            onClick={() => signOut()}
            className="sm:hidden rounded-full bg-white px-3.5 py-2 text-[12.5px] font-semibold text-gray-700 shadow-card"
          >
            Sign out
          </button>
        </div>
      </nav>

      {/* API Key Missing Instruction banner */}
      {isApiKeySet === false && (
        <div className="mx-4 sm:mx-6 mt-2 bg-indigo-50 rounded-ctrl p-3.5 flex items-start gap-3">
          <AlertCircle className="h-5 w-5 text-indigo-600 shrink-0 mt-0.5" />
          <div className="text-[12.5px] text-indigo-700 leading-relaxed">
            <span className="font-bold">Missing Gemini API key:</span> AI actions may fail. Please ensure your 
            <code className="bg-indigo-100 text-indigo-700 px-1.5 py-0.5 rounded-md mx-1 font-mono text-[11px]">GEMINI_API_KEY</code> 
            secret is populated in the AI Studio Secrets panel.
          </div>
        </div>
      )}

      {/* Main Container Area */}
      <main className="flex-1 max-w-[1280px] w-full mx-auto p-4 sm:px-6 sm:pb-10 grid grid-cols-1 lg:grid-cols-[1.9fr_1fr] gap-4">
        
        {/* Left Side: Layout for input pane & output workspace */}
        <div className="flex flex-col gap-4">

          {/* Quick toggle feature tab bar for mobile view only */}
          <div className="flex md:hidden items-center gap-1 bg-white p-[5px] rounded-full shadow-card w-full">
            <button
              onClick={() => { setActiveTab("check"); setErrorMsg(null); }}
              className={`flex-1 text-center py-2 rounded-full text-[13px] font-medium transition-all ${
                activeTab === "check" ? "bg-indigo-600 text-white font-semibold" : "text-gray-500"
              }`}
            >
              Checker
            </button>
            <button
              onClick={() => { setActiveTab("rephrase"); setErrorMsg(null); }}
              className={`flex-1 text-center py-2 rounded-full text-[13px] font-medium transition-all ${
                activeTab === "rephrase" ? "bg-indigo-600 text-white font-semibold" : "text-gray-500"
              }`}
            >
              Rephraser
            </button>
          </div>

          {/* The Workspace card with input text box split with original state */}
          <div className="bg-white rounded-card shadow-card flex flex-col overflow-hidden relative min-h-[320px]">
            {/* Input Header & Controls */}
            <div className="px-5 py-3.5 border-b border-gray-100 flex justify-between items-center">
              <div className="flex items-center gap-2">
                <span className="text-[13px] font-bold text-gray-900 flex items-center gap-1.5">
                  <Languages className="h-4 w-4 text-indigo-600" />
                  Your text in {selectedLanguage.name}
                </span>
              </div>
              <div className="flex items-center gap-3">
                {inputText && (
                  <button 
                    onClick={handleClearText}
                    className="text-gray-400 hover:text-gray-900 text-[12.5px] font-medium transition-colors"
                    title="Clear input text and all outputs"
                    id="clear-input-button"
                  >
                    Clear
                  </button>
                )}
                <span className={`text-[11px] font-bold select-none px-3 py-1 rounded-full ${currentLen > maxCharacters * 0.85 ? "bg-indigo-50 text-indigo-600" : "bg-gray-100 text-gray-500"}`}>
                  {currentLen} / {maxCharacters}
                </span>
              </div>
            </div>

            {/* Input Area */}
            <div className="relative flex-1 flex flex-col">
              <textarea
                className="w-full flex-1 p-5 text-sm md:text-[15px] leading-relaxed text-gray-700 placeholder-gray-400 focus:outline-none resize-none min-h-[180px] bg-white border-0 focus:ring-0"
                placeholder={selectedLanguage.placeholder}
                value={inputText}
                onChange={handleTextChange}
                maxLength={maxCharacters}
                id="input-text-area"
              />

              {/* Inject interactive helper sample sentence examples chips if input text is empty */}
              {inputText.length === 0 && (
                <div className="absolute inset-x-0 bottom-0 p-5 bg-linear-to-t from-white via-white/95 to-transparent pt-12">
                  <span className="text-[12px] font-medium text-gray-400 block mb-2.5 px-1">
                    Try one of these example texts:
                  </span>
                  <div className="flex flex-wrap gap-2">
                    {selectedLanguage.examples.map((ex, index) => (
                      <button
                        key={index}
                        onClick={() => handleInjectExample(ex.text)}
                        className="text-xs bg-gray-100 hover:bg-indigo-50 text-gray-700 hover:text-indigo-600 font-medium px-3.5 py-2 rounded-ctrl transition duration-150 text-left max-w-sm truncate cursor-pointer"
                        title={ex.text}
                        id={`example-chip-${index}`}
                      >
                        <span className="block text-[10px] font-semibold text-gray-400">{ex.title}</span>
                        <span className="font-normal text-gray-600 text-xs block truncate mt-0.5">{ex.text}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Lower execution menu triggers */}
            <div className="p-4 border-t border-gray-100 flex items-center justify-between gap-4">
              <div className="flex gap-2">
                {inputText && (
                  <button
                    onClick={() => handleReadAloud(inputText)}
                    className="w-10 h-10 flex items-center justify-center bg-white rounded-ctrl shadow-card hover:shadow-hover text-gray-500 hover:text-indigo-600 transition cursor-pointer"
                    title="Read original text aloud"
                    id="tts-original"
                  >
                    <Volume2 className="h-4 w-4" />
                  </button>
                )}
              </div>

              <div className="flex gap-3 items-center">
                <button
                  onClick={handleTriggerCorrectAndRephrase}
                  disabled={loading || !inputText.trim()}
                  className={`flex items-center gap-2 px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-full shadow-pop transition disabled:opacity-50 disabled:cursor-not-allowed text-[13px] cursor-pointer`}
                  id="action-trigger-button"
                >
                  {loading ? (
                    <>
                      <RefreshCw className="h-4 w-4 animate-spin text-white" />
                      <span>Optimizing grammar...</span>
                    </>
                  ) : (
                    <>
                      {activeTab === "check" ? (
                        <>
                          <Check className="h-4 w-4" />
                          <span>Check accuracy</span>
                        </>
                      ) : (
                        <>
                          <Sparkles className="h-4 w-4" />
                          <span>Generate rephrases</span>
                        </>
                      )}
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>

          {/* Feedback Section (Results Panel) */}
          <div className="space-y-4">
            
            {/* If error occurs, render it nicely */}
            {errorMsg && (
              <div className="p-4 bg-white rounded-card shadow-card flex items-start gap-3">
                <div className="w-9 h-9 rounded-ctrl bg-gray-100 flex items-center justify-center shrink-0">
                  <AlertCircle className="h-5 w-5 text-gray-500" />
                </div>
                <div>
                  <h4 className="text-[14px] font-bold text-gray-900">Something went wrong</h4>
                  <p className="text-[12.5px] text-gray-500 leading-relaxed mt-0.5">{errorMsg}</p>
                </div>
              </div>
            )}

            {/* TAB CONTENT 1: ACCURACY CHECK DATA */}
            {activeTab === "check" && (
              <AnimatePresence>
                {checkResult && (
                  <motion.div
                    initial={{ opacity: 0, y: 15 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    className="grid grid-cols-1 md:grid-cols-3 gap-4"
                    id="grammar-analysis-panel"
                  >
                    
                    {/* Left & Middle Column: Diff and Detailed list */}
                    <div className="md:col-span-2 space-y-4">
                      
                      {/* Interactive Diff Display Card */}
                      <div className="space-y-2.5">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-[14px] font-bold text-gray-900">
                            Result and corrections
                          </span>
                          <span className="text-[11px] text-indigo-600 font-bold bg-indigo-50 px-3 py-1 rounded-full select-none">
                            Hover corrections to learn why
                          </span>
                        </div>
                        
                        <DiffHighlight 
                          segments={checkResult.segments} 
                          language={selectedLanguage.name} 
                        />
                      </div>

                      {/* Side Actions on Result text */}
                      <div className="flex flex-wrap gap-2 items-center justify-between bg-white px-4 py-3 rounded-card shadow-card">
                        <span className="text-[12.5px] text-gray-500 flex items-center gap-1.5 font-semibold">
                          <Check className="h-4 w-4 text-indigo-600" />
                          Checked for fluency in {selectedLanguage.name}
                        </span>

                        <div className="flex gap-2">
                          <button
                            onClick={() => handleCopyText(checkResult.correctedText, "corrected")}
                            className="text-[12.5px] flex items-center gap-1.5 px-3.5 py-2 rounded-full bg-white shadow-card hover:shadow-hover text-gray-700 hover:text-indigo-600 font-semibold transition"
                            title="Copy the corrected sentence"
                            id="copy-corrected-button"
                          >
                            {copiedText === "corrected" ? (
                              <>
                                <Check className="h-3.5 w-3.5 text-indigo-600" />
                                <span className="text-indigo-600">Copied!</span>
                              </>
                            ) : (
                              <>
                                <Clipboard className="h-3.5 w-3.5" />
                                <span>Copy text</span>
                              </>
                            )}
                          </button>

                          <button
                            onClick={() => handleReadAloud(checkResult.correctedText)}
                            className="text-[12.5px] flex items-center gap-1.5 px-3.5 py-2 rounded-full bg-white shadow-card hover:shadow-hover text-gray-700 hover:text-indigo-600 font-semibold transition"
                            id="tts-corrected"
                          >
                            <Volume2 className="h-3.5 w-3.5" />
                            <span>Listen</span>
                          </button>
                        </div>
                      </div>

                      {/* Explanations List in detail */}
                      <div className="bg-white rounded-card shadow-card p-5 space-y-4">
                        <h3 className="text-[14px] font-bold text-gray-900 flex items-center gap-2">
                          <Info className="h-4 w-4 text-indigo-600" />
                          Correction explanations
                        </h3>
                        
                        {(!checkResult.explanations || checkResult.explanations.length === 0) ? (
                          <div className="flex items-center gap-3 bg-indigo-50 p-4 rounded-ctrl text-indigo-700 text-[12.5px]">
                            <span className="text-base select-none">🎉</span>
                            <div>
                              <span className="font-bold">No errors detected.</span> Your phrasing flows perfectly.
                            </div>
                          </div>
                        ) : (
                          <div className="divide-y divide-gray-100">
                            {checkResult.explanations.map((exp, i) => (
                              <div key={i} className="py-3.5 first:pt-0 last:pb-0 flex flex-col md:flex-row gap-2.5 justify-between">
                                <div className="space-y-1">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <span className="font-semibold text-[12px] text-gray-500 line-through bg-gray-100 px-2 py-0.5 rounded-md">
                                      {exp.original}
                                    </span>
                                    <ArrowRight className="h-3.5 w-3.5 text-gray-400" />
                                    <span className="font-semibold text-[12px] text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-md">
                                      {exp.corrected}
                                    </span>
                                    <span className="text-[11px] font-bold px-3 py-0.5 rounded-full bg-indigo-50 text-indigo-600">
                                      {exp.category}
                                    </span>
                                  </div>
                                  <p className="text-[12.5px] text-gray-500 mt-1 pl-1 leading-relaxed">
                                    {exp.explanation}
                                  </p>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                    </div>

                    {/* Right column: Dynamic Score Meter */}
                    <div className="md:col-span-1 space-y-4">
                      
                      {/* Premium circular rating */}
                      <div className="bg-white rounded-card shadow-card p-6 flex flex-col items-center justify-center text-center">
                        <span className="text-[12.5px] font-medium text-gray-400 block mb-4">
                          Linguistic quality score
                        </span>

                        <div className="relative w-28 h-28 flex items-center justify-center">
                          <svg className="w-full h-full transform -rotate-90">
                            <circle
                              cx="56"
                              cy="56"
                              r="48"
                              className="stroke-gray-100"
                              strokeWidth="9"
                              fill="transparent"
                            />
                            <circle
                              cx="56"
                              cy="56"
                              r="48"
                              className="stroke-indigo-600 transition-all duration-1000"
                              strokeWidth="9"
                              fill="transparent"
                              strokeDasharray={2 * Math.PI * 48}
                              strokeDashoffset={2 * Math.PI * 48 * (1 - checkResult.score / 100)}
                              strokeLinecap="round"
                            />
                          </svg>

                          <div className="absolute inset-0 flex flex-col items-center justify-center">
                            <span className="text-[27px] font-bold text-gray-900 tracking-[-1px] leading-none">
                              {checkResult.score}
                            </span>
                            <span className="text-[11px] text-gray-400 font-bold mt-0.5">/ 100</span>
                          </div>
                        </div>

                        <div className="mt-4">
                          <h4 className="text-[13px] font-bold text-gray-900">
                            {checkResult.score >= 90 ? "Excellent mastery" :
                             checkResult.score >= 75 ? "Good phrasing, minor fixes" :
                             "Needs structural corrections"}
                          </h4>
                          <p className="text-gray-500 text-[12px] leading-relaxed mt-1">
                            {checkResult.score >= 90 ? "Your text contains almost flawless morphology and syntax." :
                             checkResult.score >= 75 ? "Some syntax, preposition or spelling issues were optimized." :
                             "Consider reviewing word endings, subject–verb alignment, and punctuation."}
                          </p>
                        </div>
                      </div>

                      {/* Linguistic Quick Tips block info */}
                      <div className="bg-white rounded-card shadow-card p-5">
                        <div className="w-9 h-9 rounded-ctrl bg-indigo-50 flex items-center justify-center mb-3">
                          <HelpCircle className="h-4.5 w-4.5 text-indigo-600" />
                        </div>
                        <h4 className="text-[14px] font-bold text-gray-900">Proofreading tips</h4>
                        <p className="text-[12px] text-gray-500 leading-relaxed mt-1.5">
                          Prefer active voice over passive, double-check prepositions, and align verb tenses to sound native.
                        </p>
                        <div className="border-t border-gray-100 mt-3.5 pt-3.5 flex items-center justify-between text-[11px] text-gray-400">
                          <span>Verification engine</span>
                          <span className="text-indigo-600 select-none font-bold">{MODEL_NAME}</span>
                        </div>
                      </div>

                    </div>

                  </motion.div>
                )}
              </AnimatePresence>
            )}

            {/* TAB CONTENT 2: MULTI REPHRASING ALTERNATIVES */}
            {activeTab === "rephrase" && (
              <AnimatePresence>
                {rephraseResult && (
                  <motion.div
                    initial={{ opacity: 0, y: 15 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    className="space-y-4"
                    id="rephrase-alternatives-panel"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[14px] font-bold text-gray-900 flex items-center gap-1.5">
                        <Sparkles className="h-4 w-4 text-indigo-600" />
                        Stylistic variations ({rephraseResult.length})
                      </span>
                      <span className="text-[11px] text-gray-500 bg-gray-100 px-3 py-1 rounded-full select-none">
                        Tuned for tone, brevity and engagement
                      </span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {rephraseResult.map((alt, index) => (
                        <div
                          key={index}
                          className={`bg-white rounded-card p-5 transition duration-200 relative group flex flex-col justify-between ${
                            index === 0
                              ? "shadow-hover ring-2 ring-indigo-100"
                              : "shadow-card hover:shadow-hover"
                          }`}
                          id={`rephrase-card-${index}`}
                        >
                          <div>
                            <div className="flex items-center justify-between gap-2 mb-3.5 flex-wrap">
                              <span className="text-[11px] font-bold px-3 py-0.5 rounded-full bg-gray-100 text-gray-500">
                                {alt.tone}
                              </span>

                              {index === 0 && (
                                <span className="text-[11px] font-bold text-indigo-600 bg-indigo-50 px-3 py-0.5 rounded-full">
                                  Recommended
                                </span>
                              )}

                              {alt.changesOverview && (
                                <span className="text-[11px] text-gray-400 italic">
                                  {alt.changesOverview}
                                </span>
                              )}
                            </div>

                            <p className="text-gray-900 text-sm md:text-[15px] font-medium leading-relaxed mb-4 whitespace-pre-line selection:bg-indigo-100 select-all">
                              {alt.text}
                            </p>
                          </div>

                          <div className="border-t border-gray-100 pt-3 flex items-center justify-between gap-4">
                            <span className="text-[11px] text-gray-500 leading-snug max-w-[70%]">
                              {alt.description}
                            </span>

                            <div className="flex gap-1.5">
                              <button
                                onClick={() => handleCopyText(alt.text, `card-${index}`)}
                                className="w-9 h-9 flex items-center justify-center rounded-ctrl bg-white shadow-card hover:shadow-hover text-gray-500 hover:text-indigo-600 transition"
                                title="Copy alternative text"
                                id={`copy-rephrase-btn-${index}`}
                              >
                                {copiedText === `card-${index}` ? (
                                  <Check className="h-3.5 w-3.5 text-indigo-600" />
                                ) : (
                                  <Clipboard className="h-3.5 w-3.5" />
                                )}
                              </button>

                              <button
                                onClick={() => handleReadAloud(alt.text)}
                                className="w-9 h-9 flex items-center justify-center rounded-ctrl bg-white shadow-card hover:shadow-hover text-gray-500 hover:text-indigo-600 transition"
                                title="Listen to text"
                                id={`play-rephrase-btn-${index}`}
                              >
                                <Volume2 className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            )}

            {/* Empty stats display / default prompt message before checks or rephrases */}
            {!checkResult && !rephraseResult && !errorMsg && !loading && (
              <div className="bg-white rounded-card p-12 text-center text-gray-500 max-w-lg mx-auto flex flex-col items-center justify-center gap-3 shadow-card mt-2">
                <div className="w-12 h-12 rounded-ctrl bg-indigo-50 flex items-center justify-center mb-1">
                  <Sparkles className="h-6 w-6 text-indigo-600" />
                </div>
                <h3 className="text-[15px] font-bold text-gray-900 tracking-tight">Write or pick an example</h3>
                <p className="text-[12.5px] text-gray-500 max-w-[280px] leading-relaxed">
                  Enter text in the editor, choose your target language, then run a grammar check or generate rephrase options.
                </p>
              </div>
            )}

          </div>

        </div>

        {/* Dynamic Sidebar Right: Collection History */}
        <div className="space-y-4">
          <SavedCollection
            items={historyItems}
            onApplyItem={handleApplyHistoryItem}
            onDeleteItem={handleDeleteHistoryItem}
            onClearAll={handleClearHistory}
          />

          {/* Quick analysis stats card */}
          <div className="bg-white rounded-card p-5 shadow-card">
            <h3 className="text-[14px] font-bold text-gray-900 mb-4 flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-indigo-600" />
              Analytics
            </h3>
            
            <div className="space-y-0">
              <div className="flex justify-between items-center text-[13px] py-2.5 border-b border-gray-100">
                <span className="text-gray-500">Words count</span>
                <span className="font-bold text-gray-900 tabular-nums">
                  {inputText ? inputText.trim().split(/\s+/).filter(Boolean).length : 0}
                </span>
              </div>
              
              <div className="flex justify-between items-center text-[13px] py-2.5 border-b border-gray-100">
                <span className="text-gray-500">Sentences</span>
                <span className="font-bold text-gray-900 tabular-nums">
                  {inputText ? inputText.split(/[.!?]+/).filter((s) => s.trim().length > 0).length : 0}
                </span>
              </div>

              <div className="flex justify-between items-center text-[13px] py-2.5">
                <span className="text-gray-500">Reading time</span>
                <span className="font-bold text-gray-900 tabular-nums">
                  {Math.max(1, Math.round((inputText ? inputText.split(/\s+/).length : 0) / 200))} min
                </span>
              </div>
            </div>
          </div>
        </div>

      </main>

      {/* Footer component */}
      <footer className="mt-auto h-16 px-6 flex items-center justify-between text-gray-400 select-none">
        <div className="hidden sm:flex items-center gap-2">
          <span className="text-[11px] italic">Powered by love ❤️</span>
        </div>
      </footer>

    </div>
  );
}
