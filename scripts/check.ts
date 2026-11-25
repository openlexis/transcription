// Quick check of every output artifact in outputs/<specification>/<compiler>/ (reads the outputs, and an input line only
// where a doubled word needs one).
//   bun run check
// 1. there is exactly one specification file and no other rule file;  2. each artifact is filed under its specification's
// hash and its compiler, records who did the work and its method, and each book file matches the hash in compilation.json;
// 3. every printed word is read by at least one manuscript;  4. no doubled word that no manuscript has;  5. every probability
// lies between 0 and 1 inside its uncertainty range;  6. each line's alignment rows match the line.
import { createHash } from "node:crypto";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { greekKey, hebrewSpell } from "./lib/text";

const t0 = performance.now();
const ROOT = new URL("..", import.meta.url).pathname;
const sha = (x: string | Buffer) => createHash("sha256").update(x).digest("hex");
const fails: string[] = [];
const cache = new Map<string, string[]>();
const lines = (f: string) => cache.get(f) ?? cache.set(f, existsSync(`${ROOT}${f}`) ? readFileSync(`${ROOT}${f}`, "utf8").split("\n") : []).get(f)!;
const ruleFiles = (dir: string): string[] => readdirSync(dir, { withFileTypes: true }).flatMap((e) => e.isDirectory() ? (["node_modules", ".git", "www", "src", "transcriptions", "outputs"].includes(e.name) ? [] : ruleFiles(`${dir}/${e.name}`)) : /^(RULES|SPECIFICATION).*\.(md|json|ya?ml|txt|xml|toml)$/i.test(e.name) ? [`${dir}/${e.name}`.slice(ROOT.length)] : []);
const found = ruleFiles(ROOT.replace(/\/$/, ""));
if (found.length !== 1 || found[0] !== "SPECIFICATION.md") fails.push(`specification files: expected only SPECIFICATION.md, found ${found.join(", ") || "none"}`);
const SPEC_SHA = sha(readFileSync(`${ROOT}SPECIFICATION.md`));
let artifacts = 0, current = 0, books = 0, words = 0, places = 0;
const ok01 = (x: unknown) => typeof x === "number" && x >= 0 && x <= 1;
for (const spec of existsSync(`${ROOT}outputs`) ? readdirSync(`${ROOT}outputs`).sort() : []) for (const comp of readdirSync(`${ROOT}outputs/${spec}`).sort()) {
  const dir = `${ROOT}outputs/${spec}/${comp}`, at = `outputs/${spec}/${comp}`;
  if (!existsSync(`${dir}/compilation.json`)) { fails.push(`${at}: no compilation.json`); continue; }
  artifacts++;
  const M = JSON.parse(readFileSync(`${dir}/compilation.json`, "utf8"));
  if (M.specification?.sha256?.slice(0, 12) !== spec) fails.push(`${at}: filed under the wrong specification hash`);
  if (M.specification?.sha256 === SPEC_SHA) current++;
  if (M.compiler?.id !== comp || !(M.compiler.program || M.compiler.model)) fails.push(`${at}: the compiler does not identify itself as ${comp}`);
  if (!M.method?.text) fails.push(`${at}: no method`);
  for (const b of M.books ?? []) {
    books++;
    const raw = readFileSync(`${dir}/${b.file}`, "utf8");
    if (sha(raw) !== b.sha256) fails.push(`${at} ${b.id}: file differs from its hash in compilation.json`);
    const B = JSON.parse(raw), HEB = String(B.language).startsWith("Hebrew"), KEY = HEB ? hebrewSpell : greekKey;
    const P = B.places as { id: number; at: number; n: number; confidence: number; readings: { keys: string; witnesses: number[]; p: number; lo: number; hi: number }[] }[];
    for (const p of P) { places++; for (const r of p.readings) if (!ok01(r.p) || r.lo > r.p + 1e-9 || r.hi < r.p - 1e-9) fails.push(`${at} ${b.id} place ${p.id}: probability out of range`); }
    for (const l of B.lines as { ref: string; uncovered?: boolean; witnesses: number[]; g?: string[]; words?: { t: string; k: string; c?: number; lo?: number; hi?: number; p?: number; l?: number[]; d?: number[]; x?: number }[] }[]) {
      if (l.uncovered) continue;
      const ws = l.words!, g = l.g;
      if (!g || g.length !== l.witnesses.length || new Set(g.map((r) => r.length)).size > 1 || ws.some((w) => w.x === undefined || w.x >= (g[0]?.length ?? 0))) fails.push(`${at} ${b.id} ${l.ref}: alignment rows do not match the line`);
      ws.forEach((w, i) => {
        words++;
        if (!ok01(w.c) || (w.lo ?? 0) > (w.c ?? 0) + 1e-9 || (w.hi ?? 1) < (w.c ?? 0) - 1e-9) fails.push(`${at} ${b.id} ${l.ref}: word ${i + 1} probability out of range`);
        if (w.p !== undefined) {
          const p = P[w.p], r = p?.readings[0];
          if (!r || !r.witnesses.length || r.keys.split(" ")[i - p.at] !== w.k) fails.push(`${at} ${b.id} ${l.ref}: word ${i + 1} (${w.t}) is not the printed reading of its place`);
        } else {
          const out = new Set([...(w.l ?? []), ...(w.d ?? [])]);
          if (!l.witnesses.some((x) => !out.has(x))) fails.push(`${at} ${b.id} ${l.ref}: word ${i + 1} (${w.t}) has no manuscript`);
        }
        if (i && ws[i - 1].k === w.k && !(w.p !== undefined && w.p === ws[i - 1].p)) {
          const files = l.witnesses.flatMap((x) => (B.witnesses[x].files as string[]) ?? []);
          if (files.some((f) => existsSync(`${ROOT}${f}`))) {
            const has = l.witnesses.some((x) => (B.witnesses[x].files as string[]).some((f) => lines(f).some((ln) => {
              if (!ln.startsWith(`${B.book} ${l.ref}\t`)) return false;
              const ks = ln.split("\t")[1].split(" ").filter((q) => q !== "…").map(KEY);
              return ks.some((k, j) => j && k === w.k && ks[j - 1] === w.k);
            })));
            if (!has) fails.push(`${at} ${b.id} ${l.ref}: doubled word ${w.t} that no manuscript has`);
          }
        }
      });
    }
  }
}
if (!current) fails.push("no artifact is filed under the current SPECIFICATION.md");
const s = ((performance.now() - t0) / 1000).toFixed(2);
if (fails.length) { console.log(fails.slice(0, 50).join("\n")); console.log(`FAILED: ${fails.length} problems (${artifacts} artifacts, ${s} s)`); process.exit(1); }
console.log(`OK: one specification; ${artifacts} artifact(s), ${current} under the current specification; ${books} books, ${words} words, ${places} places checked in ${s} s`);
