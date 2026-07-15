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

  const filterButtonClass = (active: boolean) =>
    `flex-1 text-[12px] py-1.5 px-2.5 rounded-full font-semibold transition flex items-center justify-center gap-1 ${
      active ? "bg-white text-gray-900 shadow-[0_1px_3px_rgba(0,0,0,0.08)]" : "text-gray-500 hover:text-gray-900"
    }`;

  return (
    <div className="bg-white rounded-card shadow-card p-5 flex flex-col h-full min-h-[400px]">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2 text-gray-900 font-bold text-[14px]">
          <History className="h-4.5 w-4.5 text-indigo-600" />
          <span>History</span>
          <span className="text-[11px] font-bold bg-indigo-50 text-indigo-600 rounded-full px-2.5 py-0.5">
            {items.length}
          </span>
        </div>
        
        {items.length > 0 && (
          <button
            onClick={onClearAll}
            className="text-[12px] flex items-center gap-1 text-gray-400 hover:text-gray-900 transition font-medium"
            id="clear-all-history"
          >
            <Trash2 className="h-3.5 w-3.5" />
            Clear all
          </button>
        )}
      </div>

      <div className="flex gap-1 justify-start mb-3 bg-gray-100 p-1 rounded-full">
        <button
          onClick={() => handleFilterChange("all")}
          className={filterButtonClass(filter === "all")}
          id="filter-all"
        >
          All
        </button>
        <button
          onClick={() => handleFilterChange("check")}
          className={filterButtonClass(filter === "check")}
          id="filter-checked"
        >
          <ClipboardCheck className="h-3 w-3" />
          Checks
        </button>
        <button
          onClick={() => handleFilterChange("rephrase")}
          className={filterButtonClass(filter === "rephrase")}
          id="filter-rephrases"
        >
          <Sparkles className="h-3 w-3" />
          Rephrases
        </button>
      </div>

      <div className="flex-1 overflow-y-auto pr-1 space-y-2.5 max-h-[500px]">
        {displayedItems.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 text-center text-gray-400 gap-2">
            <div className="w-12 h-12 rounded-ctrl bg-gray-100 flex items-center justify-center mb-1">
              <History className="h-6 w-6 stroke-[1.5] text-gray-400" />
            </div>
            <h3 className="text-[13px] font-bold text-gray-900">No records yet</h3>
            <p className="text-[12px] text-gray-500 max-w-[200px]">
              Checked or rephrased texts appear here automatically.
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
                className="border border-gray-100 p-3.5 rounded-ctrl hover:shadow-card transition-all duration-200 relative group flex flex-col gap-2"
                id={`history-item-${item.id}`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span
                    className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full ${
                      item.type === "check"
                        ? "bg-indigo-50 text-indigo-600"
                        : "bg-gray-100 text-gray-500"
                    }`}
                  >
                    {item.type === "check" ? "Grammar check" : "Rephrases"}
                  </span>
                  <span className="text-[11px] text-gray-400 tabular-nums">
                    {new Date(item.timestamp).toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                </div>

                <div className="text-[12px] text-gray-500 line-clamp-2 bg-gray-100 p-2 rounded-[10px]">
                  {item.originalText}
                </div>

                {item.correctedText && (
                  <div className="flex flex-col gap-0.5">
                    <span className="text-[10px] font-semibold text-indigo-600">Corrected text</span>
                    <div className="text-gray-900 text-[12px] font-semibold leading-relaxed line-clamp-2">
                      {item.correctedText}
                    </div>
                  </div>
                )}

                {item.rephraseOptions && item.rephraseOptions.length > 0 && (
                  <div className="flex flex-col gap-1 mt-1">
                    <span className="text-[10px] font-semibold text-gray-500">Alternatives</span>
                    <div className="space-y-1">
                      {item.rephraseOptions.slice(0, 2).map((alt, ai) => (
                        <div key={ai} className="text-[11px] text-gray-700 bg-gray-50 px-2 py-1 rounded-[8px] truncate">
                          <span className="font-bold text-[10px] text-indigo-600 mr-1">
                            [{alt.tone.split(" / ")[0]}]
                          </span>
                          {alt.text}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="flex items-center justify-between border-t border-gray-100 pt-2.5 mt-1">
                  <div className="flex gap-3">
                    <button
                      onClick={() => onApplyItem(item)}
                      className="text-[12px] font-semibold text-indigo-600 hover:text-indigo-700 flex items-center gap-1 transition"
                      title="Load into main input text field"
                      id={`apply-item-${item.id}`}
                    >
                      <ArrowUpRight className="h-3.5 w-3.5" />
                      Restore
                    </button>

                    <button
                      onClick={() => handleCopyText(item.id, item.correctedText || item.originalText)}
                      className="text-[12px] font-semibold text-gray-500 hover:text-gray-900 flex items-center gap-1 transition-colors"
                      title="Copy main result"
                      id={`copy-item-${item.id}`}
                    >
                      {copiedId === item.id ? (
                        <>
                          <Check className="h-3.5 w-3.5 text-indigo-600" />
                          <span className="text-indigo-600">Copied</span>
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
                    className="w-7 h-7 flex items-center justify-center text-gray-400 hover:text-gray-900 rounded-[10px] hover:bg-gray-100 transition"
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
        <div className="mt-4 pt-3.5 border-t border-gray-100 flex items-center justify-between">
          <button
            onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
            disabled={activePage === 1}
            className="text-[11px] font-bold text-gray-700 hover:text-indigo-600 disabled:text-gray-300 disabled:cursor-not-allowed transition flex items-center gap-1 px-3 py-1.5 bg-white rounded-full shadow-card hover:shadow-hover disabled:shadow-none"
            id="history-pagination-prev"
          >
            ← Prev
          </button>
          
          <div className="text-[11px] font-bold text-gray-500 tabular-nums">
            Page <span className="text-indigo-600">{activePage}</span> of {totalPages}
          </div>

          <button
            onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
            disabled={activePage === totalPages}
            className="text-[11px] font-bold text-gray-700 hover:text-indigo-600 disabled:text-gray-300 disabled:cursor-not-allowed transition flex items-center gap-1 px-3 py-1.5 bg-white rounded-full shadow-card hover:shadow-hover disabled:shadow-none"
            id="history-pagination-next"
          >
            Next →
          </button>
        </div>
      )}
    </div>
  );
}
