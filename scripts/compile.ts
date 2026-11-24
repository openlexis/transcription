// Carries out the rules of one compilation's RULES.md, literally and in order, and saves the output next to it.
//   bun run compile compilations/<name>       one compilation
//   bun run compile all                       every compilation, one at a time
// The rule file is the source of truth: the inputs are the files it lists, and each step below names the rule it carries out.
import { createHash } from "node:crypto";
import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { align } from "../src/align";
import { aramaic, greekKey, hebrewSpell, showGreek } from "../src/text";

const ROOT = new URL("..", import.meta.url).pathname;
const r4 = (x: number) => Math.round(x * 10000) / 10000;

// ---------- the rule file ----------
export type RuleFile = { model: string; book: string; name: string; language: string; inputs: string[]; origin: number; halfLife: number; lateAfter: number; undated: number };
export function readRules(dir: string): RuleFile {
  const md = readFileSync(`${dir}/RULES.md`, "utf8");
  const field = (k: string) => { const m = md.match(new RegExp(`^- \\*\\*${k}:\\*\\* (.+)$`, "m")); if (!m) throw new Error(`${dir}/RULES.md: no ${k}`); return m[1].replace(/`/g, "").trim(); };
  const inputs = [...md.slice(md.indexOf("## Inputs")).matchAll(/^- `(transcriptions\/[^`]+)`/gm)].map((m) => m[1]);
  return { model: field("Model"), book: field("Book"), name: field("Name"), language: field("Language"), inputs, origin: +field("Origin year"), halfLife: +field("Half-life"), lateAfter: +field("Late after"), undated: +field("Undated year") };
}

// ---------- manuscripts ----------
type MsInfo = { siglum: string; kind?: string; language?: string; dateSource?: string; name?: string; shelfmark?: string; century?: string; year?: number; viewer?: { name: string; url: string }[]; transcriptions: { holder: string; file: string; source: string; license: string }[] };
const CAT = JSON.parse(readFileSync(`${ROOT}transcriptions/manuscripts.json`, "utf8")) as { holders: Record<string, { name: string; web: string; license: string }>; manuscripts: MsInfo[] };
const INFO = new Map(CAT.manuscripts.map((m) => [m.siglum, m]));
/** Rule 2: leaves of one manuscript that were given separate numbers are one manuscript. */
export const SAME_MANUSCRIPT: Record<string, string> = { P67: "P64", P103: "P77" };

type Tok = { k: string; t: string; gap: boolean };
type LineText = { absent: boolean; words: Tok[]; gapEnd: boolean; file: string; lineNo: number };

export function compile(dir: string) {
  const R = readRules(dir);
  const HEB = R.language.startsWith("Hebrew");
  /** rule 15: a Greek manuscript in a Hebrew and Aramaic compilation is a translation, read only where no original-language manuscript has the line */
  const isTr = (s: string) => HEB && INFO.get(s)?.language === "Greek";
  let SHOW = HEB ? (w: string) => w : showGreek;
  /** rule 13: only a continuous-text manuscript can show that a word is absent */
  const partialKind = (s: string) => (INFO.get(s)?.kind ?? "continuous") !== "continuous";
  // rule 1: read every listed transcription; group them by manuscript
  const byMs = new Map<string, { files: string[]; lines: Map<string, LineText[]> }>();
  for (const file of R.inputs) {
    const siglum0 = file.replace(/^.*\//, "").replace(/\.[^.]+\.txt$/, ""), siglum = SAME_MANUSCRIPT[siglum0] ?? siglum0;
    const ms = byMs.get(siglum) ?? { files: [], lines: new Map() }; byMs.set(siglum, ms); ms.files.push(file);
    const KEY = HEB && !isTr(siglum) ? hebrewSpell : greekKey;
    readFileSync(`${ROOT}${file}`, "utf8").split("\n").forEach((l, i) => {
      const m = l.match(/^(\S+) (\d+:\d+)\t(.*)$/); if (!m || m[1] !== R.book) return;
      const words: Tok[] = []; let gap = false, gapEnd = false;
      const parts = m[3].split(" ").filter(Boolean);
      if (m[3] === "-") { const x = ms.lines.get(m[2]) ?? []; x.push({ absent: true, words: [], gapEnd: false, file, lineNo: i + 1 }); ms.lines.set(m[2], x); return; }
      parts.forEach((p, j) => { if (p === "…") { if (j === parts.length - 1) gapEnd = true; else gap = true; return; } words.push({ k: KEY(p), t: p, gap }); gap = false; });
      const x = ms.lines.get(m[2]) ?? []; x.push({ absent: false, words, gapEnd, file, lineNo: i + 1 }); ms.lines.set(m[2], x);
    });
  }
  // rule 3: proximity in time
  const year = (s: string) => INFO.get(s)?.year ?? R.undated;
  const T = (s: string) => Math.min(1, 2 ** (-(year(s) - R.origin) / R.halfLife));
  const early = (s: string) => year(s) - R.origin <= R.lateAfter;
  // witnesses in alignment order: oldest first, then by siglum
  const sigla = [...byMs.keys()].sort((a, b) => year(a) - year(b) || (a < b ? -1 : a > b ? 1 : 0));
  const WIDX = new Map(sigla.map((s, i) => [s, i]));
  const witnesses = sigla.map((s) => {
    const i = INFO.get(SAME_MANUSCRIPT[s] ?? s) ?? INFO.get(s);
    const leaves = Object.entries(SAME_MANUSCRIPT).filter(([, v]) => v === s).map(([k]) => k);
    return { siglum: s, ...(leaves.length ? { leaves } : {}), kind: i?.kind ?? "continuous", ...(isTr(s) ? { translation: "Greek" } : {}), name: i?.name, century: i?.century, dateSource: i?.dateSource, year: year(s), dated: INFO.get(s)?.year !== undefined, early: early(s), proximity: r4(T(s)), viewer: i?.viewer ?? [], files: byMs.get(s)!.files };
  });
  // the lines: every line any manuscript has, in chapter and line order
  const refs = [...new Set(sigla.filter((s) => !isTr(s)).flatMap((s) => [...byMs.get(s)!.lines.keys()]))].sort((a, b) => { const [x, y] = [a, b].map((r) => r.split(":").map(Number)); return x[0] - y[0] || x[1] - y[1]; });

  const lines: unknown[] = [], places: unknown[] = [];
  const st = { lines: 0, uncovered: 0, words: 0, columns: 0, unanimous: 0, places: 0, settled: 0, contested: 0, singularNoVote: 0, eyeSkipNoVote: 0, byType: {} as Record<string, number>, bySeverity: {} as Record<string, number>, confidenceSum: 0, witnessesPerLine: 0, trLines: 0, trWords: 0, arLines: 0, arWords: 0 };
  for (const ref of refs) {
    // rule 4: of several transcriptions of one manuscript, the one with the most words in the line; a tie goes to the one listed first
    const present: { s: string; x: LineText }[] = [];
    for (const s of sigla) {
      const xs = byMs.get(s)!.lines.get(ref); if (!xs) continue;
      const order = byMs.get(s)!.files;
      const x = [...xs].sort((a, b) => b.words.length - a.words.length || order.indexOf(a.file) - order.indexOf(b.file))[0];
      if (!x.absent && !x.words.length) continue; // only a lacuna: the manuscript does not cover the line
      present.push({ s, x });
    }
    st.lines++;
    // rule 15: the translation only where no Hebrew or Aramaic manuscript has words in the line
    const orig = present.filter((p) => !isTr(p.s)), fallback = !orig.some((p) => p.x.words.length) && present.some((p) => isTr(p.s) && p.x.words.length);
    present.splice(0, present.length, ...(fallback ? present.filter((p) => isTr(p.s)) : orig));
    SHOW = HEB && !fallback ? (w: string) => w : showGreek;
    if (!present.some((p) => p.x.words.length)) { st.uncovered++; lines.push({ ref, uncovered: true, witnesses: present.map((p) => WIDX.get(p.s)) }); continue; }
    st.witnessesPerLine += present.length;
    // rule 5: line up the words
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
    // rule 6: a column is a variant when, setting aside singular readings (one manuscript alone where another reading has two
    // or more), two or more different readings are left
    const variant = cols.map((_, ci) => {
      const n = new Map<string, number>(); for (const r of reads) { const k = r[ci]; if (k !== null) n.set(k, (n.get(k) ?? 0) + 1); }
      const most = Math.max(0, ...n.values());
      return [...n.values()].filter((c) => !(c === 1 && most >= 2)).length > 1;
    });
    // rule 6: places. Neighbouring variant columns are one place; two places at most two columns apart that share a word
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
    type Rd = { keys: string[]; forms: string[]; wits: number[]; segs: (string | null)[][]; partly: number[]; voting: number[]; flags: Set<string>; score: number; earliest: number };
    const like = (x?: string, y?: string) => !!x && !!y && (x === y || (x.length >= 4 && y.length >= 4 && x.slice(-3) === y.slice(-3)));
    /** The printed line for a set of places (rules 7 to 12). */
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
        // rule 7: each manuscript's reading of the place is its words across all the place's columns
        const rd = new Map<string, Rd>(); const partial: number[] = [];
        present.forEach((p, pi) => {
          const seg = reads[pi].slice(a, b + 1);
          if (seg.some((k) => k === null)) { partial.push(pi); return; }
          const keys = seg.filter((k): k is string => !!k), id = keys.join(" ");
          const r = rd.get(id) ?? { keys, forms: [], wits: [], segs: [], partly: [], voting: [], flags: new Set(), score: 0, earliest: Infinity }; rd.set(id, r);
          r.wits.push(pi); r.segs.push(seg); r.earliest = Math.min(r.earliest, year(p.s));
          if (!r.forms.length) r.forms = seg.map((_, j) => form(pi, a + j)).filter((x): x is string => !!x);
        });
        const all = [...rd.values()];
        if (!all.length) { // every manuscript is lost somewhere in the place: nothing is printed, and the place is listed
          local.push({ ref, at: words.length, n: 0, confidence: 0, weight: 0, type: "lost text", severity: "high", readings: [], partlyLost: sortW(partial) });
          return;
        }
        // a manuscript with a lacuna in the place votes with the one reading that agrees with every word it keeps there
        const stillLost: number[] = [];
        for (const pi of partial) {
          const seg = reads[pi].slice(a, b + 1);
          const ok = all.filter((r) => r.segs.some((s) => seg.every((k, j) => k === null || k === s[j])));
          if (ok.length === 1) { ok[0].partly.push(pi); ok[0].earliest = Math.min(ok[0].earliest, year(present[pi].s)); } else stillLost.push(pi);
        }
        const before = words.length ? words[words.length - 1].k : undefined, after = b + 1 < nC ? reads.find((x) => x[b + 1])?.[b + 1] ?? undefined : undefined;
        // rule 8: a singular reading (one manuscript alone, where another reading has two or more) does not vote
        const count = (r: Rd) => r.wits.length + r.partly.length;
        for (const r of all) if (count(r) === 1 && all.some((o) => o !== r && count(o) >= 2)) r.flags.add("singular");
        // rule 9: an omission that skips from one word to a like word is a copying slip, unless two or more early manuscripts share it
        for (const r of all) for (const o of all) {
          if (o === r || o.keys.length <= r.keys.length || r.flags.has("eye-skip")) continue;
          let s = 0; while (s < r.keys.length && r.keys[s] === o.keys[s]) s++;
          const n = o.keys.length - r.keys.length;
          if (r.keys.slice(s).join(" ") !== o.keys.slice(s + n).join(" ")) continue;
          let ok = false;
          for (let t = s; t >= 0 && !ok; t--) {
            if (t < s && o.keys[t] !== o.keys[t + n]) break;
            const prev = t > 0 ? o.keys[t - 1] : before, last = o.keys[t + n - 1], first = o.keys[t], next = t + n < o.keys.length ? o.keys[t + n] : after;
            if (like(prev, last) || like(first, next)) ok = true;
          }
          if (ok && [...r.wits, ...r.partly].filter((pi) => early(present[pi].s)).length < 2) r.flags.add("eye-skip");
        }
        // rule 10: the votes
        for (const r of all) if (!r.flags.size) r.voting = [...r.wits, ...r.partly];
        const top = Math.max(0, ...all.flatMap((r) => r.voting.map((pi) => T(present[pi].s))));
        for (const r of all) {
          const v = r.voting.map((pi) => ({ v: top ? T(present[pi].s) / top : 0, e: early(present[pi].s) }));
          const late = v.filter((x) => !x.e).map((x) => x.v).sort((x, y) => y - x);
          r.score = v.filter((x) => x.e).reduce((s, x) => s + x.v, 0) + late.reduce((s, x, i) => s + x * 0.5 ** i, 0);
        }
        // rule 11: the choice
        const EPS = 1e-9, id = (r: Rd) => r.keys.join(" ");
        all.sort((x, y) => (Math.abs(y.score - x.score) > EPS ? y.score - x.score : 0) || x.earliest - y.earliest || count(y) - count(x) || (id(x) < id(y) ? -1 : id(x) > id(y) ? 1 : 0));
        const total = all.reduce((s, r) => s + r.score, 0);
        const chosen = all[0], conf = total > 0 ? chosen.score / total : 1;
        const runner = all[1] && total > 0 ? all[1].score / total : 0;
        // rule 12: type and severity
        const kind = (o: Rd) => {
          const A = chosen.keys, B = o.keys;
          if (!B.length) return "omission";
          if (!A.length) return "addition";
          if ([...A].sort().join(" ") === [...B].sort().join(" ")) return "word order";
          const sub = (x: string[], y: string[]) => { let i = 0; for (const k of y) if (k === x[i]) i++; return i === x.length; };
          if (B.length < A.length && sub(B, A)) return "omission";
          if (B.length > A.length && sub(A, B)) return "addition";
          if (B.length === A.length) return "substitution";
          return "mixed";
        };
        const type = all.length > 1 ? kind(all[1]) : "lost text";
        const severity = conf < 0.6 ? "high" : runner >= 0.1 ? "medium" : runner >= 0.01 ? "low" : "settled";
        const pl = local.length;
        local.push({
          ref, at: words.length, n: chosen.keys.length, confidence: r4(conf), weight: r4(runner), type, severity,
          readings: all.map((r) => ({ text: r.forms.map(showGreek).join(" ") || "—", keys: id(r), witnesses: sortW(r.wits), ...(r.partly.length ? { partly: sortW(r.partly) } : {}), votes: r.voting.length, score: r4(r.score), share: r4(total > 0 ? r.score / total : r === chosen ? 1 : 0), ...(r.flags.size ? { flags: [...r.flags].sort() } : {}) })),
          ...(stillLost.length ? { partlyLost: sortW(stillLost) } : {}),
        });
        chosen.keys.forEach((k, j) => words.push({ t: SHOW(chosen.forms[j] ?? k), k, c: r4(conf), p: pl, col: a, span: si }));
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
    // rule 6 (joined places): where the printed line has the same word twice in a row across a place's edge and no manuscript of
    // the line has it twice there, the place is joined with its neighbour and decided again as one place
    const doubled = present.map((p) => new Set(p.x.words.map((w) => w.k).filter((k, j, a) => j > 0 && a[j - 1] === k)));
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
    for (const pl of res.local) {
      const p = pl as { type: string; severity: string; confidence: number; readings: { flags?: string[] }[] };
      places.push({ id: places.length, ...pl });
      st.places++; st.byType[p.type] = (st.byType[p.type] ?? 0) + 1; st.bySeverity[p.severity] = (st.bySeverity[p.severity] ?? 0) + 1;
      if (p.severity === "settled") st.settled++; if (p.confidence < 0.6) st.contested++; st.confidenceSum += p.confidence;
      st.singularNoVote += p.readings.filter((r) => r.flags?.includes("singular")).length; st.eyeSkipNoVote += p.readings.filter((r) => r.flags?.includes("eye-skip")).length;
    }
    st.columns += nC;
    for (const w of res.words) if (w.p === undefined && !w.d && !w.l) st.unanimous++;
    const words: Record<string, unknown>[] = res.words.map(({ col, span, ...w }) => (w.p !== undefined ? { ...w, p: w.p + base } : w));
    st.words += words.length;
    const extra: Record<string, string> = {};
    if (fallback) { for (const w of words) w.tr = 1; extra.translation = "Greek"; st.trLines++; st.trWords += words.length; }
    else if (HEB) {
      const mask = aramaic(R.book, ref, words.map((w) => w.k as string));
      mask.forEach((a, i) => { if (a) words[i].a = 1; });
      const n = mask.filter(Boolean).length;
      if (n) { extra.aramaic = n === words.length ? "all" : "part"; st.arLines++; st.arWords += n; }
    }
    // where each manuscript's words come from: its transcription (index in its files) and the line number in that file
    lines.push({ ref, witnesses: present.map((p) => WIDX.get(p.s)), src: present.map((p) => `${byMs.get(p.s)!.files.indexOf(p.x.file)}:${p.x.lineNo}`), ...extra, words });
  }
  const stats = {
    name: R.name, book: R.book, language: R.language, model: R.model, manuscripts: witnesses.length, early: witnesses.filter((w) => w.early).length,
    lines: st.lines, uncoveredLines: st.uncovered, words: st.words, columns: st.columns, unanimousColumns: st.unanimous,
    places: st.places, settled: st.settled, contested: st.contested, meanPlaceConfidence: r4(st.places ? st.confidenceSum / st.places : 1),
    meanWordConfidence: 0, singularReadingsWithoutVote: st.singularNoVote, eyeSkipsWithoutVote: st.eyeSkipNoVote, byType: st.byType, bySeverity: st.bySeverity,
    meanManuscriptsPerLine: r4(st.witnessesPerLine / Math.max(1, st.lines - st.uncovered)),
    ...(HEB ? { translationLines: st.trLines, translationWords: st.trWords, aramaicLines: st.arLines, aramaicWords: st.arWords } : {}),
  };
  let cs = 0, cn = 0; for (const l of lines as { words?: { c?: number }[] }[]) for (const w of l.words ?? []) { cs += w.c ?? 1; cn++; }
  stats.meanWordConfidence = r4(cn ? cs / cn : 1);
  const tj = JSON.stringify({ name: R.name, book: R.book, language: R.language, witnesses, lines }) + "\n";
  const dj = JSON.stringify({ name: R.name, book: R.book, places }) + "\n";
  writeFileSync(`${dir}/transcription.json`, tj);
  writeFileSync(`${dir}/disagreements.json`, dj);
  // a readable copy of the text, chapter by chapter
  let md = `# ${R.name}: the compiled transcription\n\nMade by following [RULES.md](RULES.md). Each line is printed as the rules decide it; a word in a place where the manuscripts disagree is marked with its confidence in disagreements.json. Lines that no manuscript covers are listed as not covered.\n`;
  let chap = "";
  for (const l of lines as { ref: string; uncovered?: boolean; words?: { t: string }[] }[]) {
    const c = l.ref.split(":")[0]; if (c !== chap) { chap = c; md += `\n## Chapter ${c}\n\n`; }
    md += `**${l.ref}** ${l.uncovered ? "_(not covered by any manuscript held)_" : l.words!.map((w) => w.t).join(" ")}  \n`;
  }
  writeFileSync(`${dir}/transcription.md`, md);
  const hash = createHash("sha256").update(tj).update(dj).digest("hex");
  writeFileSync(`${dir}/stats.json`, JSON.stringify({ ...stats, sha256: hash }, null, 1) + "\n");
  return stats;
}

if (import.meta.main) {
  const arg = process.argv[2];
  if (!arg) throw new Error("usage: bun run compile compilations/<name> | all");
  const dirs = arg === "all" ? readdirSync(`${ROOT}compilations`).filter((d) => existsSync(`${ROOT}compilations/${d}/RULES.md`)).sort().map((d) => `${ROOT}compilations/${d}`) : [arg.startsWith("/") ? arg : `${process.cwd()}/${arg}`];
  for (const d of dirs) {
    const t = performance.now(); const s = compile(d);
    console.log(`${s.name}: ${s.manuscripts} manuscripts, ${s.lines} lines, ${s.words} words, ${s.places} places, mean place confidence ${s.meanPlaceConfidence} (${((performance.now() - t) / 1000).toFixed(1)} s)`);
  }
}
