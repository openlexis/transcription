// Quick check of every compilation's output (reads the output only, plus an input line where a doubled word needs one).
//   bun run check
// 1. every printed word is read by at least one manuscript;  2. no doubled word that no manuscript has;
// 3. the shares of each place add up to 1;  4. the output's hash matches the one in stats.json.
import { createHash } from "node:crypto";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { greekKey, hebrewSpell } from "../src/text";

const t0 = performance.now();
const ROOT = new URL("..", import.meta.url).pathname;
type Word = { t: string; k: string; c?: number; p?: number; l?: number[]; d?: number[] };
type Line = { ref: string; uncovered?: boolean; witnesses: number[]; words?: Word[] };
type Place = { id: number; ref: string; at: number; n: number; readings: { keys: string; witnesses: number[]; share: number }[] };
const fails: string[] = [];
const cache = new Map<string, string[]>();
const lines = (f: string) => cache.get(f) ?? cache.set(f, readFileSync(`${ROOT}${f}`, "utf8").split("\n")).get(f)!;
let words = 0, places = 0, n = 0;
for (const d of readdirSync(`${ROOT}compilations`).sort()) {
  const dir = `${ROOT}compilations/${d}`;
  if (!existsSync(`${dir}/transcription.json`)) { fails.push(`${d}: no output`); continue; }
  n++;
  const tj = readFileSync(`${dir}/transcription.json`, "utf8"), dj = readFileSync(`${dir}/disagreements.json`, "utf8");
  const stats = JSON.parse(readFileSync(`${dir}/stats.json`, "utf8"));
  if (createHash("sha256").update(tj).update(dj).digest("hex") !== stats.sha256) fails.push(`${d}: hash differs from stats.json`);
  const T = JSON.parse(tj) as { book: string; language?: string; witnesses: { siglum: string; files: string[] }[]; lines: Line[] };
  const KEY = T.language === "Hebrew" ? hebrewSpell : greekKey;
  const P = (JSON.parse(dj) as { places: Place[] }).places;
  for (const p of P) {
    places++;
    const sum = p.readings.reduce((s, r) => s + r.share, 0);
    if (p.readings.length && Math.abs(sum - 1) > 0.002) fails.push(`${d} ${p.ref}: shares add up to ${sum}`);
  }
  for (const l of T.lines) {
    if (l.uncovered) continue;
    const ws = l.words!;
    ws.forEach((w, i) => {
      words++;
      if (w.p !== undefined) {
        const p = P[w.p], r = p?.readings[0];
        if (!r || !r.witnesses.length || r.keys.split(" ")[i - p.at] !== w.k) fails.push(`${d} ${l.ref}: word ${i + 1} (${w.t}) is not the reading of place ${w.p}`);
      } else {
        const out = new Set([...(w.l ?? []), ...(w.d ?? [])]);
        if (!l.witnesses.some((x) => !out.has(x))) fails.push(`${d} ${l.ref}: word ${i + 1} (${w.t}) has no manuscript`);
      }
      if (i && ws[i - 1].k === w.k && !(w.p !== undefined && w.p === ws[i - 1].p)) {
        // a doubled word across places: some manuscript of the line must have it doubled
        const has = l.witnesses.some((x) => T.witnesses[x].files.some((f) => lines(f).some((ln) => {
          if (!ln.startsWith(`${T.book} ${l.ref}\t`)) return false;
          const ks = ln.split("\t")[1].split(" ").filter((q) => q !== "…").map(KEY);
          return ks.some((k, j) => j && k === w.k && ks[j - 1] === w.k);
        })));
        if (!has) fails.push(`${d} ${l.ref}: doubled word ${w.t} that no manuscript has`);
      }
    });
  }
}
const ms = ((performance.now() - t0) / 1000).toFixed(2);
if (fails.length) { console.log(fails.slice(0, 50).join("\n")); console.log(`FAILED: ${fails.length} problems (${n} compilations, ${ms} s)`); process.exit(1); }
console.log(`OK: ${n} compilations, ${words} words, ${places} places checked in ${ms} s`);
