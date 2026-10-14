/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useMemo, useRef, useState } from "react";
import type { DiffSegment } from "../types";
import {
  compose,
  correctionRuns,
  linePrefix,
  runs,
  type Piece,
  type RichMark,
  type RichText,
} from "../lib/richText";
import { Info, HelpCircle, ArrowRight, Undo2, Redo2 } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

interface DiffHighlightProps {
  segments: DiffSegment[];
  language: string;
  /** The formatted input the segments were computed from; enables formatted rendering and output */
  rich?: RichText | null;
  /**
   * Called with the effective result whenever the user reverts or re-applies a correction:
   * plain text, plus formatted text when `rich` matches the segments.
   */
  onEffectiveChange?: (result: { text: string; rich: RichText | null }) => void;
}

/**
 * A parsed unit of the diff: either untouched text or a single revertable correction. `start`/`end`
 * (or `at` for insertions) are positions in the original text, used to map formatting.
 */
type Token =
  | { kind: "text"; id: string; text: string; start: number; end: number }
  | {
      kind: "replace";
      id: string;
      original: string;
      corrected: string;
      reason: string;
      start: number;
      end: number;
    }
  | { kind: "delete"; id: string; original: string; reason: string; start: number; end: number }
  | { kind: "insert"; id: string; corrected: string; reason: string; at: number };

/** Parse the raw segments into tokens, pairing deleted+inserted into a single replacement. */
function parseTokens(segments: DiffSegment[]): Token[] {
  const withIds = segments.map((seg, idx) => ({
    ...seg,
    id: seg.id || `seg-${seg.type}-${idx}-${seg.text.substring(0, 5)}`,
  }));

  const tokens: Token[] = [];
  let pos = 0; // position in the original text
  for (let i = 0; i < withIds.length; i++) {
    const current = withIds[i];
    const next = withIds[i + 1];
    const start = pos;

    if (current.type === "deleted" && next && next.type === "inserted") {
      pos += current.text.length;
      tokens.push({
        kind: "replace",
        id: `compound-${current.id}-${next.id}`,
        original: current.text,
        corrected: next.text,
        reason: next.reason || current.reason || "Grammar improvement",
        start,
        end: pos,
      });
      i++; // consume the paired inserted segment
    } else if (current.type === "deleted") {
      pos += current.text.length;
      tokens.push({
        kind: "delete",
        id: current.id,
        original: current.text,
        reason: current.reason || "Unnecessary word deleted",
        start,
        end: pos,
      });
    } else if (current.type === "inserted") {
      tokens.push({
        kind: "insert",
        id: current.id,
        corrected: current.text,
        reason: current.reason || "Vocabulary or stylistic enhancement",
        at: start,
      });
    } else {
      pos += current.text.length;
      tokens.push({ kind: "text", id: current.id, text: current.text, start, end: pos });
    }
  }
  return tokens;
}

/** The same result as effectiveText, as steps that rebuild it from the original (for formatting). */
function effectivePieces(tokens: Token[], reverted: Set<string>): Piece[] {
  return tokens.flatMap((t): Piece[] => {
    const keep: Piece[] = t.kind === "insert" ? [] : [{ keep: [t.start, t.end] }];
    switch (t.kind) {
      case "text":
        return keep;
      case "replace":
        return reverted.has(t.id) ? keep : [{ insert: t.corrected, at: t.start, end: t.end }];
      case "delete":
        return reverted.has(t.id) ? keep : [];
      case "insert":
        return reverted.has(t.id) ? [] : [{ insert: t.corrected, at: t.at }];
    }
  });
}

