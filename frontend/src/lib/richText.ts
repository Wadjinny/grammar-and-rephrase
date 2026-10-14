/**
 * Formatted text as plain text plus per-character formatting, so the grammar check can run on
 * plain text (exactly what the server diffs) and corrections can be mapped back onto the formatting.
 *
 * `text` joins lines with "\n"; `marks[i]` is the formatting of `text[i]` (empty for "\n");
 * `lines[n]` says what the n-th line is (paragraph, list item, ...).
 */

export type RichMarkType = "bold" | "italic" | "underline" | "strike" | "code" | "link";
export type RichMark = { type: RichMarkType; href?: string };

export type LineKind =
  | { type: "paragraph" }
  | { type: "heading"; level: number }
  | { type: "bullet"; depth: number }
  | { type: "ordered"; depth: number; number: number }
  | { type: "quote" };

/** `continuation`: the line starts at a hard line break inside the previous line's block. */
export type RichLine = { kind: LineKind; continuation: boolean };

export type RichText = { text: string; marks: RichMark[][]; lines: RichLine[] };

/** The subset of Tiptap / ProseMirror JSON this module reads and writes. */
export type DocNode = {
  type: string;
  attrs?: Record<string, unknown>;
  marks?: { type: string; attrs?: Record<string, unknown> }[];
  text?: string;
  content?: DocNode[];
};

const markKey = (marks: RichMark[]) => marks.map((m) => m.type + (m.href ?? "")).join("|");
const MARK_TYPES: RichMarkType[] = ["link", "bold", "italic", "underline", "strike", "code"];
const PARAGRAPH: LineKind = { type: "paragraph" };

class Builder {
  text = "";
  marks: RichMark[][] = [];
  lines: RichLine[] = [];

  startLine(kind: LineKind, continuation = false) {
    if (this.lines.length > 0) {
      this.text += "\n";
      this.marks.push([]);
    }
    this.lines.push({ kind, continuation });
  }

  push(text: string, marks: RichMark[]) {
    for (const ch of text) {
      // Surrogate pairs take two UTF-16 units; both get the marks so indexes stay aligned
      this.text += ch;
      for (let i = 0; i < ch.length; i++) this.marks.push(marks);
    }
  }

  result(): RichText {
    if (this.lines.length === 0) this.lines.push({ kind: PARAGRAPH, continuation: false });
    return { text: this.text, marks: this.marks, lines: this.lines };
  }
}

function readMarks(node: DocNode): RichMark[] {
  const marks: RichMark[] = [];
  for (const m of node.marks ?? []) {
    if (!(MARK_TYPES as string[]).includes(m.type)) continue;
    marks.push(m.type === "link" ? { type: "link", href: String(m.attrs?.href ?? "") } : { type: m.type as RichMarkType });
  }
  return marks;
}

/** Reads an editor document. Block structure becomes lines; inline formatting becomes marks. */
export function fromDoc(doc: DocNode): RichText {
  const b = new Builder();

  const inline = (nodes: DocNode[] | undefined, kind: LineKind) => {
    for (const n of nodes ?? []) {
      if (n.type === "text") b.push(n.text ?? "", readMarks(n));
      else if (n.type === "hardBreak") b.startLine(kind, true);
    }
  };

  const blocks = (nodes: DocNode[] | undefined, kind: (first: boolean) => LineKind, depth: number) => {
    let first = true;
    for (const n of nodes ?? []) {
      if (n.type === "paragraph") {
        // Later paragraphs of a list item continue the item rather than starting a new bullet
        b.startLine(kind(first), !first && kind(first).type !== "paragraph" && kind(first).type !== "quote");
        inline(n.content, kind(first));
      } else if (n.type === "heading") {
        const k: LineKind = { type: "heading", level: Number(n.attrs?.level ?? 1) };
        b.startLine(k);
        inline(n.content, k);
      } else if (n.type === "bulletList" || n.type === "orderedList") {
        const start = Number(n.attrs?.start ?? 1);
        (n.content ?? []).forEach((item, i) => {
          const itemKind = (): LineKind =>
            n.type === "bulletList" ? { type: "bullet", depth } : { type: "ordered", depth, number: start + i };
          blocks(item.content, itemKind, depth + 1);
        });
      } else if (n.type === "blockquote") {
        blocks(n.content, () => ({ type: "quote" }), depth);
      } else {
        blocks(n.content, kind, depth);
      }
      first = false;
    }
  };

  blocks(doc.content, () => PARAGRAPH, 0);
  return b.result();
}

