/**
 * End-to-end eval of POST /api/rephrase: response time and shape of the alternatives.
 *
 *   tsx eval/rephrase-eval.ts --target new=http://localhost:3000 [--target "old=http://localhost:3001|gemini-3.1-flash-lite"]
 *                             [--model auto] [--reps 1] [--pace 0] [--out results.json] [--token <PocketBase token>]
 *
 * Same conventions as check-eval.ts: targets alternate case by case, --pace spaces out call starts.
 * A target can pin its own model after "|"; otherwise --model (or the server default) applies.
 */
import { writeFileSync } from "node:fs";
import { parseArgs } from "node:util";
import { CASES } from "./cases.js";

const { values } = parseArgs({
  options: {
    target: { type: "string", multiple: true },
    model: { type: "string" },
    reps: { type: "string", default: "1" },
    pace: { type: "string", default: "0" },
    out: { type: "string" },
    token: { type: "string", default: "eval" },
  },
});

const targets = (values.target ?? ["new=http://localhost:3000"]).map((t) => {
  const [label, rest] = t.split("=");
  const [url, model] = rest.split("|");
  return { label, url: url.replace(/\/$/, ""), model: model ?? values.model };
});
const paceMs = Number(values.pace) * 1000;
let lastStart = 0;

type Alternative = { text?: string; description?: string; changesOverview?: string };
type Result = {
  target: string;
  caseId: string;
  rep: number;
  ok: boolean;
  error?: string;
  retries: number;
  seconds?: number;
  model?: string;
  alternatives?: number;
  distinct?: number;
  sameAsInput?: number;
  withNotes?: number;
  rightScript?: boolean;
};

const TRANSIENT = /503|UNAVAILABLE|429|RESOURCE_EXHAUSTED|high demand|overloaded|fetch failed/i;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, Math.max(0, ms)));
const norm = (s = "") => s.toLowerCase().replace(/[\s\p{P}]+/gu, " ").trim();

/** Non-Latin languages in the test set must come back in their own script. */
const SCRIPTS: Record<string, RegExp> = { Japanese: /[\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Han}]/u };

const results: Result[] = [];
for (let rep = 0; rep < Number(values.reps); rep++) {
  for (const [i, c] of CASES.entries()) {
    const order = targets.map((_, k) => targets[(k + i + rep) % targets.length]);
    for (const t of order) {
      const r: Result = { target: t.label, caseId: c.id, rep, ok: false, retries: 0 };
      for (let attempt = 0; ; attempt++) {
        await sleep(lastStart + paceMs - performance.now());
        lastStart = performance.now();
        const t0 = performance.now();
        try {
          const res = await fetch(`${t.url}/api/rephrase`, {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${values.token}` },
            body: JSON.stringify({ text: c.text, language: c.language, ...(t.model ? { model: t.model } : {}) }),
          });
          const body = await res.text();
          if (!res.ok) throw new Error(`HTTP ${res.status}: ${body.slice(0, 200)}`);
          const alts: Alternative[] = JSON.parse(body).alternatives ?? [];
          const script = SCRIPTS[c.language];
          Object.assign(r, {
            ok: true,
            retries: attempt,
            seconds: (performance.now() - t0) / 1000,
            model: res.headers.get("x-model") ?? undefined,
            alternatives: alts.length,
            distinct: new Set(alts.map((a) => norm(a.text))).size,
            sameAsInput: alts.filter((a) => norm(a.text) === norm(c.text)).length,
            withNotes: alts.filter((a) => a.description?.trim() && a.changesOverview?.trim()).length,
            rightScript: script ? alts.every((a) => script.test(a.text ?? "")) : undefined,
          });
          break;
        } catch (e) {
          r.error = String(e).slice(0, 300);
          if (attempt >= 3 || !TRANSIENT.test(r.error)) break;
          await sleep(15_000 * (attempt + 1));
        }
      }
      if (r.ok) delete r.error;
      results.push(r);
      console.log(
        `${t.label.padEnd(5)} ${c.id.padEnd(16)} rep${rep} ` +
          (r.ok
            ? `${r.seconds!.toFixed(1).padStart(5)}s ${r.alternatives} alts, ${r.distinct} distinct, notes ${r.withNotes}/${r.alternatives}` +
              (r.rightScript === undefined ? "" : ` script ${r.rightScript}`) +
              (r.model ? ` [${r.model}]` : "")
            : `ERROR ${r.error}`)
      );
    }
  }
}

if (values.out) writeFileSync(values.out, JSON.stringify(results, null, 1));

const quantile = (xs: number[], q: number) => {
  const s = [...xs].sort((a, b) => a - b);
  return s.length ? s[Math.min(s.length - 1, Math.floor(q * s.length))] : NaN;
};
const sum = (xs: (number | undefined)[]) => xs.reduce<number>((a, b) => a + (b ?? 0), 0);

console.log("\nSummary (" + (values.model ?? "server default") + ")");
console.table(
  targets.map(({ label }) => {
    const rs = results.filter((r) => r.target === label);
    const ok = rs.filter((r) => r.ok);
    const secs = ok.map((r) => r.seconds!);
    const scripted = ok.filter((r) => r.rightScript !== undefined);
    return {
      target: label,
      "ok/calls": `${ok.length}/${rs.length}`,
      "median s": quantile(secs, 0.5).toFixed(1),
      "p90 s": quantile(secs, 0.9).toFixed(1),
      "5 alts": `${ok.filter((r) => r.alternatives === 5).length}/${ok.length}`,
      "all distinct": `${ok.filter((r) => r.distinct === r.alternatives).length}/${ok.length}`,
      "copies input": sum(ok.map((r) => r.sameAsInput)),
      notes: `${sum(ok.map((r) => r.withNotes))}/${sum(ok.map((r) => r.alternatives))}`,
      "right script": scripted.length ? `${scripted.filter((r) => r.rightScript).length}/${scripted.length}` : "-",
      retries: sum(rs.map((r) => r.retries)),
    };
  })
);
