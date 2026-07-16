/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from "react";
import type { DiffSegment } from "../types";
import { Info, HelpCircle, ArrowRight } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

interface DiffHighlightProps {
  segments: DiffSegment[];
  language: string;
}

export default function DiffHighlight({ segments }: DiffHighlightProps) {
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  if (!segments || segments.length === 0) {
    return <p className="text-gray-500 italic">No corrections to display.</p>;
  }

  // Generate stable IDs for segments since they may be generated dynamically without IDs
  const processedSegments = segments.map((seg, idx) => ({
    ...seg,
    id: seg.id || `seg-${seg.type}-${idx}-${seg.text.substring(0, 5)}`
  }));

  // Group consecutives to match deleted + inserted pairs for better hover association
  const renderedElements: React.ReactNode[] = [];
  
  for (let i = 0; i < processedSegments.length; i++) {
    const current = processedSegments[i];
    const next = processedSegments[i + 1];

    // Check if we have a Deleted-then-Inserted pair, which represent a single correction action
    if (current.type === "deleted" && next && next.type === "inserted") {
      const delSeg = current;
      const insSeg = next;
      const compoundId = `compound-${delSeg.id}-${insSeg.id}`;
      const reason = insSeg.reason || delSeg.reason || "Grammar improvement";
      
      renderedElements.push(
        <span
          key={compoundId}
          className="relative inline-block mx-1"
          onMouseEnter={() => setHoveredId(compoundId)}
          onMouseLeave={() => setHoveredId(null)}
        >
          {/* Deleted component */}
          <span className="bg-red-50 text-red-600 line-through rounded-md px-1.5 py-0.5 text-sm cursor-help font-medium select-all transition-colors duration-200 hover:bg-red-100">
            {delSeg.text}
          </span>
          
          {/* Transition icon */}
          <ArrowRight className="inline h-3 w-3 text-gray-400 mx-0.5 align-middle" />
          
          {/* Inserted component */}
          <span className="bg-green-50 text-green-700 rounded-md px-1.5 py-0.5 text-sm cursor-help font-medium select-all transition-colors duration-200 hover:bg-green-100">
            {insSeg.text}
          </span>

          {/* Connected Tooltip */}
          <AnimatePresence>
            {hoveredId === compoundId && (
              <motion.div
                initial={{ opacity: 0, y: 10, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 6, scale: 0.95 }}
                transition={{ duration: 0.15 }}
                className="absolute z-50 left-1/2 -translate-x-1/2 bottom-full mb-3 w-72 bg-white text-gray-700 text-xs rounded-ctrl shadow-hover p-3.5 flex flex-col gap-2"
                id={`tooltip-compound-${i}`}
              >
                <div className="flex items-center gap-1.5 text-indigo-600 font-bold text-[11px]">
                  <Info className="h-3 w-3" />
                  Correction applied
                </div>
                <div className="text-gray-500 leading-snug">
                  Changed <span className="text-red-600 line-through font-mono font-bold">{delSeg.text}</span> to <span className="text-green-700 font-mono font-bold">{insSeg.text}</span>
                </div>
                <div className="text-gray-500 bg-indigo-50 p-2.5 rounded-[10px] leading-relaxed text-[11px]">
                  {reason}
                </div>
                <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-1.5 w-3 h-3 bg-white rotate-45 shadow-hover" />
              </motion.div>
            )}
          </AnimatePresence>
        </span>
      );

      i++; // increment past the matching next token
    } else if (current.type === "deleted") {
      const parentId = current.id;
      const reason = current.reason || "Unnecessary word deleted";
      
      renderedElements.push(
        <span
          key={parentId}
          className="relative inline-block mx-0.5"
          onMouseEnter={() => setHoveredId(parentId)}
          onMouseLeave={() => setHoveredId(null)}
        >
          <span className="bg-red-50 text-red-600 line-through rounded-md px-1.5 py-0.5 text-sm cursor-help font-medium select-all hover:bg-red-100">
            {current.text}
          </span>

          <AnimatePresence>
            {hoveredId === parentId && (
              <motion.div
                initial={{ opacity: 0, y: 8, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 4, scale: 0.95 }}
                transition={{ duration: 0.15 }}
                className="absolute z-50 left-1/2 -translate-x-1/2 bottom-full mb-3 w-64 bg-white text-gray-700 text-xs rounded-ctrl shadow-hover p-3.5 flex flex-col gap-2"
                id={`tooltip-del-${i}`}
              >
                <div className="flex items-center gap-1.5 text-red-600 font-bold text-[11px]">
                  <HelpCircle className="h-3 w-3" />
                  Proposed omission
                </div>
                <div className="text-gray-500">
                  Remove "<span className="text-red-600 line-through font-mono font-bold">{current.text}</span>"
                </div>
                <div className="text-gray-500 bg-indigo-50 p-2.5 rounded-[10px] leading-relaxed text-[11px]">
                  {reason}
                </div>
                <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-1.5 w-3 h-3 bg-white rotate-45 shadow-hover" />
              </motion.div>
            )}
          </AnimatePresence>
        </span>
      );
    } else if (current.type === "inserted") {
      const parentId = current.id;
      const reason = current.reason || "Vocabulary or stylistic enhancement";
      
      renderedElements.push(
        <span
          key={parentId}
          className="relative inline-block mx-0.5"
          onMouseEnter={() => setHoveredId(parentId)}
          onMouseLeave={() => setHoveredId(null)}
        >
          <span className="bg-green-50 text-green-700 rounded-md px-1.5 py-0.5 text-sm cursor-help font-medium select-all hover:bg-green-100">
            {current.text}
          </span>

          <AnimatePresence>
            {hoveredId === parentId && (
              <motion.div
                initial={{ opacity: 0, y: 8, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 4, scale: 0.95 }}
                transition={{ duration: 0.15 }}
                className="absolute z-50 left-1/2 -translate-x-1/2 bottom-full mb-3 w-64 bg-white text-gray-700 text-xs rounded-ctrl shadow-hover p-3.5 flex flex-col gap-2"
                id={`tooltip-ins-${i}`}
              >
                <div className="flex items-center gap-1.5 text-green-700 font-bold text-[11px]">
                  <ArrowRight className="h-3 w-3" />
                  Insertion required
                </div>
                <div className="text-gray-500">
                  Insert "<span className="text-green-700 font-mono font-bold">{current.text}</span>"
                </div>
                <div className="text-gray-500 bg-indigo-50 p-2.5 rounded-[10px] leading-relaxed text-[11px]">
                  {reason}
                </div>
                <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-1.5 w-3 h-3 bg-white rotate-45 shadow-hover" />
              </motion.div>
            )}
          </AnimatePresence>
        </span>
      );
    } else {
      // Unmodified segment
      renderedElements.push(
        <span key={current.id} className="text-gray-700 text-sm whitespace-pre-wrap select-text leading-relaxed">
          {current.text}
        </span>
      );
    }
  }

  return (
    <div className="bg-white p-5 rounded-card min-h-[140px] shadow-card leading-relaxed antialiased select-all relative overflow-visible">
      <div className="flex flex-wrap items-center gap-y-1">
        {renderedElements}
      </div>
    </div>
  );
}
