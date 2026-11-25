// The compiler: works toward the goal of SPECIFICATION.md (the one specification of this repository) for every book listed in
// transcriptions/books.json, by the method it describes in scripts/METHOD.md, and writes one output artifact:
//   outputs/<first 12 characters of the specification's SHA-256>/<compiler>/compilation.json   the method, who did the work, the books
//   outputs/<...>/<compiler>/books/<book>.json                                                   each book: text, evidence, estimates
//   bun run compile all          every book, one at a time
//   bun run compile Gen          one book (its identifier in books.json); the artifact's other books are kept
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { align } from "../src/align";
import { aramaic, greekKey, hebrewSpell, showGreek } from "../src/text";
import { betaDraw, loglik, posterior, prior, quantile, rng, type Unit, weights } from "../src/model";

const ROOT = new URL("..", import.meta.url).pathname;
const r4 = (x: number) => Math.round(x * 10000) / 10000;
const sha = (...xs: (string | Buffer)[]) => { const h = createHash("sha256"); for (const x of xs) h.update(x); return h.digest("hex"); };

// ---------- the specification, the books and the compiler's own settings ----------
export const SPEC_FILE = "SPECIFICATION.md", METHOD_FILE = "scripts/METHOD.md";
/** The compiler's settings for each section, explained in scripts/METHOD.md ("Dates and the prior"). They are this compiler's
 * choices, not requirements of the specification. */
const SETTINGS: Record<string, { origin: number; halfLife: number; lateAfter: number; undated: number }> = {
  ot: { origin: -400, halfLife: 100, lateAfter: 400, undated: 1500 },
  nt: { origin: 100, halfLife: 100, lateAfter: 400, undated: 1500 },
};
export type Book = { id: string; book: string; name: string; section: string; sectionName: string; language: string; origin: number; halfLife: number; lateAfter: number; undated: number; inputs: string[] };
export function readBooks() {
  const text = readFileSync(`${ROOT}${SPEC_FILE}`, "utf8");
  const B = JSON.parse(readFileSync(`${ROOT}transcriptions/books.json`, "utf8")) as { sections: Record<string, { name: string; languages: string; folders: string[] }>; books: { section: string; number: number; book: string; name: string }[] };
  // a book's inputs: every transcription in the inventory, in its section's folders, that holds a line of the book (by file path)
  const cat = JSON.parse(readFileSync(`${ROOT}transcriptions/manuscripts.json`, "utf8")) as { manuscripts: { transcriptions: { file: string }[] }[] };
  const holds = new Map<string, Set<string>>();
  for (const f of cat.manuscripts.flatMap((m) => m.transcriptions.map((t) => t.file))) {
    holds.set(f, new Set(readFileSync(`${ROOT}${f}`, "utf8").split("\n").map((l) => l.split(" ")[0]).filter(Boolean)));
  }
  const files = [...holds.keys()].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
  const books: Book[] = B.books.map(({ section, number, book, name }) => {
    const S = B.sections[section], P = SETTINGS[section];
    const inputs = S.folders.flatMap((d) => files.filter((f) => f.startsWith(`${d}/`) && holds.get(f)!.has(book)));
    return { id: `${section}-${String(number).padStart(2, "0")}-${book.toLowerCase()}`, book, name, section, sectionName: S.name, language: S.languages, ...P, inputs };
  });
  return { text, sha256: sha(text), books, sections: B.sections };
}

// ---------- who does the work: this program reports what it is, as it runs ----------
export function selfIdentify() {
  const git = (...a: string[]) => { const r = spawnSync("git", a, { cwd: ROOT }); return r.status === 0 ? r.stdout.toString().trim() : undefined; };
  const code = ["scripts/compile.ts", "scripts/METHOD.md", "src/align.ts", "src/model.ts", "src/text.ts"];
  const changed = git("status", "--porcelain", "--", ...code);
  return {
    program: "scripts/compile.ts",
    repository: git("remote", "get-url", "origin"),
    commit: git("rev-parse", "HEAD"),
    codeMatchesCommit: changed === undefined ? undefined : changed === "",
    codeSha256: sha(...code.map((f) => readFileSync(`${ROOT}${f}`))),
    runtime: typeof Bun !== "undefined" ? `Bun ${Bun.version}` : `Node ${process.version}`,
  };
}

