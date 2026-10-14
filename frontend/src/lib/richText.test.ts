/// <reference types="node" />
import assert from "node:assert/strict";
import { test } from "node:test";
import { compose, fromDoc, plainToDoc, toHtml, toPlainText, type DocNode, type Piece } from "./richText.ts";

const t = (text: string, ...marks: string[]): DocNode => ({ type: "text", text, marks: marks.map((type) => ({ type })) });
const p = (...content: DocNode[]): DocNode => ({ type: "paragraph", content });

// A message as it arrives from Outlook or Teams: bold, a link, a hard line break and a list
const doc: DocNode = {
  type: "doc",
  content: [
    p(t("Hi "), t("Tom", "bold"), t(","), { type: "hardBreak" }, t("the "), t("raport", "italic"), t(" are ready.")),
    {
      type: "bulletList",
      content: [
        { type: "listItem", content: [p(t("check the "), { type: "text", text: "figures", marks: [{ type: "link", attrs: { href: "https://x.test" } }] })] },
        { type: "listItem", content: [p(t("send it"))] },
      ],
    },
  ],
};

test("plain text keeps line structure and every character has its formatting", () => {
  const rich = fromDoc(doc);
  assert.equal(rich.text, "Hi Tom,\nthe raport are ready.\ncheck the figures\nsend it");
  assert.equal(rich.marks.length, rich.text.length);
  assert.deepEqual(rich.marks[3], [{ type: "bold" }]);
  assert.deepEqual(
    rich.lines.map((l) => [l.kind.type, l.continuation]),
    [["paragraph", false], ["paragraph", true], ["bullet", false], ["bullet", false]]
  );
});

test("corrections take the formatting of the text they replace", () => {
  const rich = fromDoc(doc);
  const at = rich.text.indexOf("raport");
  const are = rich.text.indexOf("are");
  const pieces: Piece[] = [
    { keep: [0, at] },
    { insert: "report", at, end: at + 6 },
    { keep: [at + 6, are] },
    { insert: "is", at: are, end: are + 3 },
    { keep: [are + 3, rich.text.length] },
  ];
  const out = compose(rich, pieces);
  assert.equal(out.text, "Hi Tom,\nthe report is ready.\ncheck the figures\nsend it");
  assert.deepEqual(out.marks[out.text.indexOf("report")], [{ type: "italic" }], "report stays italic");
  assert.deepEqual(out.marks[out.text.indexOf("is ready")], [], "is stays plain");
  assert.deepEqual(out.lines, rich.lines, "line structure is unchanged");
});

test("an insertion continues the text before it but never extends a link", () => {
  const rich = fromDoc(doc);
  const afterLink = rich.text.indexOf("figures") + "figures".length;
  const out = compose(rich, [{ keep: [0, afterLink] }, { insert: ".", at: afterLink }, { keep: [afterLink, rich.text.length] }]);
  assert.deepEqual(out.marks[afterLink], []);
  const afterTom = rich.text.indexOf("Tom") + 3;
  const bold = compose(rich, [{ keep: [0, afterTom] }, { insert: "!", at: afterTom }, { keep: [afterTom, rich.text.length] }]);
  assert.deepEqual(bold.marks[afterTom], [{ type: "bold" }]);
});

test("a multi-word replacement keeps each word's formatting", () => {
  const rich = fromDoc(doc);
  const at = rich.text.indexOf("the raport");
  const end = at + "the raport".length;
  const out = compose(rich, [{ keep: [0, at] }, { insert: "The report", at, end }, { keep: [end, rich.text.length] }]);
  assert.deepEqual(out.marks[at], [], "The stays plain");
  assert.deepEqual(out.marks[at + 4], [{ type: "italic" }], "report stays italic");
  // Different word counts fall back to the formatting where the replaced text starts
  const merged = compose(rich, [{ keep: [0, at] }, { insert: "Theraport", at, end }, { keep: [end, rich.text.length] }]);
  assert.deepEqual(merged.marks[at + 4], []);
});

test("an inserted full stop does not extend an underline", () => {
  const rich = fromDoc({ type: "doc", content: [p(t("see "), t("section two", "underline"))] });
  const out = compose(rich, [{ keep: [0, rich.text.length] }, { insert: ".", at: rich.text.length }]);
  assert.deepEqual(out.marks[out.text.length - 1], []);
});

test("html keeps formatting, line breaks and lists", () => {
  assert.equal(
    toHtml(fromDoc(doc)),
    '<p>Hi <strong>Tom</strong>,<br>the <em>raport</em> are ready.</p>' +
      '<ul><li>check the <a href="https://x.test">figures</a></li><li>send it</li></ul>'
  );
});

test("ordered and nested lists, headings and escaping", () => {
  const nested: DocNode = {
    type: "doc",
    content: [
      { type: "heading", attrs: { level: 2 }, content: [t("Plan <A&B>")] },
      {
        type: "orderedList",
        attrs: { start: 1 },
        content: [
          { type: "listItem", content: [p(t("one")), { type: "bulletList", content: [{ type: "listItem", content: [p(t("sub"))] }] }] },
          { type: "listItem", content: [p(t("two"))] },
        ],
      },
    ],
  };
  const rich = fromDoc(nested);
  assert.equal(toPlainText(rich), "Plan <A&B>\n1. one\n  • sub\n2. two");
  assert.equal(
    toHtml(rich),
    '<h2>Plan &lt;A&amp;B&gt;</h2><ol start="1"><li>one</li><ul><li>sub</li></ul><li>two</li></ol>'
  );
});

test("plain text round-trips through an editor document", () => {
  assert.equal(fromDoc(plainToDoc("first\n\nthird")).text, "first\n\nthird");
  assert.equal(fromDoc({ type: "doc", content: [] }).text, "");
});
