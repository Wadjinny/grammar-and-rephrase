/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useMemo, useRef, useState } from "react";
import type { DiffSegment } from "../types";
import { Info, HelpCircle, ArrowRight, Undo2, Redo2 } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

interface DiffHighlightProps {
  segments: DiffSegment[];
  language: string;
  /** Called with the effective text whenever the user reverts/re-applies a correction. */
  onEffectiveTextChange?: (text: string) => void;
}

/** A parsed unit of the diff: either untouched text or a single revertable correction. */
type Token =
  | { kind: "text"; id: string; text: string }
  | {
      kind: "replace";
      id: string;
      original: string;
      corrected: string;
      reason: string;
    }
  | { kind: "delete"; id: string; original: string; reason: string }
  | { kind: "insert"; id: string; corrected: string; reason: string };

/** Parse the raw segments into tokens, pairing deleted+inserted into a single replacement. */
function parseTokens(segments: DiffSegment[]): Token[] {
  const withIds = segments.map((seg, idx) => ({
    ...seg,
    id: seg.id || `seg-${seg.type}-${idx}-${seg.text.substring(0, 5)}`,
  }));

  const tokens: Token[] = [];
  for (let i = 0; i < withIds.length; i++) {
    const current = withIds[i];
    const next = withIds[i + 1];

    if (current.type === "deleted" && next && next.type === "inserted") {
      tokens.push({
        kind: "replace",
        id: `compound-${current.id}-${next.id}`,
        original: current.text,
        corrected: next.text,
        reason: next.reason || current.reason || "Grammar improvement",
      });
      i++; // consume the paired inserted segment
    } else if (current.type === "deleted") {
      tokens.push({
        kind: "delete",
        id: current.id,
        original: current.text,
        reason: current.reason || "Unnecessary word deleted",
      });
    } else if (current.type === "inserted") {
      tokens.push({
        kind: "insert",
        id: current.id,
        corrected: current.text,
        reason: current.reason || "Vocabulary or stylistic enhancement",
      });
    } else {
      tokens.push({ kind: "text", id: current.id, text: current.text });
    }
  }
  return tokens;
}

/** The resulting text given which corrections the user has reverted. */
function effectiveText(tokens: Token[], reverted: Set<string>): string {
  return tokens
    .map((t) => {
      switch (t.kind) {
        case "text":
          return t.text;
        case "replace":
          return reverted.has(t.id) ? t.original : t.corrected;
        case "delete":
          return reverted.has(t.id) ? t.original : "";
        case "insert":
          return reverted.has(t.id) ? "" : t.corrected;
      }
    })
    .join("");
}

