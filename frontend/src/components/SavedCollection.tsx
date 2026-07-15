/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import type { SavedItem } from "../types";
import { Trash2, Copy, History, ClipboardCheck, ArrowUpRight, Check, Sparkles } from "lucide-react";
import React, { useState } from "react";
import { motion, AnimatePresence } from "motion/react";

interface SavedCollectionProps {
  items: SavedItem[];
  onApplyItem: (item: SavedItem) => void;
  onDeleteItem: (id: string) => void;
  onClearAll: () => void;
}

export default function SavedCollection({
  items,
  onApplyItem,
  onDeleteItem,
  onClearAll,
}: SavedCollectionProps) {
  const [filter, setFilter] = useState<"all" | "check" | "rephrase">("all");
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState<number>(1);

  const ITEMS_PER_PAGE = 3;

  const filteredItems = items.filter(
    (item) => filter === "all" || item.type === filter
  );

  const handleFilterChange = (newFilter: "all" | "check" | "rephrase") => {
    setFilter(newFilter);
    setCurrentPage(1);
  };

  const handleCopyText = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  // Pagination calculation
  const totalPages = Math.ceil(filteredItems.length / ITEMS_PER_PAGE);
  // Guard current page range
  const activePage = Math.max(1, Math.min(currentPage, totalPages || 1));
  
  const displayedItems = filteredItems.slice(
    (activePage - 1) * ITEMS_PER_PAGE,
    activePage * ITEMS_PER_PAGE
  );

  return (
    <div className="bg-slate-50/80 rounded-2xl border border-slate-200/60 p-4 shadow-inner flex flex-col h-full min-h-[400px]">
      <div className="flex items-center justify-between mb-4 pb-2 border-b border-slate-200">
        <div className="flex items-center gap-2 text-slate-800 font-bold">
          <History className="h-5 w-5 text-indigo-600" />
          <span>Linguistic History</span>
          <span className="text-xs font-semibold bg-indigo-100 text-indigo-700 rounded-full px-2.5 py-0.5">
            {items.length}
          </span>
        </div>
        
        {items.length > 0 && (
          <button
            onClick={onClearAll}
            className="text-xs flex items-center gap-1 text-rose-600 hover:text-rose-700 transition font-medium"
            id="clear-all-history"
          >
            <Trash2 className="h-3.5 w-3.5" />
            Clear All
          </button>
        )}
      </div>

      <div className="flex gap-1.5 justify-start mb-3 bg-slate-200/50 p-1 rounded-xl">
        <button
          onClick={() => handleFilterChange("all")}
          className={`flex-1 text-xs py-1.5 px-2.5 rounded-lg font-medium transition ${
            filter === "all"
              ? "bg-white text-slate-800 shadow-sm"
              : "text-slate-600 hover:text-slate-800"
          }`}
          id="filter-all"
        >
          All
        </button>
        <button
          onClick={() => handleFilterChange("check")}
          className={`flex-1 text-xs py-1.5 px-2.5 rounded-lg font-medium transition flex items-center justify-center gap-1 ${
            filter === "check"
              ? "bg-white text-indigo-700 shadow-sm"
              : "text-slate-600 hover:text-slate-800"
          }`}
          id="filter-checked"
        >
          <ClipboardCheck className="h-3 w-3" />
          Checks
        </button>
        <button
          onClick={() => handleFilterChange("rephrase")}
          className={`flex-1 text-xs py-1.5 px-2.5 rounded-lg font-medium transition flex items-center justify-center gap-1 ${
            filter === "rephrase"
              ? "bg-white text-teal-700 shadow-sm"
              : "text-slate-600 hover:text-slate-800"
          }`}
          id="filter-rephrases"
        >
          <Sparkles className="h-3 w-3" />
          Rephrases
        </button>
      </div>

      <div className="flex-1 overflow-y-auto pr-1 space-y-3 max-h-[500px]">
        {displayedItems.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 text-center text-slate-400 gap-2">
            <History className="h-8 w-8 stroke-[1.25] text-slate-300" />
            <h3 className="text-sm font-semibold text-slate-600">No records yet</h3>
            <p className="text-xs text-slate-500 max-w-[200px]">
              Checked or rephrased texts will automatically accumulate here.
            </p>
          </div>
        ) : (
          <AnimatePresence initial={false} mode="popLayout">
            {displayedItems.map((item) => (
              <motion.div
                key={item.id}
                layout
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, x: -50 }}
                className="bg-white p-3.5 rounded-xl border border-slate-200/70 hover:border-indigo-200 hover:shadow-md transition-all duration-200 relative group flex flex-col gap-2"
                id={`history-item-${item.id}`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span
                    className={`text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${
                      item.type === "check"
                        ? "bg-indigo-50 text-indigo-700"
                        : "bg-teal-50 text-teal-700"
                    }`}
                  >
                    {item.type === "check" ? "Grammar Check" : "Rephrases"}
                  </span>
                  <span className="text-[10px] text-gray-400 font-mono">
                    {new Date(item.timestamp).toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                </div>

                <div className="text-xs text-slate-700 line-clamp-2 bg-slate-50/50 p-2 rounded-lg font-mono">
                  {item.originalText}
                </div>

                {item.correctedText && (
                  <div className="flex flex-col gap-0.5">
                    <span className="text-[9px] font-semibold text-emerald-600">Corrected text:</span>
                    <div className="text-slate-800 text-xs font-semibold leading-relaxed line-clamp-2">
                      {item.correctedText}
                    </div>
                  </div>
                )}

                {item.rephraseOptions && item.rephraseOptions.length > 0 && (
                  <div className="flex flex-col gap-1 mt-1">
                    <span className="text-[9px] font-semibold text-teal-600">Alternatives:</span>
                    <div className="space-y-1">
                      {item.rephraseOptions.slice(0, 2).map((alt, ai) => (
                        <div key={ai} className="text-[11px] text-slate-700 bg-teal-50/20 px-2 py-1 rounded border border-teal-100/40 truncate">
                          <span className="font-bold text-[9px] text-teal-700 mr-1 italic">
                            [{alt.tone.split(" / ")[0]}]:
                          </span>
                          {alt.text}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="flex items-center justify-between border-t border-slate-100 pt-2 mt-1">
                  <div className="flex gap-2">
                    <button
                      onClick={() => onApplyItem(item)}
                      className="text-xs font-medium text-indigo-600 hover:text-indigo-800 flex items-center gap-1 transition"
                      title="Load into main input text field"
                      id={`apply-item-${item.id}`}
                    >
                      <ArrowUpRight className="h-3.5 w-3.5" />
                      Restore
                    </button>

                    <button
                      onClick={() => handleCopyText(item.id, item.correctedText || item.originalText)}
                      className="text-xs font-medium text-slate-500 hover:text-slate-700 flex items-center gap-1 transition-colors"
                      title="Copy main result"
                      id={`copy-item-${item.id}`}
                    >
                      {copiedId === item.id ? (
                        <>
                          <Check className="h-3.5 w-3.5 text-emerald-500 animate-pulse" />
                          <span className="text-emerald-600 font-semibold">Copied</span>
                        </>
                      ) : (
                        <>
                          <Copy className="h-3.5 w-3.5" />
                          <span>Copy</span>
                        </>
                      )}
                    </button>
                  </div>

                  <button
                    onClick={() => onDeleteItem(item.id)}
                    className="p-1 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 transition"
                    title="Delete item"
                    id={`delete-item-${item.id}`}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        )}
      </div>

      {/* Pagination Controls */}
      {totalPages > 1 && (
        <div className="mt-4 pt-3 border-t border-slate-200/80 flex items-center justify-between">
          <button
            onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
            disabled={activePage === 1}
            className="text-[11px] font-bold text-slate-600 hover:text-indigo-600 disabled:text-slate-300 disabled:cursor-not-allowed transition flex items-center gap-1 px-2 py-1 bg-white hover:bg-indigo-50 border border-slate-200/70 rounded-lg shadow-xs"
            id="history-pagination-prev"
          >
            ← Prev
          </button>
          
          <div className="text-[11px] font-bold text-slate-500 font-mono">
            Page <span className="text-indigo-600 font-black">{activePage}</span> of {totalPages}
          </div>

          <button
            onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
            disabled={activePage === totalPages}
            className="text-[11px] font-bold text-slate-600 hover:text-indigo-600 disabled:text-slate-300 disabled:cursor-not-allowed transition flex items-center gap-1 px-2 py-1 bg-white hover:bg-indigo-50 border border-slate-200/70 rounded-lg shadow-xs"
            id="history-pagination-next"
          >
            Next →
          </button>
        </div>
      )}
    </div>
  );
}
