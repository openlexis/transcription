// Unified XML readers for the primary transcription formats listed in the specification.
// Reads ONLY files explicitly passed from the specification allowlist.
import { readFileSync } from "node:fs";
import { OSIS_BOOKS, parseXml, teiUnitsWithStats, type TeiStats } from "./tei";
import { HEB_BOOKS, numeral, sacred, skel } from "./text";

export type ParsedUnit = {
  book: string;
  ref: string;
  words: { w: string; gap: boolean }[];
  gapEnd: boolean;
  absent?: boolean;
};

export type ReadResult = {
  units: ParsedUnit[];
  stats: TeiStats;
};

const SP = { sacred, numeral };
const UXLC_BY_NAME = new Map(HEB_BOOKS.map((b) => [b.uxlc, b.id]));
const hebWords = (raw: string) =>
  raw
    .normalize("NFD")
    .replace(/[\u0591-\u05AF\u05BD\u05C0\u05C3-\u05C6\u034F\u200C-\u200F\/\\A-Za-z0-9]/g, "")
    .split(/[\u05BE\s]+/)
    .filter((w) => /[\u05D0-\u05EA]/.test(w))
    .map((w) => w.normalize("NFC"));

const ENT: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'" };
const unent = (s: string) =>
  s.replace(/&(#x[0-9a-fA-F]+|#\d+|\w+);/g, (m, e) =>
    e[0] === "#" ? String.fromCodePoint(e[1] === "x" ? parseInt(e.slice(2), 16) : +e.slice(1)) : ENT[e] ?? m,
  );

function readCntr(xml: string): ReadResult {
  const m = xml.match(/<ab[^>]*type="holder-text"[^>]*>([\s\S]*?)<\/ab>/);
  if (!m) return { units: [], stats: { corrections: 0, lacunae: 0, words: 0 } };
  const raw = unent(m[1]);
  const units: ParsedUnit[] = [];
  let corrections = 0, lacunae = 0, totalWords = 0;

  for (const l of raw.split("\n")) {
    const lm = l.match(/^(\d\d)(\d{3})(\d{3}) (.*)$/);
    if (!lm) continue;
    const book = OSIS_BOOKS[+lm[1] - 40];
    if (!book) continue;
    const ref = `${+lm[2]}:${+lm[3]}`;
    const body = lm[4].trim();
    if (body === "-") {
      units.push({ book, ref, words: [], gapEnd: false, absent: true });
      continue;
    }
    const corrMatches = body.match(/x\{[^}]*\}/g);
    if (corrMatches) corrections += corrMatches.length;

    // First hand only: x{first hand} {correction} -> first hand
    const t = body.replace(/x\{([^}]*)\}(?:\s*[ab]?\{[^}]*\})*/g, "$1").replace(/[a-z]?\{([^}]*)\}/g, "$1");
    const words: { w: string; gap: boolean }[] = [];
    let gap = false;
    for (const rawTok of t.split(/\s+/)) {
      if (!rawTok) continue;
      const tok = rawTok.replace(/\\\d*/g, "");
      const letters = [...tok].filter((c) => /\p{L}/u.test(c) || c === "¯").length;
      const first = tok.search(/[\p{L}¯]/u);
      const last = Math.max(...[...tok].map((c, i) => (/[\p{L}¯]/u.test(c) ? i : -1)));
      const marks = [...tok].map((c, i) => (c === "*" || c === "&" ? i : -1)).filter((i) => i >= 0);
      if (!letters) {
        if (marks.length || tok.includes("")) { gap = true; lacunae++; }
        continue;
      }
      if (marks.some((i) => i < first)) { gap = true; lacunae++; }
      const damaged = tok.includes("~") || tok.includes("^") || tok.includes("");
      let ws = [skel(tok.replace(/[|\/%^~+*&\[\]_⋄$]/g, "").replace(/=/g, "").replace(/¯/g, "ν"))];
      if (tok.includes("$")) ws = numeral(ws[0]) ?? ws;
      else if (tok.includes("=")) ws = [sacred(ws[0])];
      if (damaged || !ws[0]) {
        gap = true;
        if (damaged) lacunae++;
      } else {
        ws.forEach((w, i) => { words.push({ w, gap: i === 0 && gap }); totalWords++; });
        gap = false;
      }
      if (marks.some((i) => i > last)) { gap = true; lacunae++; }
    }
    if (words.length || gap) units.push({ book, ref, words, gapEnd: gap });
  }
  return { units, stats: { corrections, lacunae, words: totalWords } };
}

