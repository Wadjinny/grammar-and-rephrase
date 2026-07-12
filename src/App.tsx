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
  Trash2, 
  Volume2, 
  Bookmark, 
  HelpCircle, 
  TrendingUp, 
  FileText, 
  MessageSquare, 
  AlertCircle,
  Settings,
  Info,
  Cpu
} from "lucide-react";
import { SUPPORTED_LANGUAGES } from "./languages";
import { 
  DiffSegment, 
  GrammarExplanation, 
  GrammarCheckResponse, 
  RephraseAlternative, 
  SavedItem, 
  Language 
} from "./types";
import DiffHighlight from "./components/DiffHighlight";
import SavedCollection from "./components/SavedCollection";
import { motion, AnimatePresence } from "motion/react";

export default function App() {
  const [inputText, setInputText] = useState<string>("");
  const [selectedLanguage, setSelectedLanguage] = useState<Language>(SUPPORTED_LANGUAGES[0]);
  const [isDropdownOpen, setIsDropdownOpen] = useState<boolean>(false);
  const [searchLangQuery, setSearchLangQuery] = useState<string>("");

  // Model Selection
  const [selectedModel, setSelectedModel] = useState<string>("gemini-3.5-flash");
  const [isModelDropdownOpen, setIsModelDropdownOpen] = useState<boolean>(false);

  const AVAILABLE_MODELS = [
    {
      id: "gemini-3.5-flash",
      name: "Gemini 3.5 Flash",
      description: "Standard model. Direct logic, balanced speed, fluent output.",
      badge: "Fast & Balanced",
      badgeColors: "bg-emerald-50 text-emerald-700 border border-emerald-200"
    },
    {
      id: "gemini-3.1-pro-preview",
      name: "Gemini 3.1 Pro",
      description: "Powerhouse model. Advanced linguistic reasoning & nuanced grammar.",
      badge: "Advanced Reasoning",
      badgeColors: "bg-purple-50 text-purple-700 border border-purple-200"
    },
    {
      id: "gemini-3.1-flash-lite",
      name: "Gemini 3.1 Flash Lite",
      description: "Lightweight model. Maximum efficiency & minimal latency.",
      badge: "Super Fast",
      badgeColors: "bg-amber-50 text-amber-700 border border-amber-200"
    }
  ];

  const getModelFriendlyName = (id: string) => {
    switch (id) {
      case "gemini-3.1-pro-preview":
        return "Gemini 3.1 Pro";
      case "gemini-3.1-flash-lite":
        return "Gemini 3.1 Flash Lite";
      default:
        return "Gemini 3.5 Flash";
    }
  };
  
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

  // Load history & Check API Key status
  useEffect(() => {
    // 1. Fetch saved collection
    try {
      const storedHistory = localStorage.getItem("gemini_linguistic_history");
      if (storedHistory) {
        setHistoryItems(JSON.parse(storedHistory));
      }
    } catch (e) {
      console.warn("Could not read localstorage history", e);
    }

    // 2. Query config API to check if API key is in environment variables safely
    fetch("/api/config")
      .then((res) => res.json())
      .then((data) => {
        setIsApiKeySet(data.configOk);
        if (!data.configOk) {
          setErrorMsg("Gemini API key is missing. Please populate GEMINI_API_KEY in the Secrets panel in AI Studio.");
        }
      })
      .catch((err) => {
        console.error("Config check failed", err);
        setIsApiKeySet(false);
      });
  }, []);

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
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: inputText,
          language: selectedLanguage.name,
          model: selectedModel
        })
      });
      const data = await response.json();
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
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: inputText,
          language: selectedLanguage.name,
          model: selectedModel
        })
      });
      const data = await response.json();
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
    <div className="flex flex-col min-h-screen bg-slate-50 font-sans antialiased text-slate-800" id="main-container">
      
      {/* 1. Header Navigation in Reverso Style */}
      <nav className="flex items-center justify-between px-6 py-4 bg-white border-b border-slate-200/80 shadow-sm sticky top-0 z-40 transition-all">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 bg-gradient-to-tr from-indigo-600 via-purple-500 to-pink-500 rounded-xl flex items-center justify-center shadow-md">
            <span className="text-white font-extrabold text-lg select-none">G</span>
          </div>
          <div>
            <h1 className="text-lg font-bold text-slate-900 tracking-tight leading-tight">
              Gemini<span className="font-semibold text-indigo-600">Rephrase</span>
            </h1>
            <p className="text-[10px] text-slate-400 font-medium">Linguistic Assistant</p>
          </div>
        </div>

        {/* Feature selection in navigation bar */}
        <div className="hidden md:flex items-center bg-slate-100 p-1 rounded-full border border-slate-200">
          <button
            onClick={() => { setActiveTab("check"); setErrorMsg(null); }}
            className={`px-5 py-1.5 rounded-full text-xs font-semibold tracking-wide transition-all ${
              activeTab === "check"
                ? "bg-white text-indigo-700 shadow-sm font-bold"
                : "text-slate-500 hover:text-slate-800"
            }`}
            id="nav-tab-check"
          >
            Grammar Checker
          </button>
          <button
            onClick={() => { setActiveTab("rephrase"); setErrorMsg(null); }}
            className={`px-5 py-1.5 rounded-full text-xs font-semibold tracking-wide transition-all ${
              activeTab === "rephrase"
                ? "bg-white text-indigo-700 shadow-sm font-bold"
                : "text-slate-500 hover:text-slate-800"
            }`}
            id="nav-tab-rephrase"
          >
            Multi-Rephraser
          </button>
        </div>

        {/* Live Language Selector Toggle Dropdown */}
        <div className="flex items-center gap-3">
          {/* Model Selector Dropdown */}
          <div className="relative">
            <button
              onClick={() => {
                setIsModelDropdownOpen(!isModelDropdownOpen);
                setIsDropdownOpen(false);
              }}
              className="flex items-center gap-2 px-3.5 py-1.5 border border-slate-200/90 rounded-xl bg-slate-50 hover:bg-slate-100 active:bg-slate-200 cursor-pointer transition text-xs font-semibold text-slate-800 shadow-sm"
              title="Select AI Model"
              id="model-select-button"
            >
              <Cpu className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
              <span>
                {selectedModel === "gemini-3.1-pro-preview" ? "Gemini 3.1 Pro" :
                 selectedModel === "gemini-3.1-flash-lite" ? "Gemini 3.1 Lite" :
                 "Gemini 3.5 Flash"}
              </span>
              <svg 
                className={`w-3.5 h-3.5 text-slate-400 ml-1 shrink-0 transition-transform ${isModelDropdownOpen ? "rotate-180" : ""}`} 
                fill="none" 
                stroke="currentColor" 
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M19 9l-7 7-7-7"></path>
              </svg>
            </button>

            {/* Dropdown Menu block */}
            <AnimatePresence>
              {isModelDropdownOpen && (
                <div 
                  className="absolute right-0 mt-2.5 w-72 bg-white border border-slate-200/95 rounded-2xl shadow-xl z-50 p-2 overflow-hidden"
                  id="model-dropdown-menu"
                >
                  <div className="px-3 py-1.5 border-b border-slate-100 mb-1.5 flex items-center justify-between">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Select AI Model</span>
                    <Sparkles className="h-3 w-3 text-indigo-500" />
                  </div>
                  <div className="space-y-1">
                    {AVAILABLE_MODELS.map((model) => (
                      <button
                        key={model.id}
                        onClick={() => {
                          setSelectedModel(model.id);
                          setIsModelDropdownOpen(false);
                        }}
                        className={`w-full text-left p-2.5 rounded-xl text-xs flex flex-col gap-1 transition duration-150 cursor-pointer ${
                          selectedModel === model.id
                            ? "bg-indigo-50 border border-indigo-100"
                            : "hover:bg-slate-50 border border-transparent"
                        }`}
                      >
                        <div className="flex items-center justify-between w-full">
                          <span className={`font-bold transition-colors ${selectedModel === model.id ? "text-indigo-700" : "text-slate-800"}`}>
                            {model.name}
                          </span>
                          <span className={`${model.badgeColors} text-[9px] font-bold px-1.5 py-0.5 rounded-md`}>
                            {model.badge}
                          </span>
                        </div>
                        <p className="text-[10px] text-slate-400 font-normal leading-normal">{model.description}</p>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </AnimatePresence>
          </div>

          <div className="relative">
            <button
              onClick={() => {
                setIsDropdownOpen(!isDropdownOpen);
                setIsModelDropdownOpen(false);
              }}
              className="flex items-center gap-2 px-3.5 py-1.5 border border-slate-200/90 rounded-xl bg-slate-50 hover:bg-slate-100 active:bg-slate-200 cursor-pointer transition text-xs font-semibold text-slate-800 shadow-sm max-w-44"
              title="Select Target Language"
              id="language-select-button"
            >
              <span className="text-base select-none shrink-0">{selectedLanguage.flag}</span>
              <span className="truncate">{selectedLanguage.name}</span>
              <svg 
                className={`w-3.5 h-3.5 text-slate-400 ml-1 shrink-0 transition-transform ${isDropdownOpen ? "rotate-180" : ""}`} 
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
                  className="absolute right-0 mt-2.5 w-64 bg-white border border-slate-200/95 rounded-2xl shadow-xl z-50 p-2 overflow-hidden"
                  id="language-dropdown-menu"
                >
                  <div className="p-1 border-b border-slate-100 mb-1.5">
                    <input
                      type="text"
                      className="w-full text-xs px-2.5 py-1.5 rounded-lg bg-slate-50 border border-slate-200 outline-none focus:border-indigo-400 text-slate-800 transition"
                      placeholder="Search language..."
                      value={searchLangQuery}
                      onChange={(e) => setSearchLangQuery(e.target.value)}
                      onClick={(e) => e.stopPropagation()}
                      autoFocus
                    />
                  </div>
                  <div className="max-h-60 overflow-y-auto space-y-0.5">
                    {filteredLanguages.length === 0 ? (
                      <div className="text-[11px] text-gray-400 text-center py-4">No matching language found</div>
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
                          className={`w-full text-left px-3 py-2 rounded-xl text-xs font-semibold flex items-center justify-between transition-colors ${
                            selectedLanguage.code === lang.code
                              ? "bg-indigo-50 text-indigo-700"
                              : "text-slate-700 hover:bg-slate-50"
                          }`}
                        >
                          <span className="flex items-center gap-2">
                            <span className="text-sm select-none">{lang.flag}</span>
                            <span>{lang.name}</span>
                          </span>
                          <span className="text-[10px] text-slate-400 font-normal italic">
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
          
          <div className="w-8 h-8 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-400 font-mono text-[10px] select-none" title="Premium AI User">
            PAI
          </div>
        </div>
      </nav>

      {/* API Key Missing Instruction banner */}
      {isApiKeySet === false && (
        <div className="mx-6 mt-4 bg-amber-50 border border-amber-200 rounded-xl p-3.5 flex items-start gap-3 shadow-sm">
          <AlertCircle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
          <div className="text-xs text-amber-800">
            <span className="font-bold">Missing Gemini API Key:</span> All AI actions might fail. Please ensure your 
            <code className="bg-amber-100 text-amber-900 px-1 py-0.5 rounded mx-1 font-mono">GEMINI_API_KEY</code> 
            secret is properly populated using the developer tab panel credentials of AI Studio.
          </div>
        </div>
      )}

      {/* Main Container Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 grid grid-cols-1 lg:grid-cols-4 gap-6 overflow-hidden">
        
        {/* Left Side: Layout for input pane & output workspace */}
        <div className="lg:col-span-3 flex flex-col gap-6">

          {/* Quick toggle feature tab bar for mobile view only */}
          <div className="flex md:hidden items-center bg-slate-200/50 p-1 rounded-xl w-full border border-slate-200 mb-1">
            <button
              onClick={() => { setActiveTab("check"); setErrorMsg(null); }}
              className={`flex-1 text-center py-2 rounded-lg text-xs font-semibold transition-all ${
                activeTab === "check" ? "bg-white text-indigo-700 shadow-sm" : "text-slate-500"
              }`}
            >
              Checker
            </button>
            <button
              onClick={() => { setActiveTab("rephrase"); setErrorMsg(null); }}
              className={`flex-1 text-center py-2 rounded-lg text-xs font-semibold transition-all ${
                activeTab === "rephrase" ? "bg-white text-indigo-700 shadow-sm" : "text-slate-500"
              }`}
            >
              Rephraser
            </button>
          </div>

          {/* The Workspace card with input text box split with original state */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm flex flex-col overflow-hidden relative min-h-[320px]">
            {/* Input Header & Controls */}
            <div className="px-5 py-3 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                  <Languages className="h-3.5 w-3.5 text-indigo-500" />
                  Your text in {selectedLanguage.name}
                </span>
              </div>
              <div className="flex items-center gap-3">
                {inputText && (
                  <button 
                    onClick={handleClearText}
                    className="text-slate-400 hover:text-slate-700 text-xs flex items-center gap-0.5 hover:underline"
                    title="Clear input text and all outputs"
                    id="clear-input-button"
                  >
                    Clear
                  </button>
                )}
                <span className={`text-xs font-mono select-none px-2 py-0.5 rounded ${currentLen > maxCharacters * 0.85 ? "bg-rose-50 text-rose-600 font-bold" : "text-slate-400"}`}>
                  {currentLen} / {maxCharacters}
                </span>
              </div>
            </div>

            {/* Input Area */}
            <div className="relative flex-1 flex flex-col">
              <textarea
                className="w-full flex-1 p-5 text-sm md:text-base leading-relaxed text-slate-700 placeholder-slate-400/80 focus:outline-none resize-none min-h-[180px] bg-white border-0 focus:ring-0 focus:border-0"
                placeholder={selectedLanguage.placeholder}
                value={inputText}
                onChange={handleTextChange}
                maxLength={maxCharacters}
                id="input-text-area"
              />

              {/* Inject interactive helper sample sentence examples chips if input text is empty */}
              {inputText.length === 0 && (
                <div className="absolute inset-x-0 bottom-0 p-5 bg-gradient-to-t from-white via-white/95 to-transparent pt-12">
                  <span className="text-[11px] font-bold text-slate-400 uppercase tracking-widest block mb-2 px-1">
                    Try translating some buggy example texts:
                  </span>
                  <div className="flex flex-wrap gap-2">
                    {selectedLanguage.examples.map((ex, index) => (
                      <button
                        key={index}
                        onClick={() => handleInjectExample(ex.text)}
                        className="text-xs bg-slate-50 hover:bg-indigo-50 hover:border-indigo-200 border border-slate-200 text-slate-700 hover:text-indigo-700 font-medium px-3.5 py-2 rounded-xl transition duration-150 text-left max-w-sm truncate shadow-xs cursor-pointer"
                        title={ex.text}
                        id={`example-chip-${index}`}
                      >
                        <span className="block text-[9px] font-semibold text-slate-400 uppercase tracking-tight">{ex.title}</span>
                        <span className="font-normal text-slate-600 text-xs block truncate mt-0.5">{ex.text}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Lower execution menu triggers */}
            <div className="p-4 bg-slate-50/40 border-t border-slate-100 flex items-center justify-between gap-4">
              <div className="flex gap-2">
                {inputText && (
                  <button
                    onClick={() => handleReadAloud(inputText)}
                    className="p-2 border border-slate-200/80 bg-white rounded-xl hover:bg-slate-50 text-slate-500 hover:text-indigo-600 transition shadow-sm cursor-pointer"
                    title="Original text read aloud TTS"
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
                  className={`flex items-center gap-2 px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-xl shadow-md transition disabled:opacity-50 disabled:cursor-not-allowed text-xs tracking-wider cursor-pointer`}
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
                          <Check className="h-4.5 w-4.5" />
                          <span>CHECK ACCURACY</span>
                        </>
                      ) : (
                        <>
                          <Sparkles className="h-4 w-4" />
                          <span>GENERATE REPHRASES</span>
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
              <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl flex items-start gap-3 shadow-xs">
                <AlertCircle className="h-5 w-5 text-rose-500 shrink-0 mt-0.5" />
                <div>
                  <h4 className="text-sm font-bold text-rose-800">Operational Failure</h4>
                  <p className="text-xs text-rose-700 leading-relaxed mt-1">{errorMsg}</p>
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
                    className="grid grid-cols-1 md:grid-cols-3 gap-6"
                    id="grammar-analysis-panel"
                  >
                    
                    {/* Left & Middle Column: Diff and Detailed list */}
                    <div className="md:col-span-2 space-y-4">
                      
                      {/* Interactive Diff Display Card */}
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-slate-500 uppercase tracking-widest flex items-center gap-1">
                            <span className="inline-block w-2 h-2 rounded-full bg-emerald-500"></span>
                            Result and Corrections Overview
                          </span>
                          <span className="text-[10px] text-indigo-600 font-semibold bg-indigo-50 border border-indigo-100 px-2 py-0.5 rounded-full select-none">
                            Hover over corrections to learn why
                          </span>
                        </div>
                        
                        <DiffHighlight 
                          segments={checkResult.segments} 
                          language={selectedLanguage.name} 
                        />
                      </div>

                      {/* Side Actions on Result text */}
                      <div className="flex flex-wrap gap-2 items-center justify-between bg-white px-4 py-3 border border-slate-100 rounded-xl shadow-xs">
                        <span className="text-xs text-slate-500 flex items-center gap-1 font-semibold">
                          <Check className="h-3.5 w-3.5 text-emerald-500" />
                          Double checked fluency in {selectedLanguage.name}
                        </span>

                        <div className="flex gap-2">
                          <button
                            onClick={() => handleCopyText(checkResult.correctedText, "corrected")}
                            className="text-xs flex items-center gap-1.5 px-3 py-1.5 border border-slate-200 hover:border-indigo-300 hover:text-indigo-600 rounded-lg bg-slate-50 hover:bg-slate-100/50 font-semibold transition"
                            title="Copy the corrected sentence"
                            id="copy-corrected-button"
                          >
                            {copiedText === "corrected" ? (
                              <>
                                <Check className="h-3 w-3 text-emerald-500" />
                                <span className="text-emerald-600 font-black">Copied!</span>
                              </>
                            ) : (
                              <>
                                <Clipboard className="h-3 w-3" />
                                <span>Copy Text</span>
                              </>
                            )}
                          </button>

                          <button
                            onClick={() => handleReadAloud(checkResult.correctedText)}
                            className="text-xs flex items-center gap-1 px-3 py-1.5 border border-slate-200 hover:bg-slate-50 rounded-lg text-slate-600 transition"
                            id="tts-corrected"
                          >
                            <Volume2 className="h-3.5 w-3.5" />
                            <span>Listen</span>
                          </button>
                        </div>
                      </div>

                      {/* Explanations List in detail */}
                      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 space-y-4">
                        <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2">
                          <Info className="h-4 w-4 text-indigo-500" />
                          Categorized Correction Explanations
                        </h3>
                        
                        {(!checkResult.explanations || checkResult.explanations.length === 0) ? (
                          <div className="flex items-center gap-3 bg-emerald-50/50 border border-emerald-200 p-4 rounded-xl text-emerald-800 text-xs">
                            <span className="text-base select-none">🎉</span>
                            <div>
                              <span className="font-bold">No errors detected.</span> Your phrasing flows perfectly according to professional grammar standouts!
                            </div>
                          </div>
                        ) : (
                          <div className="divide-y divide-slate-100">
                            {checkResult.explanations.map((exp, i) => (
                              <div key={i} className="py-3.5 first:pt-0 last:pb-0 flex flex-col md:flex-row gap-2.5 justify-between">
                                <div className="space-y-1">
                                  <div className="flex items-center gap-2">
                                    <span className="font-bold text-xs text-rose-500 line-through bg-rose-50 px-1.5 py-0.5 rounded">
                                      {exp.original}
                                    </span>
                                    <ArrowRight className="h-3.5 w-3.5 text-slate-400" />
                                    <span className="font-bold text-xs text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded">
                                      {exp.corrected}
                                    </span>
                                    <span className={`text-[9px] font-bold tracking-wider px-2 py-0.5 rounded-full ${
                                      exp.category === "Spelling" ? "bg-amber-100 text-amber-700" :
                                      exp.category === "Grammar" ? "bg-indigo-100 text-indigo-700" :
                                      exp.category === "Punctuation" ? "bg-slate-100 text-slate-700" :
                                      exp.category === "Style" ? "bg-purple-100 text-purple-700" :
                                      "bg-teal-100 text-teal-700"
                                    }`}>
                                      {exp.category}
                                    </span>
                                  </div>
                                  <p className="text-xs text-slate-600 mt-1 pl-1 leading-relaxed">
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
                      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 flex flex-col items-center justify-center text-center">
                        <span className="text-xs font-bold text-slate-400 uppercase tracking-widest block mb-4">
                          Linguistic Quality Score
                        </span>

                        <div className="relative w-28 h-28 flex items-center justify-center">
                          <svg className="w-full h-full transform -rotate-90">
                            <circle
                              cx="56"
                              cy="56"
                              r="48"
                              className="stroke-slate-100"
                              strokeWidth="9"
                              fill="transparent"
                            />
                            <circle
                              cx="56"
                              cy="56"
                              r="48"
                              className={`transition-all duration-1000 ${
                                checkResult.score >= 85 ? "stroke-emerald-500" :
                                checkResult.score >= 60 ? "stroke-amber-500" :
                                "stroke-rose-500"
                              }`}
                              strokeWidth="9"
                              fill="transparent"
                              strokeDasharray={2 * Math.PI * 48}
                              strokeDashoffset={2 * Math.PI * 48 * (1 - checkResult.score / 100)}
                              strokeLinecap="round"
                            />
                          </svg>

                          <div className="absolute inset-0 flex flex-col items-center justify-center">
                            <span className="text-3xl font-black text-slate-800 tracking-tight">
                              {checkResult.score}
                            </span>
                            <span className="text-[10px] text-slate-400 font-bold">/ 100</span>
                          </div>
                        </div>

                        <div className="mt-4">
                          <h4 className="text-xs font-bold text-slate-800">
                            {checkResult.score >= 90 ? "Excellent Mastery!" :
                             checkResult.score >= 75 ? "Good Phrasing, minors found" :
                             "Needs structural corrections"}
                          </h4>
                          <p className="text-slate-500 text-[11px] leading-relaxed mt-1">
                            {checkResult.score >= 90 ? "Your text contains almost flawless morphology and syntactic choice." :
                             checkResult.score >= 75 ? "Some errors in syntax, prepositions or spellings were optimized successfully." :
                             "Consider reviewing critical word endings, subject verbs alignments, and punctuation rules."}
                          </p>
                        </div>
                      </div>

                      {/* Linguistic Quick Tips block info */}
                      <div className="bg-gradient-to-br from-indigo-950 to-slate-900 rounded-2xl p-5 text-white shadow-md relative overflow-hidden">
                        <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/10 rounded-full blur-2xl -translate-y-8 translate-x-8"></div>
                        <HelpCircle className="h-5 w-5 text-indigo-400 mb-3" />
                        <h4 className="text-xs font-extrabold uppercase tracking-widest text-indigo-300">Proofreading Tips</h4>
                        <p className="text-[11px] text-slate-300 leading-relaxed mt-2">
                          Use simple active voice over passive formations, check local prepositions, and look closely at verb tense alignments to sound completely native.
                        </p>
                        <div className="border-t border-indigo-800/80 mt-3 pt-3 flex items-center justify-between text-[10px] text-slate-400">
                          <span>Verification Engine</span>
                          <span className="text-indigo-400 select-none font-bold">{getModelFriendlyName(selectedModel)}</span>
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
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-500 uppercase tracking-widest flex items-center gap-1.5">
                        <Sparkles className="h-3.5 w-3.5 text-teal-500 animate-pulse" />
                        Multilingual Stylistic Variations ({rephraseResult.length})
                      </span>
                      <span className="text-[10px] text-teal-600 bg-teal-50 border border-teal-100 px-2 py-0.5 rounded-full select-none">
                        Correct for Tone, Brevity, and Engagement
                      </span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {rephraseResult.map((alt, index) => (
                        <div
                          key={index}
                          className={`bg-white rounded-2xl border p-5 shadow-xs transition duration-250 relative group flex flex-col justify-between hover:shadow-md ${
                            index === 0
                              ? "border-indigo-400/80 shadow-md ring-2 ring-indigo-50"
                              : "border-slate-200/90 hover:border-teal-300"
                          }`}
                          id={`rephrase-card-${index}`}
                        >
                          <div>
                            <div className="flex items-center justify-between gap-2 mb-3.5">
                              <span className={`text-[10px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded ${
                                alt.tone.includes("Formal") ? "bg-slate-100 text-slate-700" :
                                alt.tone.includes("Casual") ? "bg-amber-50 text-amber-700" :
                                alt.tone.includes("Concise") ? "bg-emerald-50 text-emerald-700" :
                                alt.tone.includes("Creative") ? "bg-purple-50 text-purple-700" :
                                "bg-indigo-50 text-indigo-700"
                              }`}>
                                {alt.tone}
                              </span>

                              {index === 0 && (
                                <span className="text-[9px] font-bold text-indigo-600 bg-indigo-50 px-2.5 py-0.5 rounded uppercase tracking-widest">
                                  Recommended
                                </span>
                              )}

                              {alt.changesOverview && (
                                <span className="text-[10px] text-slate-400 font-mono italic">
                                  {alt.changesOverview}
                                </span>
                              )}
                            </div>

                            <p className="text-slate-800 text-sm md:text-base font-medium leading-relaxed mb-4 whitespace-pre-line selection:bg-teal-100 select-all">
                              {alt.text}
                            </p>
                          </div>

                          <div className="border-t border-slate-100 pt-3 flex items-center justify-between gap-4">
                            <span className="text-[10px] text-slate-500 leading-snug max-w-[70%]">
                              {alt.description}
                            </span>

                            <div className="flex gap-1.5">
                              <button
                                onClick={() => handleCopyText(alt.text, `card-${index}`)}
                                className="p-2 border border-slate-200 hover:border-indigo-300 text-slate-500 hover:text-indigo-600 bg-slate-50/50 hover:bg-white rounded-xl transition shadow-xs"
                                title="Copy alternative text"
                                id={`copy-rephrase-btn-${index}`}
                              >
                                {copiedText === `card-${index}` ? (
                                  <Check className="h-3.5 w-3.5 text-emerald-500" />
                                ) : (
                                  <Clipboard className="h-3.5 w-3.5" />
                                )}
                              </button>

                              <button
                                onClick={() => handleReadAloud(alt.text)}
                                className="p-2 border border-slate-200 text-slate-500 hover:text-indigo-600 bg-slate-50/50 hover:bg-white rounded-xl transition shadow-xs"
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
              <div className="bg-white border border-slate-200/80 rounded-2xl p-12 text-center text-slate-500 max-w-lg mx-auto flex flex-col items-center justify-center gap-3 shadow-xs mt-6">
                <div className="w-12 h-12 rounded-full bg-indigo-50 flex items-center justify-center mb-1">
                  <Sparkles className="h-6 w-6 text-indigo-500" />
                </div>
                <h3 className="text-sm font-extrabold text-slate-900 tracking-tight">Write or select a language demo</h3>
                <p className="text-xs text-slate-500 max-w-[280px] leading-relaxed">
                  Enter any text on the editor, customize your target language dropdown and choose either Grammar check accuracy or Multiple rephrase options.
                </p>
              </div>
            )}

          </div>

        </div>

        {/* Dynamic Sidebar Right: Collection History */}
        <div className="lg:col-span-1 space-y-4">
          <SavedCollection
            items={historyItems}
            onApplyItem={handleApplyHistoryItem}
            onDeleteItem={handleDeleteHistoryItem}
            onClearAll={handleClearHistory}
          />

          {/* Quick analysis stats card */}
          <div className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-xs">
            <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3 flex items-center gap-1.5">
              <TrendingUp className="h-3.5 w-3.5 text-slate-500" />
              Interactive Analytics
            </h3>
            
            <div className="space-y-2.5">
              <div className="flex justify-between items-center text-xs pb-2 border-b border-slate-100">
                <span className="text-slate-500">Words count</span>
                <span className="font-bold text-slate-800 font-mono">
                  {inputText ? inputText.trim().split(/\s+/).filter(Boolean).length : 0}
                </span>
              </div>
              
              <div className="flex justify-between items-center text-xs pb-2 border-b border-slate-100">
                <span className="text-slate-500">Sentences</span>
                <span className="font-bold text-slate-800 font-mono">
                  {inputText ? inputText.split(/[.!?]+/).filter((s) => s.trim().length > 0).length : 0}
                </span>
              </div>

              <div className="flex justify-between items-center text-xs">
                <span className="text-slate-500">Estimate reading time</span>
                <span className="font-bold text-slate-800 font-mono">
                  {Math.max(1, Math.round((inputText ? inputText.split(/\s+/).length : 0) / 200))} min(s)
                </span>
              </div>
            </div>
          </div>
        </div>

      </main>

      {/* Footer component */}
      <footer className="mt-auto h-16 bg-white border-t border-slate-200/75 px-6 flex items-center justify-between text-slate-400 select-none">
        <div className="flex gap-6 items-center text-xs font-semibold text-slate-400">
          <div className="flex items-center gap-1.5 cursor-pointer hover:text-indigo-600 transition">
            <span className="text-base">💎</span>
            <span>Premium Account</span>
          </div>
          <div className="flex items-center gap-1 cursor-pointer hover:text-indigo-600 transition">
            <span>Diff Mode Active</span>
          </div>
        </div>

        <div className="hidden sm:flex items-center gap-2">
          <span className="text-[11px] italic">Powered by {getModelFriendlyName(selectedModel)}</span>
          <div className="flex -space-x-1">
            <div className="w-5 h-5 rounded-full bg-indigo-500 border-2 border-white shadow-sm" />
            <div className="w-5 h-5 rounded-full bg-purple-500 border-2 border-white shadow-sm" />
            <div className="w-5 h-5 rounded-full bg-pink-500 border-2 border-white shadow-sm" />
          </div>
        </div>
      </footer>

    </div>
  );
}
