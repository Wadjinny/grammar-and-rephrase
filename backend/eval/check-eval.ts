/**
 * End-to-end eval of POST /api/check: response time and correction quality.
 *
 *   tsx eval/check-eval.ts --target new=http://localhost:3000 [--target old=http://localhost:3001]
 *                          [--model gemini-3.1-flash-lite] [--reps 2] [--pace 13] [--only opt-] [--out results.json] [--token <PocketBase token>]
 *
 * --only limits the run to cases whose id starts with a prefix (e.g. "opt-" for the check options).
 * --pace is the minimum number of seconds between call starts, to stay under per-minute rate limits
 * (13s keeps Cerebras' free tier under 5 requests/minute).
 *
 * With several targets, calls alternate between them case by case, so both see the same API conditions.
 */
import { writeFileSync } from "node:fs";
import { parseArgs } from "node:util";
import { CASES, type EvalCase } from "./cases.js";

const { values } = parseArgs({
  options: {
    target: { type: "string", multiple: true },
    model: { type: "string", default: "gemini-3.1-flash-lite" },
    reps: { type: "string", default: "2" },
    pace: { type: "string", default: "0" },
    out: { type: "string" },
    token: { type: "string", default: "eval" },
    only: { type: "string" },
  },
});
const cases = CASES.filter((c) => !values.only || c.id.startsWith(values.only));

const targets = (values.target ?? ["new=http://localhost:3000"]).map((t) => {
  const [label, url] = t.split("=");
  return { label, url: url.replace(/\/$/, "") };
});
const reps = Number(values.reps);
const paceMs = Number(values.pace) * 1000;
let lastStart = 0;

type Segment = { type: "unmodified" | "deleted" | "inserted"; text: string; reason?: string };
type CheckResponse = { correctedText: string; score: number; segments: Segment[]; explanations: unknown[] };

type Result = {
  target: string;
  caseId: string;
  rep: number;
  ok: boolean;
  error?: string;
  retries: number;
  seconds?: number;
  bytes?: number;
  fixesHit?: number;
  fixesTotal?: number;
  errorsLeft?: number;
  cleanChanged?: boolean;
  diffValid?: boolean;
  changes?: number;
  changesWithReason?: number;
  explanations?: number;
  endingOk?: boolean;
  score?: number;
  correctedText?: string;
};

const TRANSIENT = /503|UNAVAILABLE|429|RESOURCE_EXHAUSTED|high demand|overloaded|fetch failed/i;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, Math.max(0, ms)));