/** Plain text (one paragraph per line) to an editor document. */
export function plainToDoc(text: string): DocNode {
  return {
    type: "doc",
    content: text.split("\n").map((line) => ({
      type: "paragraph",
      ...(line ? { content: [{ type: "text", text: line }] } : {}),
    })),
  };
}

/** Index of the line containing text position `index`. */
export function lineAt(rich: RichText, index: number): number {
  let line = 0;
  for (let i = 0; i < index && i < rich.text.length; i++) if (rich.text[i] === "\n") line++;
  return line;
}

/** The list marker or quote bar shown before a line (empty for paragraphs and headings). */
export function linePrefix(line: RichLine): string {
  if (line.continuation) return "";
  const k = line.kind;
  if (k.type === "bullet") return "  ".repeat(k.depth) + "• ";
  if (k.type === "ordered") return "  ".repeat(k.depth) + `${k.number}. `;
  return "";
}

const marksAt = (rich: RichText, i: number) =>
  i >= 0 && i < rich.text.length && rich.text[i] !== "\n" ? rich.marks[i] : undefined;

/**
 * Formatting for each UTF-16 unit of a correction. A replacement of [at, end) maps word by word
 * onto the text it replaces when both have as many words ("the *raport*" -> "The *report*"),
 * otherwise it takes the formatting where the replaced text starts. A pure insertion (no `end`)
 * continues the text before it, like typing would, but never extends a link or an underline.
 */
export function correctionMarks(rich: RichText, text: string, at: number, end?: number): RichMark[][] {
  if (end === undefined) {
    const neighbour = marksAt(rich, at - 1) ?? marksAt(rich, at) ?? [];
    const marks = neighbour.filter((m) => m.type !== "link" && m.type !== "underline");
    return Array.from({ length: text.length }, () => marks);
  }
  const fallback = marksAt(rich, at) ?? [];
  const words = (s: string) => s.split(/(\s+)/);
  const replaced = words(rich.text.slice(at, end));
  const replacement = words(text);
  if (replaced.length !== replacement.length) return Array.from({ length: text.length }, () => fallback);

  const out: RichMark[][] = [];
  let pos = at;
  replacement.forEach((part, i) => {
    const marks = marksAt(rich, pos) ?? fallback;
    for (let k = 0; k < part.length; k++) out.push(marks);
    pos += replaced[i].length;
  });
  return out;
}

/** A correction split into runs of identical formatting, for rendering. */
export function correctionRuns(rich: RichText, text: string, at: number, end?: number): { text: string; marks: RichMark[] }[] {
  const marks = correctionMarks(rich, text, at, end);
  const out: { text: string; marks: RichMark[] }[] = [];
  for (let i = 0; i < text.length; i++) {
    const last = out[out.length - 1];
    if (last && markKey(last.marks) === markKey(marks[i])) last.text += text[i];
    else out.push({ text: text[i], marks: marks[i] });
  }
  return out;
}

/** One step of rebuilding text from an original: keep a range of it, or insert text (replacing [at, end) if `end` is set). */
export type Piece = { keep: [number, number] } | { insert: string; at: number; end?: number };

/** Applies pieces to `src`: kept text keeps its formatting and lines; inserted text inherits formatting. */
export function compose(src: RichText, pieces: Piece[]): RichText {
  const lineStarts = [0];
  for (let i = 0; i < src.text.length; i++) if (src.text[i] === "\n") lineStarts.push(i + 1);
  const lineStartingAt = (i: number) => lineStarts.indexOf(i);

  const out = new Builder();
  out.lines.push(src.lines[0] ?? { kind: PARAGRAPH, continuation: false });

  for (const p of pieces) {
    if ("keep" in p) {
      for (let i = p.keep[0]; i < p.keep[1]; i++) {
        if (src.text[i] === "\n") {
          out.startLine(src.lines[lineStartingAt(i + 1)]?.kind ?? PARAGRAPH, src.lines[lineStartingAt(i + 1)]?.continuation);
        } else {
          out.text += src.text[i];
          out.marks.push(src.marks[i]);
        }
      }
    } else {
      const marks = correctionMarks(src, p.insert, p.at, p.end);
      for (let i = 0; i < p.insert.length; i++) {
        // A line break the model added starts a new line of the same kind
        if (p.insert[i] === "\n") out.startLine(out.lines[out.lines.length - 1].kind);
        else {
          out.text += p.insert[i];
          out.marks.push(marks[i]);
        }
      }
    }
  }
  return out.result();
}

