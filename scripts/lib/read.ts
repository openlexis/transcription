// Readers: turn one transcription file (as listed under `sources` in the specification) into its lines, each a list of
// words in the first hand, with the places where the text is lost. Every format in the corpus has a reader here:
//  - TEI XML as published by the IGNTP, ITSEE, INTF, the Codex Sinaiticus Project and the Codex Zacynthius project (lib/tei.ts);
//  - TEI XML of the IGNTP/ITSEE catenae: only the biblical text (lemmata, <ab type="biblical">) is read, not the commentary;
//  - TEI P5 holding the plain text of the Center for New Testament Restoration (CNTR), unchanged, in <ab type="source-text">;
//  - UXLC XML (the Leningrad Codex, one file per book): the words as written in the line (Ketiv), not the marginal Qere;
//  - TEI P5 made from Text-Fabric data (the Samaritan Pentateuch and the Dead Sea Scrolls): <ab n="Book c:v"> with <w> and <gap>.
// Nothing else is read: no file that the specification does not list.
import { readFileSync } from "node:fs";
import { parseXml, teiUnitsWithStats } from "./tei";
import { HEB_BOOKS, NT_BOOKS, numeral, sacred, skel } from "./text";

/** supplied: text an edition filled in where the manuscript is lost (TEI <supplied>), not the manuscript's own text. */
export type Word = { w: string; gap: boolean; supplied?: boolean };
/** One line of one transcription. absent: the transcription marks the line as not in the manuscript. gapEnd: lost at its end. */
export type Line = { book: string; ref: string; words: Word[]; gapEnd: boolean; absent?: boolean };
/** What a transcription documents about its manuscript's copying, counted while reading it (unknown where the format records none). */
export type Scribal = { corrections: number | null; lacunae: number };
const OSIS = NT_BOOKS.map((b) => b.id);
const SP = { sacred, numeral };
const ENT: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'" };
const unent = (s: string) => s.replace(/&(#x[0-9a-fA-F]+|#\d+|\w+);/g, (m, e) => (e[0] === "#" ? String.fromCodePoint(e[1] === "x" ? parseInt(e.slice(2), 16) : +e.slice(1)) : ENT[e] ?? m));

/** A Hebrew word as shown: letters and vowel points, without cantillation marks; a maqaf or space splits words. */
export const hebWords = (raw: string) => raw.normalize("NFD").replace(/[\u0591-\u05AF\u05BD\u05C0\u05C3-\u05C6\u034F\u200C-\u200F\/\\]/g, "").split(/[\u05BE\s]+/).filter((w) => /[\u05D0-\u05EA]/.test(w)).map((w) => w.normalize("NFC"));

/** One line of CNTR text. Corrections "x{first hand} {correction}": the first hand is read, always. */
export function cntrLine(text: string) {
  const t = text.replace(/x\{([^}]*)\}(?:\s*[ab]?\{[^}]*\})*/g, "$1").replace(/[a-z]?\{([^}]*)\}/g, "$1");
  const words: Word[] = [];
  let gap = false;
  for (const raw of t.split(/\s+/)) {
    if (!raw) continue;
    const tok = raw.replace(/\\\d*/g, "");
    const letters = [...tok].filter((c) => /\p{L}/u.test(c) || c === "¯").length;
    const first = tok.search(/[\p{L}¯]/u), last = Math.max(...[...tok].map((c, i) => (/[\p{L}¯]/u.test(c) ? i : -1)));
    const marks = [...tok].map((c, i) => (c === "*" || c === "&" ? i : -1)).filter((i) => i >= 0);
    if (!letters) { if (marks.length || tok.includes("�")) gap = true; continue; }
    if (marks.some((i) => i < first)) gap = true;
    const damaged = tok.includes("~") || tok.includes("^") || tok.includes("�");
    let ws = [skel(tok.replace(/[|\/%^~+*&\[\]_⋄$]/g, "").replace(/=/g, "").replace(/¯/g, "ν"))];
    if (tok.includes("$")) ws = numeral(ws[0]) ?? ws;
    else if (tok.includes("=")) ws = [sacred(ws[0])];
    if (damaged || !ws[0]) gap = true;
    else { ws.forEach((w, i) => words.push({ w, gap: i === 0 && gap })); gap = false; }
    if (marks.some((i) => i > last)) gap = true;
  }
  return { words, gapEnd: gap };
}
/** CNTR text: one line per verse, "BBCCCLLL text"; "-" marks a verse the manuscript does not have. */
function cntrText(raw: string): { lines: Line[]; corrections: number } {
  const lines: Line[] = [];
  let corrections = 0;
  for (const l of raw.split("\n")) {
    const m = l.match(/^(\d\d)(\d{3})(\d{3}) (.*)$/); if (!m) continue;
    const book = OSIS[+m[1] - 40]; if (!book) continue;
    const ref = `${+m[2]}:${+m[3]}`;
    if (m[4].trim() === "-") { lines.push({ book, ref, words: [], gapEnd: false, absent: true }); continue; }
    corrections += (m[4].match(/x\{/g) ?? []).length;
    lines.push({ book, ref, ...cntrLine(m[4]) });
  }
  return { lines, corrections };
}

/** The biblical text (lemmata) of an IGNTP/ITSEE catena. A lemma split over several pieces of commentary is joined in order,
 * with a lacuna between the pieces (the commentary between them is not the biblical text). */
export function catenaLines(xml: string): Line[] {
  const root = parseXml(xml.replace(/<teiHeader[\s\S]*?<\/teiHeader>/, ""));
  const units: Line[] = [];
  const walk = (x: any, ref?: string) => {
    if (typeof x === "string") return;
    if (x.t === "div" && x.a.verseBegin && x.a.verseBegin === x.a.verseEnd) { const m = x.a.verseBegin.match(/^(\w+)\.(\d+)\.(\d+)$/); if (m && OSIS.includes(m[1])) ref = `${m[1]} ${+m[2]}:${+m[3]}`; }
    if (x.t === "div" && x.a.verseBegin && x.a.verseBegin !== x.a.verseEnd) ref = undefined;
    if (x.t === "ab" && x.a.type === "biblical") {
      if (!ref) return;
      const words: Word[] = []; let gap = false;
      const take = (n: any) => {
        if (typeof n === "string") return;
        if (n.t === "gap") { gap = true; return; }
        if (n.t === "w") {
          let damaged = false, sac = false;
          const txt = (q: any): string => typeof q === "string" ? q : (q.t === "supplied" || q.t === "gap" ? (damaged = true, "") : q.t === "note" || q.t === "pc" ? "" : (q.t === "abbr" && q.a.type === "nomSac" ? (sac = true) : 0, q.c.map(txt).join("")));
          const w0 = skel(txt(n)), w = sac ? sacred(w0) : w0;
          if (damaged) { gap = true; return; }
          if (w) { words.push({ w, gap }); gap = false; }
          return;
        }
        if (n.t === "app") { const r = n.c.find((q: any) => typeof q !== "string" && q.t === "rdg"); if (r) r.c.forEach(take); return; }
        n.c.forEach(take);
      };
      x.c.forEach(take);
      const [book, r] = ref.split(" ");
      if (words.length) units.push({ book, ref: r, words, gapEnd: gap });
      return;
    }
    for (const c of x.c) walk(c, ref);
  };
  walk(root);
  const joined = new Map<string, Line>();
  for (const u of units) { const k = `${u.book} ${u.ref}`, o = joined.get(k); if (!o) joined.set(k, { ...u, words: [...u.words] }); else { if (u.words[0]) u.words[0] = { ...u.words[0], gap: true }; o.words.push(...u.words); o.gapEnd = u.gapEnd; } }
  return [...joined.values()];
}

/** UXLC: <c n> chapters, <v n> verses, <w> words and <k> (Ketiv) words; the <q> (Qere) is the margin's reading and is not read. */
function uxlc(xml: string, book: string): Line[] {
  const out: Line[] = []; let c = "", cur: Line | undefined;
  for (const x of xml.matchAll(/<c n="(\d+)">|<v n="(\d+)"[^>]*>|<(w|k)>([\s\S]*?)<\/\3>/g)) {
    if (x[1]) c = x[1];
    else if (x[2]) { cur = { book, ref: `${+c}:${+x[2]}`, words: [], gapEnd: false }; out.push(cur); }
    else if (cur) for (const w of hebWords(x[4].replace(/<[^>]*>/g, ""))) cur.words.push({ w, gap: false });
  }
  return out;
}
/** TEI P5 made from Text-Fabric data: <ab n="Book c:v"> holding <w> words and <gap/> lacunae; <ab type="absent"> a line not there;
 * words inside <supplied> are text an edition filled in where the manuscript is lost, flagged supplied. */
function tfTei(xml: string): Line[] {
  const out: Line[] = [];
  for (const m of xml.matchAll(/<ab((?:\s+[\w:]+="[^"]*")*)\s*(\/>|>([\s\S]*?)<\/ab>)/g)) {
    const n = m[1].match(/\sn="([^"]*)"/)?.[1], absent = /\stype="absent"/.test(m[1]);
    const r = n && unent(n).match(/^(\S+) (\d+:\d+)$/); if (!r) continue;
    if (absent) { out.push({ book: r[1], ref: r[2], words: [], gapEnd: false, absent: true }); continue; }
    const words: Word[] = []; let gap = false, supplied = false;
    for (const t of (m[3] ?? "").matchAll(/<gap\b[^>]*\/>|<supplied\b[^>]*>|<\/supplied>|<w>([^<]*)<\/w>/g)) {
      if (t[0].startsWith("<supplied")) { supplied = true; continue; }
      if (t[0] === "</supplied>") { supplied = false; continue; }
      if (t[1] === undefined) { gap = true; continue; }
      words.push(supplied ? { w: unent(t[1]), gap, supplied } : { w: unent(t[1]), gap }); gap = false;
    }
    out.push({ book: r[1], ref: r[2], words, gapEnd: gap });
  }
  return out;
}

/** Reads one file entry of a source (all its paths), by the reader for its provenance. Lines that occur more than once keep the
 * occurrence with the most words. */
export function readEntry(root: string, provenance: string, paths: string[]): { lines: Line[]; scribal: Scribal } {
  const all: Line[] = []; let corrections: number | null = null;
  for (const p of paths) {
    const xml = readFileSync(`${root}${p}`, "utf8");
    if (provenance === "uxlc") {
      const name = p.replace(/^.*\/[^/.]+\./, "").replace(/\.xml$/, ""), b = HEB_BOOKS.find((x) => x.uxlc === name);
      if (!b) throw new Error(`${p}: no book for ${name}`);
      all.push(...uxlc(xml, b.id));
    } else if (provenance === "dt-ucph-sp" || provenance === "etcbc-dss" || provenance === "aleppo" || provenance === "tal-florentin-sp") all.push(...tfTei(xml));
    else if (provenance === "cntr") {
      const m = xml.match(/<ab type="source-text">([\s\S]*?)<\/ab>/); if (!m) throw new Error(`${p}: no source text`);
      const r = cntrText(unent(m[1])); all.push(...r.lines); corrections = (corrections ?? 0) + r.corrections;
    } else if (provenance === "igntp-catena") all.push(...catenaLines(xml));
    else {
      const { units, stats } = teiUnitsWithStats(xml, SP);
      corrections = (corrections ?? 0) + stats.corrections;
      for (const u of units) if (u.book >= 1) all.push({ book: OSIS[u.book - 1], ref: u.ref, words: u.words, gapEnd: u.gapEnd });
    }
  }
  const by = new Map<string, Line>();
  for (const u of all) { const k = `${u.book} ${u.ref}`, o = by.get(k); if (!o || u.words.length > o.words.length || (o.absent && !u.absent && (u.words.length || u.gapEnd))) by.set(k, u); }
  const lines = [...by.values()].filter((u) => u.absent || u.words.length || u.gapEnd);
  let lacunae = 0; for (const u of lines) { lacunae += u.words.filter((w) => w.gap).length + (u.gapEnd ? 1 : 0); }
  return { lines, scribal: { corrections, lacunae } };
}