export default function DiffHighlight({
  segments,
  onEffectiveTextChange,
}: DiffHighlightProps) {
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [reverted, setReverted] = useState<Set<string>>(() => new Set());

  const tokens = useMemo(() => parseTokens(segments), [segments]);

  // Reset revert choices whenever a fresh result comes in.
  useEffect(() => {
    setReverted(new Set());
  }, [segments]);

  const resultText = useMemo(
    () => effectiveText(tokens, reverted),
    [tokens, reverted]
  );

  // Report the effective text upward without depending on the callback identity.
  const onChangeRef = useRef(onEffectiveTextChange);
  onChangeRef.current = onEffectiveTextChange;
  useEffect(() => {
    onChangeRef.current?.(resultText);
  }, [resultText]);

  if (!segments || segments.length === 0) {
    return <p className="text-gray-500 italic">No corrections to display.</p>;
  }

  const toggle = (id: string) =>
    setReverted((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });

  const correctionCount = tokens.filter((t) => t.kind !== "text").length;
  const revertedCount = tokens.filter(
    (t) => t.kind !== "text" && reverted.has(t.id)
  ).length;

  const renderTooltip = (
    id: string,
    isReverted: boolean,
    heading: React.ReactNode,
    body: React.ReactNode,
    reason: string
  ) => (
    <AnimatePresence>
      {hoveredId === id && (
        <motion.div
          initial={{ opacity: 0, y: 8, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 4, scale: 0.95 }}
          transition={{ duration: 0.15 }}
          className="absolute z-50 left-1/2 -translate-x-1/2 bottom-full mb-3 w-72 bg-white text-gray-700 text-xs rounded-ctrl shadow-hover p-3.5 flex flex-col gap-2 cursor-default"
        >
          {heading}
          <div className="text-gray-500 leading-snug">{body}</div>
          <div className="text-gray-500 bg-indigo-50 p-2.5 rounded-[10px] leading-relaxed text-[11px]">
            {reason}
          </div>
          <div className="flex items-center gap-1.5 text-[11px] font-bold text-indigo-600 pt-0.5">
            {isReverted ? (
              <>
                <Redo2 className="h-3 w-3" />
                Click to re-apply this correction
              </>
            ) : (
              <>
                <Undo2 className="h-3 w-3" />
                Click to keep the original
              </>
            )}
          </div>
          <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-1.5 w-3 h-3 bg-white rotate-45 shadow-hover" />
        </motion.div>
      )}
    </AnimatePresence>
  );

  const renderedElements = tokens.map((token) => {
    if (token.kind === "text") {
      return (
        <span
          key={token.id}
          className="text-gray-700 text-sm whitespace-pre-wrap select-text align-middle"
        >
          {token.text}
        </span>
      );
    }

    const isReverted = reverted.has(token.id);
    const chipBase =
      "rounded-md px-1.5 py-0.5 text-sm font-medium transition-colors duration-200";

    let inner: React.ReactNode;
    let heading: React.ReactNode;
    let body: React.ReactNode;

    if (token.kind === "replace") {
      inner = (
        <>
          <span
            className={`${chipBase} ${
              isReverted
                ? "bg-red-100 text-red-700"
                : "bg-red-50 text-red-500 line-through opacity-70"
            }`}
          >
            {token.original}
          </span>
          <ArrowRight
            className={`inline h-3 w-3 mx-0.5 align-middle ${
              isReverted ? "text-gray-300 rotate-180" : "text-gray-400"
            }`}
          />
          <span
            className={`${chipBase} ${
              isReverted
                ? "bg-green-50 text-green-600 line-through opacity-70"
                : "bg-green-100 text-green-700"
            }`}
          >
            {token.corrected}
          </span>
        </>
      );
      heading = (
        <div className="flex items-center gap-1.5 text-indigo-600 font-bold text-[11px]">
          <Info className="h-3 w-3" />
          {isReverted ? "Correction reverted" : "Correction applied"}
        </div>
      );
      body = (
        <>
          Changed{" "}
          <span className="text-red-600 line-through font-mono font-bold">
            {token.original}
          </span>{" "}
          to{" "}
          <span className="text-green-700 font-mono font-bold">
            {token.corrected}
          </span>
        </>
      );
    } else if (token.kind === "delete") {
      inner = (
        <span
          className={`${chipBase} ${
            isReverted
              ? "bg-transparent text-gray-700 underline decoration-dotted decoration-gray-300"
              : "bg-red-50 text-red-600 line-through"
          }`}
        >
          {token.original}
        </span>
      );
      heading = (
        <div className="flex items-center gap-1.5 text-red-600 font-bold text-[11px]">
          <HelpCircle className="h-3 w-3" />
          {isReverted ? "Word kept" : "Proposed omission"}
        </div>
      );
      body = (
        <>
          Remove "
          <span className="text-red-600 line-through font-mono font-bold">
            {token.original}
          </span>
          "
        </>
      );
    } else {
      inner = (
        <span
          className={`${chipBase} ${
            isReverted
              ? "bg-green-50 text-green-500 line-through opacity-70"
              : "bg-green-100 text-green-700"
          }`}
        >
          {token.corrected}
        </span>
      );
      heading = (
        <div className="flex items-center gap-1.5 text-green-700 font-bold text-[11px]">
          <ArrowRight className="h-3 w-3" />
          {isReverted ? "Insertion skipped" : "Insertion applied"}
        </div>
      );
      body = (
        <>
          Insert "
          <span className="text-green-700 font-mono font-bold">
            {token.corrected}
          </span>
          "
        </>
      );
    }

    return (
      <span
        key={token.id}
        role="button"
        tabIndex={0}
        aria-pressed={!isReverted}
        title={isReverted ? "Click to re-apply" : "Click to keep original"}
        className="group relative inline-flex items-center align-middle mx-0.5 cursor-pointer rounded-md ring-indigo-200 hover:ring-2 focus:outline-none focus:ring-2 focus:ring-indigo-400"
        onMouseEnter={() => setHoveredId(token.id)}
        onMouseLeave={() => setHoveredId(null)}
        onClick={() => toggle(token.id)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            toggle(token.id);
          }
        }}
      >
        {inner}
        <span className="ml-0.5 inline-flex items-center text-gray-300 opacity-0 group-hover:opacity-100 transition-opacity">
          {isReverted ? (
            <Redo2 className="h-3 w-3 text-indigo-400" />
          ) : (
            <Undo2 className="h-3 w-3 text-gray-400" />
          )}
        </span>
        {renderTooltip(token.id, isReverted, heading, body, token.reason)}
      </span>
    );
  });

  return (
    <div className="bg-white p-5 rounded-card min-h-[140px] shadow-card antialiased relative overflow-visible">
      <div className="text-left leading-[2.4] select-text">
        {renderedElements}
      </div>

      {correctionCount > 0 && (
        <div className="mt-4 pt-3 border-t border-gray-100 flex items-center justify-between text-[11px]">
          <span className="font-semibold text-gray-400">
            {correctionCount - revertedCount} of {correctionCount} corrections
            applied
          </span>
          {revertedCount > 0 && (
            <button
              type="button"
              onClick={() => setReverted(new Set())}
              className="inline-flex items-center gap-1.5 font-bold text-indigo-600 hover:text-indigo-700 transition-colors"
            >
              <Redo2 className="h-3 w-3" />
              Re-apply all
            </button>
          )}
        </div>
      )}
    </div>
  );
}
