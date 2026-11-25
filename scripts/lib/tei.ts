// Reader for manuscript transcriptions in the IGNTP/INTF TEI XML encoding (the Birmingham IGNTP files and the INTF
// transcriptions of the Münster room share it). One line unit is an <ab n="B04K1V1"> (book, chapter, line in the INTF
// book numbers, Matthew 1 to Revelation 27) or <ab n="John.1.1">; a unit split by a page break continues in an <ab part="F">.
// The reader keeps the first hand, the letters as written, and where the text is lost:
//  - the first hand of a correction (<app><rdg type="orig" hand="firsthand">) is read, always;
//  - a word with supplied letters (<supplied>) or a gap inside it was not fully read in the manuscript: it does not vote and
//    stands as a lacuna; so does a <gap> between words;
//  - unclear letters (<unclear>) and expanded abbreviations (<ex>) are read;
//  - a sacred name written short (<abbr type="nomSac">) is written out; a number written as letters (<num>) as its cardinal;
//  - running titles, notes, marginal material outside a correction (<fw>, <note>, <seg>) and punctuation are set aside;
//  - a word split over a line or page (<w part="I"> ... <w part="F">) is joined;
//  - a page that starts a fresh unit after a page break is read as if a lacuna stood between the pages, because a page that
//    was not transcribed would otherwise look like text the manuscript does not have; titles and subscriptions (line 0) are left out.
export type TeiWord = { w: string; gap: boolean };
/** book: the New Testament book (1 Matthew to 27 Revelation), or 0 for a book of the Greek translation of the Old Testament, whose First1KGreek work number is `lxx`. */
export type TeiUnit = { book: number; lxx?: string; ref: string; words: TeiWord[]; gapEnd: boolean };
const OSIS = ["Matt", "Mark", "Luke", "John", "Acts", "Rom", "1Cor", "2Cor", "Gal", "Eph", "Phil", "Col", "1Thess", "2Thess", "1Tim", "2Tim", "Titus", "Phlm", "Heb", "Jas", "1Pet", "2Pet", "1John", "2John", "3John", "Jude", "Rev"];
type Node = { t: string; a: Record<string, string>; c: (Node | string)[] };
const ENT: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'" };
const unent = (s: string) => s.replace(/&(#x[0-9a-fA-F]+|#\d+|\w+);/g, (m, e) => e[0] === "#" ? String.fromCodePoint(e[1] === "x" ? parseInt(e.slice(2), 16) : +e.slice(1)) : ENT[e] ?? m);
/** A small XML parser: elements, attributes and text; comments, processing instructions and CDATA are dropped. */
export function parseXml(xml: string): Node {
  const root: Node = { t: "#root", a: {}, c: [] }, stack = [root];
  xml = xml.replace(/<!--[\s\S]*?-->/g, "").replace(/<\?[\s\S]*?\?>/g, "").replace(/<!\[CDATA\[[\s\S]*?\]\]>/g, "").replace(/<!DOCTYPE[^>]*>/g, "");
  const re = /<(\/?)([A-Za-z_][\w:.-]*)((?:\s+[\w:.-]+\s*=\s*(?:"[^"]*"|'[^']*'))*)\s*(\/?)>|([^<]+)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(xml))) {
    if (m[5] !== undefined) { stack[stack.length - 1].c.push(unent(m[5])); continue; }
    const name = m[2].replace(/^.*:/, "");
    if (m[1]) { for (let i = stack.length - 1; i > 0; i--) if (stack[i].t === name) { stack.length = i; break; } continue; }
    const a: Record<string, string> = {};
    for (const x of m[3].matchAll(/([\w:.-]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g)) a[x[1].replace(/^.*:/, "")] = unent(x[2] ?? x[3]);
    const n: Node = { t: name, a, c: [] };
    stack[stack.length - 1].c.push(n);
    if (!m[4]) stack.push(n);
  }
  return root;
}
const skel = (w: string) => w.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().replace(/[ςϲ]/g, "σ").replace(/[^α-ωϛϟ]/g, "");
/** The Septuagint books of Codex Sinaiticus, by the project's name, as the keys of scripts/ot.ts (First1KGreek work numbers). */
const CSP_LXX: Record<string, string> = { GEN: "001", LEV: "003", NUM: "004", DEUT: "005", JOSH: "006", JUDG: "008", "1CHR": "015", "2ESD": "018", EST: "019", TOB: "021", JDT: "020", "1MACC": "023", "4MACC": "026", ISA: "048", JER: "049", LAM: "051", JOEL: "039", OBAD: "040", JONAH: "041", NAH: "042", HAB: "043", ZEPH: "044", HAG: "045", ZECH: "046", MAL: "047", PS: "027", PROV: "029", ECCL: "030", CANT: "031", WIS: "033", SIR: "034", JOB: "032" };
const CSP: Record<string, string> = { MATT: "Matt", MARK: "Mark", LUKE: "Luke", JOHN: "John", ACTS: "Acts", ROM: "Rom", "1COR": "1Cor", "2COR": "2Cor", GAL: "Gal", EPH: "Eph", PHIL: "Phil", COL: "Col", "1THESS": "1Thess", "2THESS": "2Thess", "1TIM": "1Tim", "2TIM": "2Tim", TITUS: "Titus", PHLM: "Phlm", HEB: "Heb", JAS: "Jas", "1PET": "1Pet", "2PET": "2Pet", "1JOHN": "1John", "2JOHN": "2John", "3JOHN": "3John", JUDE: "Jude", REV: "Rev" };
/** Book number (1 to 27) and chapter:line of a unit name, or undefined for a title, subscription or unknown name. */
export function unitRef(n: string): { book: number; lxx?: string; ref: string } | undefined {
  let m = n.match(/^V-B\d+K(\d+)V(\d+)-\d+-([0-9A-Z]+)$/);
  if (m) {
    if (!+m[1] || !+m[2]) return undefined;
    if (CSP_LXX[m[3]]) return { book: 0, lxx: CSP_LXX[m[3]], ref: `${+m[1]}:${+m[2]}` };
    const b = OSIS.indexOf(CSP[m[3]] ?? "") + 1; return b ? { book: b, ref: `${+m[1]}:${+m[2]}` } : undefined;
  }
  m = n.match(/^B(\d+)K(\d+)V(\d+)/);
  if (m) return +m[3] && +m[2] && +m[1] >= 1 && +m[1] <= 27 ? { book: +m[1], ref: `${+m[2]}:${+m[3]}` } : undefined;
  m = n.match(/^([1-3]?[A-Za-z]+)\.(\d+)\.(\d+)/);
  if (m) { const b = OSIS.indexOf(m[1]) + 1; return b && +m[2] && +m[3] ? { book: b, ref: `${+m[2]}:${+m[3]}` } : undefined; }
  return undefined;
}
export type Spell = { sacred: (w: string) => string; numeral: (letters: string) => string[] | undefined };
const FIRST = (r: Node) => r.a.type === "orig" || r.a.type === "main-corr" || r.a.hand === "firsthand" || r.a.hand === "*" || r.a.hand === "firsthand*";
export type TeiStats = { corrections: number; lacunae: number; words: number };
/** Reads one transcription file into its line units in text order, plus scribal correction and lacuna counts. */
export function teiUnitsWithStats(xml: string, sp: Spell): { units: TeiUnit[]; stats: TeiStats } {
  const body = xml.replace(/<teiHeader[\s\S]*?<\/teiHeader>/, "");
  const root = parseXml(body), units: TeiUnit[] = [], CONT = new Set<TeiUnit>();
  let cur: TeiUnit | undefined, gap = false, page = true, last = "";
  let corrections = 0, lacunae = 0, totalWords = 0;
  type W = { text: string; damaged: boolean; sacred: boolean; num: boolean };
  let word: W | undefined, pending: W | undefined;
  const emit = (x: W) => {
    if (!cur) return;
    let ws = [skel(x.text)];
    if (x.num) ws = sp.numeral(ws[0]) ?? ws; else if (x.sacred) ws = [sp.sacred(ws[0])];
    if (x.damaged) { gap = true; lacunae++; return; }
    if (!ws[0]) return; // punctuation only
    for (const [i, w] of ws.entries()) { cur.words.push({ w, gap: i === 0 && gap }); totalWords++; }
    gap = false;
  };
  const endUnit = () => { if (cur) { cur.gapEnd = cur.gapEnd || gap; } };
  const walk = (n: Node | string, inRdg: boolean) => {
    if (typeof n === "string") { if (word) word.text += n; return; }
    switch (n.t) {
      case "teiHeader": case "note": case "fw": case "pc": case "space": case "lb": case "cb": case "milestone": case "witness": case "listWit": case "margin": case "ptr": return;
      case "pb": if (!word) page = true; return;
      case "seg": if (!inRdg && !word) return; break;
      case "div": if (/^(incipit|explicit|inscriptio|subscriptio|title)/.test(n.a.type ?? "")) return; break;
      case "gap": if (word) word.damaged = true; else { gap = true; lacunae++; } return;
      case "supplied": if (word) word.damaged = true; break;
      case "abbr": if (word && n.a.type === "nomSac") word.sacred = true; break;
      case "hi": if (word && n.a.rend === "ol2") word.sacred = true; break; // the Codex Sinaiticus Project's overline of a sacred name
      case "num": if (word) word.num = true; break;
      case "ab": {
        const r = unitRef(n.a.id?.startsWith("V-") ? n.a.id : n.a.n ?? "");
        const cont = (n.a.part === "F" || n.a.part === "M") && r && cur && `${r.book} ${r.lxx ?? ""} ${r.ref}` === last;
        if (!cont) { if (pending) { emit(pending); pending = undefined; } endUnit(); if (page && cur) cur.gapEnd = true; }
        if (r) {
          if (!cont) gap = page;
          cur = { book: r.book, ...(r.lxx ? { lxx: r.lxx } : {}), ref: r.ref, words: [], gapEnd: false }; units.push(cur); last = `${r.book} ${r.lxx ?? ""} ${r.ref}`;
          if (cont) CONT.add(cur);
          page = false;
        } else cur = undefined;
        for (const x of n.c) walk(x, inRdg);
        return;
      }
      case "w": {
        if (word) break; // a word inside a word (a correction of some of its letters): its letters are the outer word's
        if ((n.a.part === "M" || n.a.part === "F") && pending) { word = pending; pending = undefined; }
        else { if (pending) emit(pending); pending = undefined; word = { text: "", damaged: false, sacred: false, num: false }; }
        for (const x of n.c) walk(x, inRdg);
        const w = word!; word = undefined;
        if (n.a.part === "I" || n.a.part === "M") pending = w; else emit(w);
        return;
      }
      case "app": {
        const rdgs = n.c.filter((x): x is Node => typeof x !== "string" && x.t === "rdg");
        if (rdgs.length > 1) corrections++;
        const pick = rdgs.find(FIRST) ?? rdgs[0];
        if (pick) for (const x of pick.c) walk(x, true);
        return;
      }
    }
    for (const x of n.c) walk(x, inRdg);
  };
  walk(root, false);
  if (pending) emit(pending);
  endUnit();
  const occ: TeiUnit[] = [];
  for (const u of units) {
    const o = occ[occ.length - 1];
    if (CONT.has(u) && o && o.book === u.book && o.lxx === u.lxx && o.ref === u.ref) { if (u.words.length && o.gapEnd) u.words[0].gap = true; o.words.push(...u.words); o.gapEnd = u.gapEnd || (o.gapEnd && !u.words.length); }
    else occ.push(u);
  }
  const out: TeiUnit[] = [], at = new Map<string, number>();
  for (const u of occ) {
    const k = `${u.book} ${u.lxx ?? ""} ${u.ref}`, i = at.get(k);
    if (i === undefined) { at.set(k, out.length); out.push(u); } else if (u.words.length > out[i].words.length) out[i] = u;
  }
  return { units: out.filter((u) => u.words.length || u.gapEnd), stats: { corrections, lacunae, words: totalWords } };
}
/** Reads one transcription file into its line units in text order (several units can share a ref when a unit is split by a page). */
export function teiUnits(xml: string, sp: Spell): TeiUnit[] {
  return teiUnitsWithStats(xml, sp).units;
}
export const OSIS_BOOKS = OSIS;