// ---------- manuscripts ----------
type MsInfo = { siglum: string; yearFrom?: number; yearTo?: number; dateBasis?: string; kind?: string; language?: string; dateSource?: string; name?: string; shelfmark?: string; century?: string; year?: number; viewer?: { name: string; url: string }[]; transcriptions: { holder: string; file: string; source: string; license: string }[] };
const CAT = JSON.parse(readFileSync(`${ROOT}transcriptions/manuscripts.json`, "utf8")) as { holders: Record<string, { name: string; web: string; license: string }>; manuscripts: MsInfo[] };
const INFO = new Map(CAT.manuscripts.map((m) => [m.siglum, m]));
/** Leaves of one manuscript that were given separate numbers are one manuscript. */
export const SAME_MANUSCRIPT: Record<string, string> = { P67: "P64", P103: "P77" };

type Tok = { k: string; t: string; gap: boolean };
type LineText = { absent: boolean; words: Tok[]; gapEnd: boolean; file: string; lineNo: number };

/** A book, compiled. Where the model's choice at a place prints a word twice in a row across the place's edge and no manuscript
 * of the line has that word twice there, the columns are joined into one place and the book is compiled again (method,
 * section 2). */
export function compile(R: Book) {
  const force = new Map<string, [number, number][]>();
  for (let round = 0; ; round++) {
    const { result, doubles } = compileOnce(R, force);
    if (!doubles.size || round >= 5) return result;
    for (const [ref, xs] of doubles) force.set(ref, [...(force.get(ref) ?? []), ...xs]);
  }
}
function compileOnce(R: Book, force: Map<string, [number, number][]>) {
  const dbl = new Map<string, Set<string>>();
  const HEB = R.language.startsWith("Hebrew");
  const SHOW = HEB ? (w: string) => w : showGreek;
  /** only a continuous-text manuscript can show that a word is absent (method, section 2) */
  const partialKind = (s: string) => (INFO.get(s)?.kind ?? "continuous") !== "continuous";
  // read every input transcription; group them by manuscript (method, section 1)
  const byMs = new Map<string, { files: string[]; lines: Map<string, LineText[]> }>();
  for (const file of R.inputs) {
    const siglum0 = file.replace(/^.*\//, "").replace(/\.[^.]+\.txt$/, ""), siglum = SAME_MANUSCRIPT[siglum0] ?? siglum0;
    const ms = byMs.get(siglum) ?? { files: [], lines: new Map() }; byMs.set(siglum, ms); ms.files.push(file);
    const KEY = HEB ? hebrewSpell : greekKey;
    readFileSync(`${ROOT}${file}`, "utf8").split("\n").forEach((l, i) => {
      const m = l.match(/^(\S+) (\d+:\d+)\t(.*)$/); if (!m || m[1] !== R.book) return;
      const words: Tok[] = []; let gap = false, gapEnd = false;
      const parts = m[3].split(" ").filter(Boolean);
      if (m[3] === "-") { const x = ms.lines.get(m[2]) ?? []; x.push({ absent: true, words: [], gapEnd: false, file, lineNo: i + 1 }); ms.lines.set(m[2], x); return; }
      parts.forEach((p, j) => { if (p === "…") { if (j === parts.length - 1) gapEnd = true; else gap = true; return; } words.push({ k: KEY(p), t: p, gap }); gap = false; });
      const x = ms.lines.get(m[2]) ?? []; x.push({ absent: false, words, gapEnd, file, lineNo: i + 1 }); ms.lines.set(m[2], x);
    });
  }
  // the date used for order, and copies counted as early (method, section 3)
  const year = (s: string) => INFO.get(s)?.year ?? R.undated;
  const early = (s: string) => year(s) - R.origin <= R.lateAfter;
  // witnesses in alignment order: oldest first, then by siglum
  const sigla = [...byMs.keys()].sort((a, b) => year(a) - year(b) || (a < b ? -1 : a > b ? 1 : 0));
  const WIDX = new Map(sigla.map((s, i) => [s, i]));
  const witnesses = sigla.map((s) => {
    const i = INFO.get(SAME_MANUSCRIPT[s] ?? s) ?? INFO.get(s);
    const leaves = Object.entries(SAME_MANUSCRIPT).filter(([, v]) => v === s).map(([k]) => k);
    return { siglum: s, ...(leaves.length ? { leaves } : {}), kind: i?.kind ?? "continuous", name: i?.name, century: i?.century, dateSource: i?.dateSource, date: i?.yearFrom !== undefined ? { estimate: Math.round((i.yearFrom + i.yearTo!) / 2), margin: Math.round((i.yearTo! - i.yearFrom) / 2), from: i.yearFrom, to: i.yearTo, method: i.dateBasis ?? "not stated", source: i.dateSource } : { estimate: null, margin: null, method: "no date range given by the holder", source: i?.dateSource ?? null }, year: year(s), early: early(s), viewer: i?.viewer ?? [], files: byMs.get(s)!.files };
  });
  // the lines: every line any manuscript has, in chapter and line order
  const refs = [...new Set(sigla.flatMap((s) => [...byMs.get(s)!.lines.keys()]))].sort((a, b) => { const [x, y] = [a, b].map((r) => r.split(":").map(Number)); return x[0] - y[0] || x[1] - y[1]; });

  const lines: unknown[] = [], places: unknown[] = [], placeLine: number[] = [];
  const st = { lines: 0, uncovered: 0, words: 0, columns: 0, unanimous: 0, places: 0, confidenceSum: 0, witnessesPerLine: 0, arLines: 0, arWords: 0 };
  for (const ref of refs) {
    // of several transcriptions of one manuscript, the one with the most words in the line; a tie goes to the one listed first
    const present: { s: string; x: LineText }[] = [];
    for (const s of sigla) {
      const xs = byMs.get(s)!.lines.get(ref); if (!xs) continue;
      const order = byMs.get(s)!.files;
      const x = [...xs].sort((a, b) => b.words.length - a.words.length || order.indexOf(a.file) - order.indexOf(b.file))[0];
      if (!x.absent && !x.words.length) continue; // only a lacuna: the manuscript does not cover the line
      present.push({ s, x });
    }
    st.lines++;
    if (!present.some((p) => p.x.words.length)) { st.uncovered++; lines.push({ ref, uncovered: true, witnesses: present.map((p) => WIDX.get(p.s)) }); continue; }
    st.witnessesPerLine += present.length;
    // line up the words (method, section 2)
    const withWords = present.filter((p) => p.x.words.length);
    const cols = align(withWords.map((p) => p.x.words.map((w) => w.k)));
    const nC = cols.length;
    // what each manuscript reads at each column: a key, "" (no word: it does not have one here), or null (lost: no vote)
    const reads: (string | null)[][] = present.map((p) => {
      const wi = withWords.indexOf(p), out: (string | null)[] = new Array(nC).fill(""), partial = partialKind(p.s);
      if (wi < 0) return out; // the manuscript marks the line as not having it
      const at: number[] = []; cols.forEach((c, ci) => { const j = c.cells.get(wi); if (j !== undefined) at[j] = ci; });
      const ws = p.x.words;
      for (let j = 0; j < ws.length; j++) out[at[j]] = ws[j].k;
      for (let ci = 0; ci < nC; ci++) {
        if (cols[ci].cells.has(wi)) continue;
        let next = ws.findIndex((_, j) => at[j] > ci);
        const lostBefore = next >= 0 ? ws[next].gap : p.x.gapEnd;
        if (lostBefore || partial) out[ci] = null;
      }
      return out;
    });
    const form = (pi: number, ci: number) => { const wi = withWords.indexOf(present[pi]); const j = cols[ci].cells.get(wi); return j === undefined ? undefined : present[pi].x.words[j].t; };
    // variant columns: the manuscripts that cover the column do not all read the same
    // a column is a variant when, setting aside singular readings (one manuscript alone where another reading has two
    // or more), two or more different readings are left
    const variant = cols.map((_, ci) => {
      const n = new Map<string, number>(); for (const r of reads) { const k = r[ci]; if (k !== null) n.set(k, (n.get(k) ?? 0) + 1); }
      const most = Math.max(0, ...n.values());
      return [...n.values()].filter((c) => !(c === 1 && most >= 2)).length > 1;
    });
    // places. Neighbouring variant columns are one place; two places at most two columns apart that share a word
    // (a word moved) are one place with the columns between them
    let spans: [number, number][] = [];
    for (let ci = 0; ci < nC; ci++) if (variant[ci]) { const l = spans[spans.length - 1]; if (l && l[1] === ci - 1) l[1] = ci; else spans.push([ci, ci]); }
    const keysIn = (a: number, b: number) => new Set(reads.flatMap((r) => r.slice(a, b + 1)).filter((k): k is string => !!k));
    for (let i = 0; i + 1 < spans.length;) {
      const [a, b] = spans[i], [c, d] = spans[i + 1];
      if (c - b - 1 <= 2) { const A = keysIn(a, b), B = keysIn(c, d); if ([...A].some((k) => B.has(k))) { spans.splice(i, 2, [a, d]); continue; } }
      i++;
    }
    const sortW = (xs: number[]) => xs.map((pi) => WIDX.get(present[pi].s)!).sort((x, y) => x - y);
    type W = { t: string; k: string; c?: number; p?: number; l?: number[]; d?: number[]; col: number; span?: number };
    type Rd = { keys: string[]; forms: string[]; wits: number[]; segs: (string | null)[][]; partly: number[]; earliest: number };
    /** The printed line for a set of places. */
    const decide = (spans: [number, number][]) => {
      const words: W[] = [], local: Record<string, unknown>[] = [];
      let ci = 0;
      spans.forEach(([a, b], si) => {
        for (; ci < a; ci++) {
          // outside a place every covering manuscript reads alike, apart from singular readings
          const n = new Map<string, number>(); for (const r of reads) { const x = r[ci]; if (x !== null) n.set(x, (n.get(x) ?? 0) + 1); }
          const k = [...n].sort((x, y) => y[1] - x[1] || (x[0] < y[0] ? -1 : 1))[0]?.[0];
          if (!k) continue; // the word is in one manuscript alone: it is not printed
          const diff = present.map((_, pi) => pi).filter((pi) => reads[pi][ci] !== null && reads[pi][ci] !== k);
          const lost = present.map((_, pi) => pi).filter((pi) => reads[pi][ci] === null);
          const by = present.map((_, pi) => pi).filter((pi) => reads[pi][ci] === k).sort((x, y) => year(present[x].s) - year(present[y].s) || (present[x].s < present[y].s ? -1 : 1));
          words.push({ t: SHOW(form(by[0], ci)!), k, ...(lost.length ? { l: sortW(lost) } : {}), ...(diff.length ? { d: sortW(diff) } : {}), col: ci });
        }
        ci = b + 1;
        // each manuscript's reading of the place is its words across all the place's columns
        const rd = new Map<string, Rd>(); const partial: number[] = [];
        present.forEach((p, pi) => {
          const seg = reads[pi].slice(a, b + 1);
          if (seg.some((k) => k === null)) { partial.push(pi); return; }
          const keys = seg.filter((k): k is string => !!k), id = keys.join(" ");
          const r = rd.get(id) ?? { keys, forms: [], wits: [], segs: [], partly: [], earliest: Infinity }; rd.set(id, r);
          r.wits.push(pi); r.segs.push(seg); r.earliest = Math.min(r.earliest, year(p.s));
          if (!r.forms.length) r.forms = seg.map((_, j) => form(pi, a + j)).filter((x): x is string => !!x);
        });
        const all = [...rd.values()];
        if (!all.length) { // every manuscript is lost somewhere in the place: nothing is printed, and the place is listed
          local.push({ ref, at: words.length, n: 0, cols: [a, b], lost: true, readings: [], partlyLost: sortW(partial) });
          return;
        }
        // a manuscript with a lacuna in the place votes with the one reading that agrees with every word it keeps there
        const stillLost: number[] = [];
        for (const pi of partial) {
          const seg = reads[pi].slice(a, b + 1);
          const ok = all.filter((r) => r.segs.some((s) => seg.every((k, j) => k === null || k === s[j])));
          if (ok.length === 1) { ok[0].partly.push(pi); ok[0].earliest = Math.min(ok[0].earliest, year(present[pi].s)); } else stillLost.push(pi);
        }
        // the first order of the readings: most manuscripts, then the oldest; the model (section 3 of the method) orders them again
        const count = (r: Rd) => r.wits.length + r.partly.length, id = (r: Rd) => r.keys.join(" ");
        all.sort((x, y) => count(y) - count(x) || x.earliest - y.earliest || (id(x) < id(y) ? -1 : id(x) > id(y) ? 1 : 0));
        const chosen = all[0];
        const pl = local.length;
        local.push({
          ref, at: words.length, n: chosen.keys.length, cols: [a, b], confidence: 0, weight: 0,
          readings: all.map((r) => ({ text: r.forms.map(showGreek).join(" ") || "—", keys: id(r), xs: r.segs[0].map((k, j) => (k ? a + j : -1)).filter((x) => x >= 0), witnesses: sortW(r.wits), ...(r.partly.length ? { partly: sortW(r.partly) } : {}) })),
          ...(stillLost.length ? { partlyLost: sortW(stillLost) } : {}),
        });
        const pcols = chosen.segs[0].map((k, j) => (k ? a + j : -1)).filter((x) => x >= 0);
        chosen.keys.forEach((k, j) => words.push({ t: SHOW(chosen.forms[j] ?? k), k, c: 0, p: pl, col: pcols[j] ?? a, span: si }));
      });
      for (; ci < nC; ci++) {
        const n = new Map<string, number>(); for (const r of reads) { const x = r[ci]; if (x !== null) n.set(x, (n.get(x) ?? 0) + 1); }
        const k = [...n].sort((x, y) => y[1] - x[1] || (x[0] < y[0] ? -1 : 1))[0]?.[0];
        if (!k) continue;
        const diff = present.map((_, pi) => pi).filter((pi) => reads[pi][ci] !== null && reads[pi][ci] !== k);
        const lost = present.map((_, pi) => pi).filter((pi) => reads[pi][ci] === null);
        const by = present.map((_, pi) => pi).filter((pi) => reads[pi][ci] === k).sort((x, y) => year(present[x].s) - year(present[y].s) || (present[x].s < present[y].s ? -1 : 1));
        words.push({ t: SHOW(form(by[0], ci)!), k, ...(lost.length ? { l: sortW(lost) } : {}), ...(diff.length ? { d: sortW(diff) } : {}), col: ci });
      }
      return { words, local };
    };
    // joined places: where the printed line has the same word twice in a row across a place's edge and no manuscript of
    // the line has it twice there, the place is joined with its neighbour and decided again as one place
    const doubled = present.map((p) => new Set(p.x.words.map((w) => w.k).filter((k, j, a) => j > 0 && a[j - 1] === k)));
    dbl.set(ref, new Set(doubled.flatMap((x) => [...x])));
    // columns joined after an earlier round
    for (const [a0, b0] of force.get(ref) ?? []) {
      const touch = spans.filter(([a, b]) => !(b < a0 || a > b0));
      const lo = Math.min(a0, ...touch.map((x) => x[0])), hi = Math.max(b0, ...touch.map((x) => x[1]));
      spans = [...spans.filter((x) => !touch.includes(x)), [lo, hi] as [number, number]].sort((x, y) => x[0] - y[0]);
    }
    let res = decide(spans);
    for (let guard = 0; guard < 50; guard++) {
      const ws = res.words;
      const j = ws.findIndex((w, i) => i > 0 && ws[i - 1].k === w.k && !(w.span !== undefined && w.span === ws[i - 1].span) && !doubled.some((s) => s.has(w.k)));
      if (j < 0) break;
      const x = ws[j - 1], y = ws[j];
      const lo = x.span !== undefined ? spans[x.span][0] : x.col, hi = y.span !== undefined ? spans[y.span][1] : y.col;
      spans = [...spans.filter(([a, b]) => b < lo || a > hi), [Math.min(lo, ...spans.filter(([a, b]) => !(b < lo || a > hi)).map((s) => s[0])), Math.max(hi, ...spans.filter(([a, b]) => !(b < lo || a > hi)).map((s) => s[1]))] as [number, number]].sort((p, q) => p[0] - q[0]);
      res = decide(spans);
    }
    // the place ids, the statistics
    const base = places.length;
    for (const _ of res.local) placeLine.push(lines.length);
    for (const pl of res.local) { places.push({ id: places.length, ...pl }); st.places++; }
    st.columns += nC;
    for (const w of res.words) if (w.p === undefined && !w.d && !w.l) st.unanimous++;
    // x: the column of each printed word in the line's alignment (see g below)
    const words: Record<string, unknown>[] = res.words.map(({ col, span, ...w }) => (w.p !== undefined ? { ...w, p: w.p + base, x: col } : { ...w, x: col }));
    // g: each manuscript's row in the alignment, one letter per column: w its next word, - no word there, ? lost there
    const g = reads.map((row) => row.map((k) => (k === null ? "?" : k ? "w" : "-")).join(""));
    st.words += words.length;
    const extra: Record<string, string> = {};
    if (HEB) {
      const mask = aramaic(R.book, ref, words.map((w) => w.k as string));
      mask.forEach((a, i) => { if (a) words[i].a = 1; });
      const n = mask.filter(Boolean).length;
      if (n) { extra.aramaic = n === words.length ? "all" : "part"; st.arLines++; st.arWords += n; }
    }
    // where each manuscript's words come from: its transcription (index in its files) and the line number in that file
    lines.push({ ref, witnesses: present.map((p) => WIDX.get(p.s)), src: present.map((p) => `${byMs.get(p.s)!.files.indexOf(p.x.file)}:${p.x.lineNo}`), g, ...extra, words });
  }
  model(R, witnesses as Wit[], lines as Ln[], places as Pl[], placeLine, st);
  // words printed twice in a row across a place's edge that no manuscript of the line has twice
  const doubles = new Map<string, [number, number][]>();
  for (const l of lines as Ln[]) {
    const ws = l.words ?? [];
    for (let i = 1; i < ws.length; i++) {
      const x = ws[i - 1], y = ws[i];
      if (x.k !== y.k || (x.p !== undefined && x.p === y.p) || dbl.get(l.ref)?.has(y.k)) continue;
      const P = places as Pl[], lo = x.p !== undefined ? P[x.p].cols[0] : x.x, hi = y.p !== undefined ? P[y.p].cols[1] : y.x;
      (doubles.get(l.ref) ?? doubles.set(l.ref, []).get(l.ref)!).push([Math.min(lo, hi), Math.max(lo, hi)]);
    }
  }
  let cs = 0, cn = 0; for (const l of lines as { words?: { c?: number }[] }[]) for (const w of l.words ?? []) { cs += w.c ?? 1; cn++; }
  const stats = {
    manuscripts: witnesses.length, early: witnesses.filter((w) => w.early).length,
    lines: st.lines, uncoveredLines: st.uncovered, words: st.words, columns: st.columns, unanimousColumns: st.unanimous,
    places: st.places, meanPlaceConfidence: r4(st.places ? st.confidenceSum / st.places : 1), meanWordConfidence: r4(cn ? cs / cn : 1),
    meanManuscriptsPerLine: r4(st.witnessesPerLine / Math.max(1, st.lines - st.uncovered)),
    ...(HEB ? { aramaicLines: st.arLines, aramaicWords: st.arWords } : {}),
  };
  return { doubles, result: { id: R.id, book: R.book, name: R.name, section: R.section, language: R.language, settings: { origin: R.origin, halfLife: R.halfLife, lateAfter: R.lateAfter, undated: R.undated }, inputs: R.inputs, stats, witnesses, lines, places } };
}

if (import.meta.main) {
  const arg = process.argv[2];
  if (!arg) throw new Error("usage: bun run compile all | <book>");
  const spec = readBooks(), by = selfIdentify();
  const compiler = `${by.program.replace(/^.*\//, "").replace(/\.[^.]+$/, "")}-${by.commit?.slice(0, 12) ?? "nocommit"}${by.codeMatchesCommit === false ? `-modified-${by.codeSha256.slice(0, 8)}` : ""}`;
  const out = `${ROOT}outputs/${spec.sha256.slice(0, 12)}/${compiler}`;
  mkdirSync(`${out}/books`, { recursive: true });
  const books = arg === "all" ? spec.books : spec.books.filter((b) => b.book === arg || b.id === arg);
  if (!books.length) throw new Error(`no book ${arg} in transcriptions/books.json`);
  console.log(`under ${SPEC_FILE} (sha256 ${spec.sha256.slice(0, 12)}), by ${by.program} at ${by.commit?.slice(0, 12) ?? "no commit"}${by.codeMatchesCommit === false ? " (code changed since that commit)" : ""}, ${by.runtime} -> ${out.slice(ROOT.length)}`);
  const manifestFile = `${out}/compilation.json`;
  const old = existsSync(manifestFile) ? JSON.parse(readFileSync(manifestFile, "utf8")) : { books: [] };
  const entries = new Map<string, unknown>((old.books as { id: string }[]).map((b) => [b.id, b]));
  for (const b of books) {
    if (!b.inputs.length) { console.log(`${b.name}: no inputs held`); continue; }
    const t = performance.now(); const res = compile(b);
    const json = JSON.stringify(res) + "\n";
    writeFileSync(`${out}/books/${b.id}.json`, json);
    entries.set(b.id, { id: b.id, book: b.book, name: b.name, section: b.section, language: b.language, file: `books/${b.id}.json`, sha256: sha(json), stats: res.stats });
    console.log(`${b.name}: ${res.stats.manuscripts} manuscripts, ${res.stats.lines} lines, ${res.stats.words} words, ${res.stats.places} places (${((performance.now() - t) / 1000).toFixed(1)} s)`);
  }
  const method = readFileSync(`${ROOT}${METHOD_FILE}`, "utf8");
  const order = spec.books.map((b) => b.id);
  const manifest = {
    specification: { file: SPEC_FILE, sha256: spec.sha256, statement: `This compilation was produced under ${SPEC_FILE} (SHA-256 ${spec.sha256}).` },
    compiler: { id: compiler, ...by },
    method: { file: METHOD_FILE, sha256: sha(method), text: method },
    evidence: { inventory: "transcriptions/manuscripts.json", inventorySha256: sha(readFileSync(`${ROOT}transcriptions/manuscripts.json`)), books: "transcriptions/books.json" },
    sections: spec.sections,
    books: [...entries.values()].sort((x, y) => order.indexOf((x as { id: string }).id) - order.indexOf((y as { id: string }).id)),
  };
  writeFileSync(manifestFile, JSON.stringify(manifest, null, 1) + "\n");
}

// ---------- how likely each reading is to be the original (scripts/METHOD.md, section 3) ----------
type Wit = { siglum: string; year: number; early: boolean; reliability?: unknown; date?: unknown };
type Wd = { t: string; k: string; c?: number; lo?: number; hi?: number; p?: number; l?: number[]; d?: number[]; x: number; a?: number };
type Ln = { ref: string; uncovered?: boolean; witnesses: number[]; words?: Wd[] };
type PR = { text: string; keys: string; xs: number[]; witnesses: number[]; partly?: number[]; p?: number; lo?: number; hi?: number };
type Pl = { id: number; ref: string; at: number; n: number; cols: [number, number]; confidence: number; weight: number; lost?: boolean; readings: PR[]; lostEverywhere?: { p: number; lo: number; hi: number } };
function model(R: Book, W: Wit[], lines: Ln[], places: Pl[], placeLine: number[], st: Record<string, any>) {
  const M = W.length, S = 100;
  const late = W.map((w) => !w.early);
  const pri = W.map((w) => { const i = INFO.get(w.siglum); return prior({ from: i?.yearFrom, to: i?.yearTo, origin: R.origin, halfLife: R.halfLife, undated: R.undated }); });
  // the units of evidence, line by line: each place, and each run of other words read by the same manuscripts
  type U = Unit & { mult: number; place?: number; words?: number[] };
  const byLine: U[][] = lines.map(() => []);
  places.forEach((p, pid) => {
    if (!p.readings.length) return;
    const voters: [number, number][] = [];
    p.readings.forEach((r, ri) => { for (const m of [...r.witnesses, ...(r.partly ?? [])]) voters.push([m, ri]); });
    byLine[placeLine[pid]].push({ options: p.readings.length, voters, mult: 1, place: pid });
  });
  lines.forEach((l, li) => {
    if (l.uncovered) return;
    const groups = new Map<string, U>();
    l.words!.forEach((w, wi) => {
      if (w.p !== undefined) return;
      const out = new Set([...(w.l ?? []), ...(w.d ?? [])]), readers = l.witnesses.filter((m) => !out.has(m)), diff = w.d ?? [];
      const key = `${readers.join(",")}|${diff.join(",")}`;
      const g = groups.get(key);
      if (g) { g.mult++; g.words!.push(wi); return; }
      const voters: [number, number][] = [...readers.map((m) => [m, 0] as [number, number]), ...diff.map((m, j) => [m, j + 1] as [number, number])];
      groups.set(key, { options: 1 + diff.length, voters, mult: 1, words: [wi] });
    });
    byLine[li].push(...groups.values());
  });
  // reliability, step by step (expectation-maximisation): agreement of each manuscript with what the others make likely
  const q = new Float64Array(M), A = new Float64Array(M), N = new Float64Array(M);
  for (let m = 0; m < M; m++) q[m] = pri[m].mean;
  for (let it = 0; it < 5; it++) {
    A.fill(0); N.fill(0);
    for (const units of byLine) {
      const sum = new Map<number, [number, number]>();
      for (const u of units) {
        if (u.voters.length < 2) continue;
        const w = weights(u, late, q), L = loglik(u, w, (m) => q[m]), K = u.options;
        u.voters.forEach(([m, o], i) => {
          const qm = Math.min(0.999999, Math.max(1e-6, q[m])), hit = Math.log(qm) * w[i], miss = Math.log((1 - qm) / K) * w[i];
          const Lm = L.map((x, r) => x - (r === o ? hit : miss));
          const pr = posterior(Lm)[o];
          const x = sum.get(m) ?? [0, 0]; x[0] += pr * u.mult; x[1] += u.mult; sum.set(m, x);
        });
      }
      for (const [m, [a, n]] of sum) { A[m] += a / n; N[m] += 1; }
    }
    for (let m = 0; m < M; m++) q[m] = (pri[m].strength * pri[m].mean + A[m]) / (pri[m].strength + N[m]);
  }
  // the uncertainty: draw reliabilities from their distributions, a fixed number of times with a fixed seed
  let seed = 0; for (const ch of R.id) seed = (seed * 31 + ch.charCodeAt(0)) >>> 0;
  const u01 = rng(seed);
  const a0 = W.map((_, m) => pri[m].strength * pri[m].mean + A[m]), b0 = W.map((_, m) => pri[m].strength * (1 - pri[m].mean) + (N[m] - A[m]));
  const Q: Float64Array[] = []; for (let s2 = 0; s2 < S; s2++) { const row = new Float64Array(M); for (let m = 0; m < M; m++) row[m] = betaDraw(a0[m], b0[m], u01); Q.push(row); }
  const r3 = (x: number) => Math.round(x * 1000) / 1000;
  W.forEach((w, m) => {
    const xs = Q.map((row) => row[m]);
    w.reliability = { estimate: r3(q[m]), low: r3(quantile(xs, 0.05)), high: r3(quantile(xs, 0.95)), linesCompared: N[m], agreementShare: N[m] ? r3(A[m] / N[m]) : null, priorMean: r3(pri[m].mean), priorStrength: r3(pri[m].strength), dateRangeKnown: pri[m].rangeKnown };
  });
  const judge = (u: U) => {
    const w = weights(u, late, q), per: number[][] = Array.from({ length: u.options + 1 }, () => []);
    for (const row of Q) { const p = posterior(loglik(u, w, (m) => row[m])); p.forEach((x, i) => per[i].push(x)); }
    const point = posterior(loglik(u, w, (m) => q[m]));
    return per.map((xs, i) => ({ p: r3(quantile(xs, 0.5)), lo: r3(quantile(xs, 0.05)), hi: r3(quantile(xs, 0.95)), point: point[i] }));
  };
  const yearOf = (m: number) => W[m].year;
  // apply: other words, then places (whose printed reading may change)
  for (let li = 0; li < lines.length; li++) for (const u of byLine[li]) {
    if (u.place !== undefined) continue;
    const j = judge(u)[0];
    for (const wi of u.words!) Object.assign(lines[li].words![wi], { c: j.p, lo: j.lo, hi: j.hi });
  }
  const offset = new Map<number, number>();
  for (let li = 0; li < lines.length; li++) for (const u of byLine[li]) {
    if (u.place === undefined) continue;
    const p = places[u.place], J = judge(u);
    p.readings.forEach((r, ri) => { r.p = J[ri].p; r.lo = J[ri].lo; r.hi = J[ri].hi; });
    p.lostEverywhere = { p: J[u.options].p, lo: J[u.options].lo, hi: J[u.options].hi };
    const order = p.readings.map((r, ri) => ri).sort((x, y) => {
      const X = p.readings[x], Y = p.readings[y], ex = Math.min(...[...X.witnesses, ...(X.partly ?? [])].map(yearOf)), ey = Math.min(...[...Y.witnesses, ...(Y.partly ?? [])].map(yearOf));
      return (Math.abs(J[y].point - J[x].point) > 1e-9 ? J[y].point - J[x].point : 0) || ex - ey || (Y.witnesses.length + (Y.partly?.length ?? 0)) - (X.witnesses.length + (X.partly?.length ?? 0)) || (X.keys < Y.keys ? -1 : X.keys > Y.keys ? 1 : 0);
    });
    p.readings = order.map((i) => p.readings[i]);
    const chosen = p.readings[0], runner = p.readings[1];
    p.confidence = chosen.p!; p.weight = runner ? runner.p! : 0;
    const A2 = chosen.keys ? chosen.keys.split(" ") : [];
    // the printed words of the place
    const l = lines[li], off = offset.get(li) ?? 0, at = p.at + off;
    const ts = chosen.text === "—" ? [] : chosen.text.split(" ");
    const nw: Wd[] = A2.map((k, j) => ({ t: ts[j] ?? k, k, c: chosen.p, lo: chosen.lo, hi: chosen.hi, p: p.id, x: chosen.xs[j] }));
    const old = l.words!.slice(at, at + p.n), ar = (l as { aramaic?: string }).aramaic === "all" || old.some((w) => w.a);
    for (const w of nw) if (ar) w.a = 1;
    l.words!.splice(at, p.n, ...nw);
    offset.set(li, off + nw.length - p.n);
    p.at = at; p.n = nw.length;
  }
  // statistics again, from the model's choices
  Object.assign(st, { places: 0, confidenceSum: 0 });
  for (const p of places) if (!p.lost) { st.places++; st.confidenceSum += p.confidence; }
  st.words = lines.reduce((s, l) => s + (l.words?.length ?? 0), 0);
}
