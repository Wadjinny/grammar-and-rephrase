import { useEffect, useRef } from "react";
import {
  Sparkles,
  Languages,
  Clipboard,
  Check,
  RefreshCw,
  ArrowRight,
  Volume2,
  AlertCircle,
  Info,
} from "lucide-react";
import DiffHighlight from "../components/DiffHighlight";
import { motion, AnimatePresence } from "motion/react";
import { useLanguage } from "../context/language";
import { useWorkspace } from "../context/workspace";
import { useWorkspaceTab } from "../context/workspace-tab";
import { isMacPlatform } from "../lib/shortcuts";

export default function HomePage() {
  const { selectedLanguage } = useLanguage();
  const { activeTab } = useWorkspaceTab();
  const {
    inputText,
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
  } = useWorkspace();

  const inputRef = useRef<HTMLTextAreaElement>(null);
  const currentLen = inputText.length;

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  return (
    <main className="flex-1 max-w-[1280px] w-full mx-auto p-4 sm:px-6 sm:pb-10">
      <div className="flex flex-col gap-4">
        <div className="bg-white rounded-card shadow-card flex flex-col overflow-hidden relative min-h-[320px]">
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
                  type="button"
                >
                  Clear
                </button>
              )}
              <span
                className={`text-[11px] font-bold select-none px-3 py-1 rounded-full ${
                  currentLen > maxCharacters * 0.85
                    ? "bg-amber-50 text-amber-600"
                    : "bg-gray-100 text-gray-500"
                }`}
              >
                {currentLen} / {maxCharacters}
              </span>
            </div>
          </div>

          <div className="relative flex-1 flex flex-col">
            <textarea
              ref={inputRef}
              autoFocus
              className="w-full flex-1 p-5 text-sm md:text-[15px] leading-relaxed text-gray-700 placeholder-gray-400 focus:outline-none resize-none min-h-[180px] bg-white border-0 focus:ring-0"
              placeholder={selectedLanguage.placeholder}
              value={inputText}
              onChange={handleTextChange}
              maxLength={maxCharacters}
              id="input-text-area"
            />

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
                      type="button"
                    >
                      <span className="block text-[10px] font-semibold text-gray-400">
                        {ex.title}
                      </span>
                      <span className="font-normal text-gray-600 text-xs block truncate mt-0.5">
                        {ex.text}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="p-4 border-t border-gray-100 flex items-center justify-between gap-4">
            <div className="flex gap-2">
              {inputText && (
                <button
                  onClick={() => handleReadAloud(inputText)}
                  className="w-10 h-10 flex items-center justify-center bg-white rounded-ctrl shadow-card hover:shadow-hover text-gray-500 hover:text-indigo-600 transition cursor-pointer"
                  title="Read original text aloud"
                  id="tts-original"
                  type="button"
                >
                  <Volume2 className="h-4 w-4" />
                </button>
              )}
            </div>

            <div className="flex gap-3 items-center">
              <button
                onClick={() => void handleTrigger()}
                disabled={loading || !inputText.trim()}
                className="flex items-center gap-2 px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-full shadow-pop transition disabled:opacity-50 disabled:cursor-not-allowed text-[13px] cursor-pointer"
                id="action-trigger-button"
                type="button"
              >
                {loading ? (
                  <>
                    <RefreshCw className="h-4 w-4 animate-spin text-white" />
                    <span>Optimizing grammar...</span>
                  </>
                ) : activeTab === "check" ? (
                  <>
                    <Check className="h-4 w-4" />
                    <span>Check accuracy</span>
                    <kbd className="ml-1 hidden sm:inline text-[10px] font-bold opacity-80">
                      {isMacPlatform() ? "⌘↵" : "Ctrl↵"}
                    </kbd>
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4" />
                    <span>Generate rephrases</span>
                    <kbd className="ml-1 hidden sm:inline text-[10px] font-bold opacity-80">
                      {isMacPlatform() ? "⌘↵" : "Ctrl↵"}
                    </kbd>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>

        <div className="space-y-4">
          {errorMsg && (
            <div className="p-4 bg-white rounded-card shadow-card flex items-start gap-3">
              <div className="w-9 h-9 rounded-ctrl bg-red-50 flex items-center justify-center shrink-0">
                <AlertCircle className="h-5 w-5 text-red-600" />
              </div>
              <div>
                <h4 className="text-[14px] font-bold text-gray-900">
                  Something went wrong
                </h4>
                <p className="text-[12.5px] text-gray-500 leading-relaxed mt-0.5">
                  {errorMsg}
                </p>
              </div>
            </div>
          )}

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
                  <div className="md:col-span-2 space-y-4">
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

                    <div className="flex flex-wrap gap-2 items-center justify-between bg-white px-4 py-3 rounded-card shadow-card">
                      <span className="text-[12.5px] text-gray-500 flex items-center gap-1.5 font-semibold">
                        <Check className="h-4 w-4 text-green-600" />
                        Checked for fluency in {selectedLanguage.name}
                      </span>

                      <div className="flex gap-2">
                        <button
                          onClick={() =>
                            handleCopyText(checkResult.correctedText, "corrected")
                          }
                          className="text-[12.5px] flex items-center gap-1.5 px-3.5 py-2 rounded-full bg-white shadow-card hover:shadow-hover text-gray-700 hover:text-indigo-600 font-semibold transition"
                          title="Copy the corrected sentence"
                          id="copy-corrected-button"
                          type="button"
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
                          onClick={() =>
                            handleReadAloud(checkResult.correctedText)
                          }
                          className="text-[12.5px] flex items-center gap-1.5 px-3.5 py-2 rounded-full bg-white shadow-card hover:shadow-hover text-gray-700 hover:text-indigo-600 font-semibold transition"
                          id="tts-corrected"
                          type="button"
                        >
                          <Volume2 className="h-3.5 w-3.5" />
                          <span>Listen</span>
                        </button>
                      </div>
                    </div>

                    <div className="bg-white rounded-card shadow-card p-5 space-y-4">
                      <h3 className="text-[14px] font-bold text-gray-900 flex items-center gap-2">
                        <Info className="h-4 w-4 text-indigo-600" />
                        Correction explanations
                      </h3>

                      {!checkResult.explanations ||
                      checkResult.explanations.length === 0 ? (
                        <div className="flex items-center gap-3 bg-green-50 p-4 rounded-ctrl text-green-700 text-[12.5px]">
                          <span className="text-base select-none">🎉</span>
                          <div>
                            <span className="font-bold">No errors detected.</span>{" "}
                            Your phrasing flows perfectly.
                          </div>
                        </div>
                      ) : (
                        <div className="divide-y divide-gray-100">
                          {checkResult.explanations.map((exp, i) => (
                            <div
                              key={i}
                              className="py-3.5 first:pt-0 last:pb-0 flex flex-col md:flex-row gap-2.5 justify-between"
                            >
                              <div className="space-y-1">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="font-semibold text-[12px] text-red-600 line-through bg-red-50 px-2 py-0.5 rounded-md">
                                    {exp.original}
                                  </span>
                                  <ArrowRight className="h-3.5 w-3.5 text-gray-400" />
                                  <span className="font-semibold text-[12px] text-green-700 bg-green-50 px-2 py-0.5 rounded-md">
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

                  <div className="md:col-span-1 space-y-4">
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
                            className={`transition-all duration-1000 ${
                              checkResult.score >= 90
                                ? "stroke-green-600"
                                : checkResult.score >= 75
                                  ? "stroke-amber-500"
                                  : "stroke-red-500"
                            }`}
                            strokeWidth="9"
                            fill="transparent"
                            strokeDasharray={2 * Math.PI * 48}
                            strokeDashoffset={
                              2 * Math.PI * 48 * (1 - checkResult.score / 100)
                            }
                            strokeLinecap="round"
                          />
                        </svg>

                        <div className="absolute inset-0 flex flex-col items-center justify-center">
                          <span className="text-[27px] font-bold text-gray-900 tracking-[-1px] leading-none">
                            {checkResult.score}
                          </span>
                          <span className="text-[11px] text-gray-400 font-bold mt-0.5">
                            / 100
                          </span>
                        </div>
                      </div>

                      <div className="mt-4">
                        <h4 className="text-[13px] font-bold text-gray-900">
                          {checkResult.score >= 90
                            ? "Excellent mastery"
                            : checkResult.score >= 75
                              ? "Good phrasing, minor fixes"
                              : "Needs structural corrections"}
                        </h4>
                        <p className="text-gray-500 text-[12px] leading-relaxed mt-1">
                          {checkResult.score >= 90
                            ? "Your text contains almost flawless morphology and syntax."
                            : checkResult.score >= 75
                              ? "Some syntax, preposition or spelling issues were optimized."
                              : "Consider reviewing word endings, subject–verb alignment, and punctuation."}
                        </p>
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          )}

          {activeTab === "rephrase" && (
            <AnimatePresence>
              {rephraseResult && (
                <motion.div
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="space-y-2"
                  id="rephrase-alternatives-panel"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[13px] font-bold text-gray-900 flex items-center gap-1.5">
                      <Sparkles className="h-3.5 w-3.5 text-indigo-600" />
                      Stylistic variations ({rephraseResult.length})
                    </span>
                    <span className="text-[11px] text-gray-500 bg-gray-100 px-2.5 py-0.5 rounded-full select-none">
                      Tuned for tone, brevity and engagement
                    </span>
                  </div>

                  <div className="bg-white rounded-card shadow-card divide-y divide-gray-100">
                    {rephraseResult.map((alt, index) => {
                      const overviewTint = [
                        "bg-indigo-50 text-indigo-600",
                        "bg-sky-50 text-sky-700",
                        "bg-slate-100 text-slate-600",
                        "bg-cyan-50 text-cyan-700",
                        "bg-teal-50 text-teal-700",
                      ][index % 5];

                      return (
                      <div
                        key={index}
                        className="px-4 py-2.5 flex items-start gap-3"
                        id={`rephrase-card-${index}`}
                      >
                        <div className="min-w-0 flex-1 space-y-1">
                          {(index === 0 || alt.changesOverview) && (
                            <div className="flex items-center gap-1.5 flex-wrap">
                              {index === 0 && (
                                <span className="text-[10px] font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full">
                                  Recommended
                                </span>
                              )}
                              {alt.changesOverview && (
                                <span
                                  className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${overviewTint}`}
                                >
                                  {alt.changesOverview}
                                </span>
                              )}
                            </div>
                          )}
                          <p className="text-gray-900 text-[13px] md:text-sm font-medium leading-snug whitespace-pre-line selection:bg-indigo-100">
                            {alt.text}
                          </p>
                        </div>

                        <button
                          onClick={() =>
                            handleCopyText(alt.text, `card-${index}`)
                          }
                          className="w-7 h-7 shrink-0 flex items-center justify-center rounded-[10px] text-gray-400 hover:text-indigo-600 hover:bg-gray-100 transition"
                          title="Copy alternative text"
                          id={`copy-rephrase-btn-${index}`}
                          type="button"
                        >
                          {copiedText === `card-${index}` ? (
                            <Check className="h-3.5 w-3.5 text-indigo-600" />
                          ) : (
                            <Clipboard className="h-3.5 w-3.5" />
                          )}
                        </button>
                      </div>
                      );
                    })}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          )}

          {!checkResult && !rephraseResult && !errorMsg && !loading && (
            <div className="bg-white rounded-card p-12 text-center text-gray-500 max-w-lg mx-auto flex flex-col items-center justify-center gap-3 shadow-card mt-2">
              <div className="w-12 h-12 rounded-ctrl bg-indigo-50 flex items-center justify-center mb-1">
                <Sparkles className="h-6 w-6 text-indigo-600" />
              </div>
              <h3 className="text-[15px] font-bold text-gray-900 tracking-tight">
                Write or pick an example
              </h3>
              <p className="text-[12.5px] text-gray-500 max-w-[280px] leading-relaxed">
                Enter text in the editor, choose your target language, then run a
                grammar check or generate rephrase options.
              </p>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