const escapeHtml = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");


/** Splits [start, end) of `rich` into runs of identical formatting, stopping at line breaks. */
export function runs(rich: RichText, start: number, end: number): { text: string; marks: RichMark[]; start: number }[] {
  const out: { text: string; marks: RichMark[]; start: number }[] = [];
  for (let i = start; i < end; i++) {
    const ch = rich.text[i];
    const last = out[out.length - 1];
    if (ch !== "\n" && last && last.text !== "\n" && markKey(last.marks) === markKey(rich.marks[i])) last.text += ch;
    else out.push({ text: ch, marks: ch === "\n" ? [] : rich.marks[i], start: i });
  }
  return out;
}

function inlineHtml(rich: RichText, start: number, end: number): string {
  return runs(rich, start, end)
    .map((r) => {
      let html = escapeHtml(r.text);
      // Innermost first, so the link ends up outermost
      for (const type of [...MARK_TYPES].reverse()) {
        const m = r.marks.find((x) => x.type === type);
        if (!m) continue;
        const tag = { bold: "strong", italic: "em", underline: "u", strike: "s", code: "code", link: "a" }[type];
        html = type === "link" ? `<a href="${escapeHtml(m.href ?? "")}">${html}</a>` : `<${tag}>${html}</${tag}>`;
      }
      return html;
    })
    .join("");
}

/** HTML for the clipboard: paragraphs, headings, nested lists, quotes and inline formatting. */
export function toHtml(rich: RichText): string {
  const lineRanges: [number, number][] = [];
  let s = 0;
  for (let i = 0; i <= rich.text.length; i++) {
    if (i === rich.text.length || rich.text[i] === "\n") {
      lineRanges.push([s, i]);
      s = i + 1;
    }
  }

  let html = "";
  const openLists: ("ul" | "ol")[] = [];
  let openBlock = "";
  const closeBlock = () => {
    if (openBlock) html += `</${openBlock}>`;
    openBlock = "";
  };
  const closeListsTo = (depth: number) => {
    while (openLists.length > depth) {
      closeBlock();
      html += `</${openLists.pop()}>`;
    }
  };

  rich.lines.forEach((line, n) => {
    const content = inlineHtml(rich, ...lineRanges[n]);
    if (line.continuation && openBlock) {
      html += `<br>${content}`;
      return;
    }
    closeBlock();
    const k = line.kind;
    if (k.type === "bullet" || k.type === "ordered") {
      const tag = k.type === "bullet" ? "ul" : "ol";
      closeListsTo(k.depth + 1);
      if (openLists.length === k.depth + 1 && openLists[k.depth] !== tag) closeListsTo(k.depth);
      while (openLists.length < k.depth + 1) {
        html += k.type === "ordered" && openLists.length === k.depth ? `<ol start="${k.number}">` : `<${tag}>`;
        openLists.push(tag);
      }
      html += `<li>${content}`;
      openBlock = "li";
      return;
    }
    closeListsTo(0);
    if (k.type === "heading") {
      html += `<h${k.level}>${content}`;
      openBlock = `h${k.level}`;
    } else if (k.type === "quote") {
      html += `<blockquote>${content}`;
      openBlock = "blockquote";
    } else {
      html += `<p>${content}`;
      openBlock = "p";
    }
  });
  closeListsTo(0);
  closeBlock();
  return html;
}

/** Plain text for the clipboard, with list markers so lists survive pasting into plain fields. */
export function toPlainText(rich: RichText): string {
  return rich.text
    .split("\n")
    .map((line, n) => (rich.lines[n] ? linePrefix(rich.lines[n]) : "") + line)
    .join("\n");
}