async function callCheck(url: string, c: EvalCase): Promise<{ data: CheckResponse; seconds: number; bytes: number; retries: number }> {
  for (let attempt = 0; ; attempt++) {
    await sleep(lastStart + paceMs - performance.now());
    lastStart = performance.now();
    const t0 = performance.now();
    let message: string;
    try {
      const res = await fetch(`${url}/api/check`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${values.token}` },
        body: JSON.stringify({ text: c.text, language: c.language, model: values.model, options: c.options }),
      });
      const body = await res.text();
      const seconds = (performance.now() - t0) / 1000;
      if (res.ok) return { data: JSON.parse(body), seconds, bytes: body.length, retries: attempt };
      message = `HTTP ${res.status}: ${body.slice(0, 200)}`;
    } catch (e) {
      message = String(e);
    }
    if (attempt >= 3 || !TRANSIENT.test(message)) throw new Error(message);
    await sleep(15_000 * (attempt + 1));
  }
}

// Typographic quotes are as correct as straight ones ("didn’t" vs "didn't")
const plainQuotes = (s: string) => s.replace(/[\u2018\u2019]/g, "'").replace(/[\u201C\u201D]/g, '"');

function score(c: EvalCase, data: CheckResponse): Partial<Result> {
  const corrected = plainQuotes(data.correctedText ?? "");
  const segs = data.segments ?? [];
  const join = (skip: Segment["type"]) => segs.filter((s) => s.type !== skip).map((s) => s.text).join("");
  const changes = segs.filter((s, i) => s.type === "inserted" || (s.type === "deleted" && segs[i + 1]?.type !== "inserted"));
  return {
    fixesHit: (c.fixes ?? []).filter((alts) => alts.some((a) => corrected.includes(a))).length,
    fixesTotal: (c.fixes ?? []).length,
    errorsLeft: (c.errors ?? []).filter((e) => corrected.includes(e)).length,
    cleanChanged: c.clean ? corrected.trim() !== plainQuotes(c.text).trim() : undefined,
    diffValid: join("inserted") === c.text && join("deleted") === data.correctedText,
    changes: changes.length,
    changesWithReason: changes.filter((s) => s.reason && s.reason.trim()).length,
    explanations: (data.explanations ?? []).length,
    endingOk: c.endsWith ? c.endsWith.some((e) => corrected.trimEnd().endsWith(e)) : undefined,
    score: data.score,
    correctedText: data.correctedText,
  };
}

const results: Result[] = [];
for (let rep = 0; rep < reps; rep++) {
  for (const [i, c] of cases.entries()) {
    // Rotate which target goes first so neither always gets the warmer slot
    const order = targets.map((_, k) => targets[(k + i + rep) % targets.length]);
    for (const t of order) {
      const r: Result = { target: t.label, caseId: c.id, rep, ok: false, retries: 0 };
      try {
        const { data, seconds, bytes, retries } = await callCheck(t.url, c);
        Object.assign(r, { ok: true, seconds, bytes, retries }, score(c, data));
      } catch (e) {
        r.error = String(e).slice(0, 300);
      }
      results.push(r);
      console.log(
        `${t.label.padEnd(5)} ${c.id.padEnd(16)} rep${rep} ` +
          (r.ok
            ? `${r.seconds!.toFixed(1).padStart(5)}s fixes ${r.fixesHit}/${r.fixesTotal} left ${r.errorsLeft} valid ${r.diffValid} reasons ${r.changesWithReason}/${r.changes}` +
              (r.endingOk === undefined ? "" : ` ending ${r.endingOk}`)
            : `ERROR ${r.error}`)
      );
    }
  }
}

if (values.out) writeFileSync(values.out, JSON.stringify(results, null, 1));

const pct = (a: number, b: number) => (b ? `${Math.round((100 * a) / b)}%` : "-");
const quantile = (xs: number[], q: number) => {
  const s = [...xs].sort((a, b) => a - b);
  return s.length ? s[Math.min(s.length - 1, Math.floor(q * s.length))] : NaN;
};
const sum = (xs: (number | undefined)[]) => xs.reduce<number>((a, b) => a + (b ?? 0), 0);

console.log("\nSummary (" + values.model + ")");
const rows = targets.map(({ label }) => {
  const rs = results.filter((r) => r.target === label);
  const ok = rs.filter((r) => r.ok);
  const secs = ok.map((r) => r.seconds!);
  const clean = ok.filter((r) => r.cleanChanged !== undefined);
  const endings = ok.filter((r) => r.endingOk !== undefined);
  return {
    target: label,
    "ok/calls": `${ok.length}/${rs.length}`,
    "median s": quantile(secs, 0.5).toFixed(1),
    "p90 s": quantile(secs, 0.9).toFixed(1),
    "mean s": (sum(secs) / (secs.length || 1)).toFixed(1),
    "fix recall": pct(sum(ok.map((r) => r.fixesHit)), sum(ok.map((r) => r.fixesTotal))),
    "errors left": sum(ok.map((r) => r.errorsLeft)),
    "clean changed": `${clean.filter((r) => r.cleanChanged).length}/${clean.length}`,
    "diff valid": pct(ok.filter((r) => r.diffValid).length, ok.length),
    "reasons": pct(sum(ok.map((r) => r.changesWithReason)), sum(ok.map((r) => r.changes))),
    ending: endings.length ? `${endings.filter((r) => r.endingOk).length}/${endings.length}` : "-",
    retries: sum(rs.map((r) => r.retries)),
  };
});
console.table(rows);