function readCatena(xml: string): ReadResult {
  const root = parseXml(xml.replace(/<teiHeader[\s\S]*?<\/teiHeader>/, ""));
  const OSIS_OF: Record<string, string> = { Rom: "Rom", Eph: "Eph" };
  const units: ParsedUnit[] = [];
  let corrections = 0, lacunae = 0, totalWords = 0;

  const walk = (x: any, ref?: string) => {
    if (typeof x === "string") return;
    if (x.t === "div" && x.a.verseBegin && x.a.verseBegin === x.a.verseEnd) {
      const m = x.a.verseBegin.match(/^(\w+)\.(\d+)\.(\d+)$/);
      if (m && OSIS_OF[m[1]]) ref = `${OSIS_OF[m[1]]} ${+m[2]}:${+m[3]}`;
    }
    if (x.t === "div" && x.a.verseBegin && x.a.verseBegin !== x.a.verseEnd) ref = undefined;
    if (x.t === "ab" && x.a.type === "biblical") {
      if (!ref) return;
      const words: { w: string; gap: boolean }[] = [];
      let gap = false;
      const take = (n: any) => {
        if (typeof n === "string") return;
        if (n.t === "gap") { gap = true; lacunae++; return; }
        if (n.t === "w") {
          let damaged = false, sac = false;
          const txt = (q: any): string =>
            typeof q === "string"
              ? q
              : q.t === "supplied" || q.t === "gap"
                ? ((damaged = true), "")
                : q.t === "note" || q.t === "pc"
                  ? ""
                  : (q.t === "abbr" && q.a.type === "nomSac" ? (sac = true) : 0, q.c.map(txt).join(""));
          const w0 = skel(txt(n));
          const w = sac ? sacred(w0) : w0;
          if (damaged) { gap = true; lacunae++; return; }
          if (w) { words.push({ w, gap }); gap = false; totalWords++; }
          return;
        }
        if (n.t === "app") {
          const rdgs = n.c.filter((q: any) => typeof q !== "string" && q.t === "rdg");
          if (rdgs.length > 1) corrections++;
          const r = rdgs.find((q: any) => q.a.type === "orig" || q.a.hand === "firsthand") ?? rdgs[0];
          if (r) r.c.forEach(take);
          return;
        }
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

  const joined = new Map<string, ParsedUnit>();
  for (const u of units) {
    const k = `${u.book} ${u.ref}`, o = joined.get(k);
    if (!o) joined.set(k, { ...u, words: [...u.words] });
    else {
      if (u.words[0]) u.words[0] = { ...u.words[0], gap: true };
      o.words.push(...u.words);
      o.gapEnd = u.gapEnd;
    }
  }
  return { units: [...joined.values()], stats: { corrections, lacunae, words: totalWords } };
}

function readSimpleTei(xml: string): ReadResult {
  const units: ParsedUnit[] = [];
  let lacunae = 0, totalWords = 0;
  const abRe = /<ab\b([^>]*?)(?:\/>|>([\s\S]*?)<\/ab>)/g;
  let m: RegExpExecArray | null;
  while ((m = abRe.exec(xml))) {
    const attrs = m[1], inner = m[2];
    const nMatch = attrs.match(/\bn="([^"]+)"/);
    if (!nMatch) continue;
    const parts = nMatch[1].split(" ");
    if (parts.length !== 2) continue;
    const [book, ref] = parts;
    if (/\btype="absent"/.test(attrs)) {
      units.push({ book, ref, words: [], gapEnd: false, absent: true });
      continue;
    }
    if (!inner) continue;
    const words: { w: string; gap: boolean }[] = [];
    let gap = false;
    const tokRe = /<gap\b[^>]*\/>|<w\b[^>]*>([\s\S]*?)<\/w>/g;
    let tm: RegExpExecArray | null;
    while ((tm = tokRe.exec(inner))) {
      if (tm[1] === undefined) {
        gap = true;
        lacunae++;
      } else {
        const w = unent(tm[1]).trim();
        if (w) { words.push({ w, gap }); gap = false; totalWords++; }
      }
    }
    if (words.length || gap) units.push({ book, ref, words, gapEnd: gap });
  }
  return { units, stats: { corrections: 0, lacunae, words: totalWords } };
}

function readUxlc(xml: string, filePath: string): ReadResult {
  const base = filePath.replace(/^.*\//, "").replace(/^L\./, "").replace(/\.xml$/, "");
  const book = UXLC_BY_NAME.get(base);
  if (!book) return { units: [], stats: { corrections: 0, lacunae: 0, words: 0 } };
  const units: ParsedUnit[] = [];
  let c = "", cur: ParsedUnit | undefined;
  let totalWords = 0;
  for (const x of xml.matchAll(/<c n="(\d+)">|<v n="(\d+)"[^>]*>|<(w|k)>([\s\S]*?)<\/\3>/g)) {
    if (x[1]) c = x[1];
    else if (x[2]) {
      cur = { book, ref: `${+c}:${+x[2]}`, words: [], gapEnd: false };
      units.push(cur);
    } else if (cur) {
      const cleaned = x[4].replace(/<x>[\s\S]*?<\/x>/g, "").replace(/<[^>]*>/g, "");
      for (const w of hebWords(cleaned)) {
        cur.words.push({ w, gap: false });
        totalWords++;
      }
    }
  }
  return { units, stats: { corrections: 0, lacunae: 0, words: totalWords } };
}

/** Read a single allowlisted XML file according to its provenance ID. */
export function readTranscriptionFile(absPath: string, provenanceId: string): ReadResult {
  const xml = readFileSync(absPath, "utf8");
  switch (provenanceId) {
    case "cntr":
      return readCntr(xml);
    case "igntp-catena":
      return readCatena(xml);
    case "dt-ucph-sp":
    case "etcbc-dss":
      return readSimpleTei(xml);
    case "uxlc":
      return readUxlc(xml, absPath);
    default: {
      // Standard IGNTP / INTF / Sinaiticus / Zacynthius / Family Π TEI XML
      const { units, stats } = teiUnitsWithStats(xml, SP);
      return {
        units: units
          .filter((u) => u.book >= 1)
          .map((u) => ({ book: OSIS_BOOKS[u.book - 1], ref: u.ref, words: u.words, gapEnd: u.gapEnd })),
        stats,
      };
    }
  }
}