/** Wraps text in its formatting for the diff view (links are shown, not clickable). */
function withMarks(content: React.ReactNode, marks: RichMark[], heading: boolean): React.ReactNode {
  let node = content;
  for (const m of [...marks].reverse()) {
    if (m.type === "bold") node = <strong className="font-bold">{node}</strong>;
    else if (m.type === "italic") node = <em>{node}</em>;
    else if (m.type === "underline") node = <u>{node}</u>;
    else if (m.type === "strike") node = <s>{node}</s>;
    else if (m.type === "code")
      node = <code className="font-mono text-[0.92em] bg-gray-100 rounded px-0.5">{node}</code>;
    else if (m.type === "link")
      node = (
        <span className="text-indigo-600 underline decoration-indigo-300" title={m.href}>
          {node}
        </span>
      );
  }
  return heading ? <span className="font-semibold text-gray-900">{node}</span> : node;
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
  rich,
  onEffectiveChange,
}: DiffHighlightProps) {
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [reverted, setReverted] = useState<Set<string>>(() => new Set());

  const tokens = useMemo(() => parseTokens(segments), [segments]);

  // Reset revert choices whenever a fresh result comes in.
  useEffect(() => {
    setReverted(new Set());
  }, [segments]);

  // Formatting only applies if it belongs to exactly the text these segments were computed from
  const source = useMemo(() => {
    if (!rich) return null;
    const original = segments.filter((s) => s.type !== "inserted").map((s) => s.text).join("");
    return original === rich.text ? rich : null;
  }, [rich, segments]);

  const lineOf = useMemo(() => {
    const lines: number[] = [];
    let n = 0;
    for (const ch of source?.text ?? "") {
      for (let i = 0; i < ch.length; i++) lines.push(n);
      if (ch === "\n") n++;
    }
    return lines;
  }, [source]);

  const result = useMemo(
    () => ({
      text: effectiveText(tokens, reverted),
      rich: source ? compose(source, effectivePieces(tokens, reverted)) : null,
    }),
    [tokens, reverted, source]
  );

  // Report the effective result upward without depending on the callback identity.
  const onChangeRef = useRef(onEffectiveChange);
  onChangeRef.current = onEffectiveChange;
  useEffect(() => {
    onChangeRef.current?.(result);
  }, [result]);

  if (!segments || segments.length === 0) {
    return <p className="text-gray-500 italic">No corrections to display.</p>;
  }

  // Bullets, numbers and quote bars at the start of original lines
  const lineStart = (n: number): React.ReactNode => {
    const line = source?.lines[n];
    if (!line) return null;
    if (line.kind.type === "quote")
      return (
        <span key={`line-${n}`} className="text-gray-300 select-none">
          {"│ "}
        </span>
      );
    const prefix = linePrefix(line);
    return prefix ? (
      <span key={`line-${n}`} className="text-gray-400 select-none whitespace-pre">
        {prefix}
      </span>
    ) : null;
  };
  const isHeading = (i: number) => source?.lines[lineOf[i]]?.kind.type === "heading";

  /** Original text [start, end) with its formatting; a line break also draws the next line's marker. */
  const original = (start: number, end: number, fallback: string): React.ReactNode =>
    source
      ? runs(source, start, end).map((r) => (
          <React.Fragment key={r.start}>
            {r.text === "\n" ? (
              <>
                {"\n"}
                {lineStart(lineOf[r.start] + 1)}
              </>
            ) : (
              withMarks(r.text, r.marks, isHeading(r.start))
            )}
          </React.Fragment>
        ))
      : fallback;

  /** Corrected text with the formatting it takes from what it replaces ([at, end)) or follows. */
  const corrected = (text: string, at: number, end?: number): React.ReactNode =>
    source
      ? correctionRuns(source, text, at, end).map((r, i) => (
          <React.Fragment key={i}>{withMarks(r.text, r.marks, isHeading(at))}</React.Fragment>
        ))
      : text;

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
          {original(token.start, token.end, token.text)}
        </span>
      );
    }

    const isReverted = reverted.has(token.id);
    const chipBase =
      "rounded-md px-1 py-0.5 text-sm font-medium transition-colors duration-200";

    // Only the current text is shown: the correction while applied, the original once reverted.
    // A removed word (or a reverted insertion) has no current text, so it gets a small marker to click.
    const appliedChip = `${chipBase} bg-green-100 text-green-700`;
    const keptChip = `${chipBase} bg-gray-100 text-gray-700`;
    const marker = (label: string) => (
      <span
        aria-label={label}
        className="rounded-md bg-gray-100 px-1.5 py-0.5 text-[10px] text-gray-400"
      >
        •
      </span>
    );

    let inner: React.ReactNode;
    let heading: React.ReactNode;
    let body: React.ReactNode;

    if (token.kind === "replace") {
      inner = isReverted ? (
        <span className={keptChip}>{original(token.start, token.end, token.original)}</span>
      ) : (
        <span className={appliedChip}>{corrected(token.corrected, token.start, token.end)}</span>
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
          <span className="text-gray-500 line-through font-mono font-bold">
            {token.original}
          </span>{" "}
          to{" "}
          <span className="text-green-700 font-mono font-bold">
            {token.corrected}
          </span>
        </>
      );
    } else if (token.kind === "delete") {
      inner = isReverted ? (
        <span className={keptChip}>{original(token.start, token.end, token.original)}</span>
      ) : (
        marker(`Removed "${token.original}"`)
      );
      heading = (
        <div className="flex items-center gap-1.5 text-gray-600 font-bold text-[11px]">
          <HelpCircle className="h-3 w-3" />
          {isReverted ? "Word kept" : "Proposed omission"}
        </div>
      );
      body = (
        <>
          Remove "
          <span className="text-gray-500 line-through font-mono font-bold">
            {token.original}
          </span>
          "
        </>
      );
    } else {
      inner = isReverted ? (
        marker(`Skipped "${token.corrected}"`)
      ) : (
        <span className={appliedChip}>{corrected(token.corrected, token.at)}</span>
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
        className="group relative inline-flex items-center align-middle cursor-pointer rounded-md ring-indigo-200 hover:ring-2 focus:outline-none focus:ring-2 focus:ring-indigo-400"
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
        {/* Floats over the corner so it never adds width: spacing comes only from the text itself */}
        <span className="pointer-events-none absolute -top-2 -right-2 hidden h-4 w-4 items-center justify-center rounded-full bg-white shadow-card group-hover:flex group-focus-visible:flex">
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
        {lineStart(0)}
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
