// Writes the data the browser loads on demand, for every output artifact in outputs/<specification>/<compiler>/:
//   public/data/<artifact>/<book>/w.json            the manuscripts: date, reliability, the holders' files and viewers
//   public/data/<artifact>/<book>/<chapter>.json    each line: every manuscript's own words, lined up by column
//   public/data/<artifact>/<book>/places.json       the places where the manuscripts differ, for the list of disagreements
// Each manuscript's words come from the transcription the artifact names for the line; each word gets a mark that says how
// it compares with the printed word in its column, by the same spelling keys the compiler used.
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { greekKey, hebrewSpell } from "../src/text";
import { artifacts, book, holderFile, type Line } from "./src/lib/data";

const ROOT = new URL("../", import.meta.url).pathname;
const OUT = new URL("./public/data/", import.meta.url).pathname;
rmSync(OUT, { recursive: true, force: true });
const fileLines = new Map<string, string[]>();
const lineOf = (f: string, n: number) => { if (!fileLines.has(f)) { if (fileLines.size > 400) fileLines.clear(); fileLines.set(f, existsSync(`${ROOT}${f}`) && f.endsWith(".txt") ? readFileSync(`${ROOT}${f}`, "utf8").split("\n") : []); } return fileLines.get(f)![n - 1] ?? ""; };
let files = 0;
for (const a of artifacts()) {
  for (const e of a.manifest.books) {
    const B = book(a, e.id), KEY = B.language.startsWith("Hebrew") ? hebrewSpell : greekKey;
    const dir = `${OUT}${a.slug}/${e.id}`;
    mkdirSync(dir, { recursive: true });
    const W = B.witnesses.map((w) => ({
      s: w.siglum, ...(w.leaves ? { lv: w.leaves } : {}), n: w.name ?? "", k: w.kind, dt: w.date, e: w.early ? 1 : 0, r: w.reliability, v: w.viewer,
      f: w.files.map((f) => { const h = holderFile(f); return h ? [h.holderName, h.source, h.format ?? "", h.member ?? "", h.license] : ["", "", "", "", ""]; }),
    }));
    writeFileSync(`${dir}/w.json`, JSON.stringify({ settings: B.settings, w: W })); files++;
    const byCh = new Map<string, Line[]>();
    for (const l of B.lines) { const c = l.ref.split(":")[0]; (byCh.get(c) ?? byCh.set(c, []).get(c)!).push(l); }
    const byRef = new Map<string, number[]>();
    for (const p of B.places) if (!p.lost) (byRef.get(p.ref) ?? byRef.set(p.ref, []).get(p.ref)!).push(p.id);
    for (const [ch, ls] of byCh) {
      const placeIds = new Set<number>();
      const lines = ls.map((l) => {
        if (l.uncovered || !l.g) return { r: l.ref, u: 1, m: l.witnesses };
        const nC = l.g[0].length, printed: (string | null)[] = new Array(nC).fill(null);
        for (const w of l.words ?? []) printed[w.x] = w.k;
        const ps = byRef.get(l.ref) ?? []; for (const id of ps) placeIds.add(id);
        // each manuscript's words, in column order, and how each column compares with the printed word there:
        // = same word and spelling, s same word spelled otherwise, x another word, + a word where nothing is printed,
        // - no word where a word is printed, 0 nothing in either, ? lost in this manuscript
        const rows = l.witnesses.map((m, i) => {
          const [fi, ln] = (l.src![i] ?? "0:0").split(":").map(Number);
          const text = lineOf(B.witnesses[m].files[fi], ln).split("\t")[1] ?? "";
          const toks = text === "-" ? [] : text.split(" ").filter((t) => t && t !== "…");
          let j = 0; const cells: string[] = []; let st = "";
          for (let c = 0; c < nC; c++) {
            const g = l.g![i][c];
            if (g === "w") { const t = toks[j++] ?? ""; const k = KEY(t); cells.push(t); st += printed[c] === null ? "+" : k !== printed[c] ? "x" : "="; }
            else { cells.push(""); st += g === "?" ? "?" : printed[c] === null ? "0" : "-"; }
          }
          return [cells.join(" "), st];
        });
        return { r: l.ref, m: l.witnesses, ...(l.aramaic ? { ar: l.aramaic } : {}), w: (l.words ?? []).map((w) => [w.t, w.x, w.c ?? 1, w.lo ?? 0, w.hi ?? 1, w.p ?? -1, w.d ?? 0, w.l ?? 0]), ps, rows };
      });
      const places = Object.fromEntries([...placeIds].map((id) => { const p = B.places[id]; return [id, { cols: p.cols, c: p.confidence, rd: p.readings.map((r) => [r.text, r.p, r.lo, r.hi, r.witnesses, r.partly ?? [], r.xs]), lost: p.lostEverywhere, pl: p.partlyLost ?? [] }]; }));
      writeFileSync(`${dir}/${ch}.json`, JSON.stringify({ lines, places })); files++;
    }
    const sig = (i: number) => B.witnesses[i].siglum;
    writeFileSync(`${dir}/places.json`, JSON.stringify(B.places.filter((p) => !p.lost).map((p) => [p.id, p.ref, p.readings.map((r) => { const all = [...r.witnesses, ...(r.partly ?? [])]; return [r.text, r.p, r.lo, r.hi, all.length, all.slice(0, 12).map(sig).join(" ")]; })]))); files++;
  }
}
writeFileSync(`${OUT}index.json`, JSON.stringify(artifacts().map((a) => ({ slug: a.slug, isDefault: a.isDefault, books: a.manifest.books.map((b) => ({ id: b.id, name: b.name, section: b.section })) }))));
console.log(`prepared ${artifacts().length} artifact(s), ${files} data files`);
