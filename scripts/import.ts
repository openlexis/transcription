// Brings the source archives' manuscript transcriptions into archives/<archive>/, one file per transcription, and lists every
// manuscript with its date, source archive and links in archives/manuscripts.json.
//   bun scripts/import.ts <folder with the archives' downloaded files>
// Naming: archives/{archive}/{manuscript}.xml, or archives/{archive}/{manuscript}.{part}.xml when one manuscript and archive
// give more than one file. Where the source archive publishes TEI XML (or other XML), that file is stored unchanged. Where the
// source archive publishes no XML, a TEI P5 document is written, and the inventory says so.
// Line and word counts in the inventory are taken from the first hand of each transcription. Nothing from a printed
// edition, translation or image is read.
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { parseXml, teiUnits, type TeiUnit } from "./lib/tei";
import { HEB_BOOKS, NT_BOOKS, numeral, sacred, skel } from "./lib/text";

const SRC = process.argv[2];
if (!SRC || !existsSync(SRC)) throw new Error("usage: bun scripts/import.ts <folder with the source archives' files>");
const ROOT = new URL("..", import.meta.url).pathname;
rmSync(`${ROOT}transcriptions`, { recursive: true, force: true });
mkdirSync(`${ROOT}archives`, { recursive: true });
// sets/ and the archive records (manuscripts/, transcriptions/: docs/archive-records.md) are kept; run bun scripts/records.ts after an import
const KEEP = new Set(["manuscripts.json", "books.json", "sets", "manuscripts", "transcriptions"]);
for (const f of readdirSync(`${ROOT}archives`)) if (!KEEP.has(f)) rmSync(`${ROOT}archives/${f}`, { recursive: true, force: true });

const snap = (p: string) => { const d = readdirSync(`${SRC}/${p}`).filter((x) => /^\d{4}-\d\d-\d\d$/.test(x)).sort().pop()!; return `${SRC}/${p}/${d}`; };
const zipList = (zip: string) => spawnSync("unzip", ["-Z1", zip], { maxBuffer: 1 << 26 }).stdout.toString().split("\n").filter(Boolean).sort();
const memberBuf = (zip: string, m: string) => {
  const r = spawnSync("unzip", ["-p", zip, m.replace(/[\[\]*?\\]/g, "\\$&")], { maxBuffer: 1 << 30 });
  if (r.status !== 0) throw new Error(`unzip ${zip} ${m}`);
  return r.stdout as Buffer;
};
const member = (zip: string, m: string) => memberBuf(zip, m).toString("utf8");
export function gaSiglum(s: string): string | undefined {
  let m = s.match(/^P0*(\d+)$/); if (m) return `P${+m[1]}`;
  m = s.match(/^0(\d+)$/); if (m) return `0${m[1].replace(/^0+(?=\d{2})/, "")}`;
  m = s.match(/^([1-9]\d*)$/); if (m) return m[1];
  m = s.match(/^L0*([1-9]\d*)$/); if (m) return `L${m[1]}`; // a lectionary
  return undefined;
}
const docOf = (s: string) => (s.startsWith("P") ? 10000 + +s.slice(1) : s.startsWith("L") ? 40000 + +s.slice(1) : s.startsWith("0") ? 20000 + +s : 30000 + +s);

const xmlName = (siglum: string, archive: string, part?: string) => { mkdirSync(`${ROOT}archives/${archive}`, { recursive: true }); return `archives/${archive}/${siglum}${part ? `.${part}` : ""}.xml`; };
const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
/** A TEI P5 document for a transcription whose source archive publishes no XML. */
function teiDoc(o: { title: string; source: string; license: string; why: string; lang?: string; body: string }) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<TEI xmlns="http://www.tei-c.org/ns/1.0">
<teiHeader>
<fileDesc>
<titleStmt><title>${esc(o.title)}</title></titleStmt>
<publicationStmt><p>${esc(o.license)}</p><p>${esc(o.why)}</p></publicationStmt>
<sourceDesc><p>${esc(o.source)}</p></sourceDesc>
</fileDesc>
</teiHeader>
<text${o.lang ? ` xml:lang="${esc(o.lang)}"` : ""}>
<body>
${o.body}
</body>
</text>
</TEI>
`;
}
const WHY_PLAIN = "The source archive publishes this transcription as plain text, not XML. This file places that text, unchanged, in a TEI P5 document, which is the closest scholarly standard for a transcription of a single manuscript.";
const WHY_TF = "The source archive publishes this transcription as Text-Fabric data, not XML. This file is a TEI P5 transcription made from that data, which is the closest scholarly standard for a transcription of a single manuscript.";

// ---------- the source archives ----------
type Archive = { id: string; name: string; web: string; license: string };
const ARCHIVES: Record<string, Archive> = {
  "sinaiticus-project": { id: "sinaiticus-project", name: "Codex Sinaiticus Project", web: "https://epapers.bham.ac.uk/id/eprint/3306/", license: "CC BY-NC-SA 3.0 (the ePapers record)" },
  zacynthius: { id: "zacynthius", name: "ITSEE, University of Birmingham (Codex Zacynthius project)", web: "https://edata.bham.ac.uk/496/", license: "CC BY 4.0 (the eData record)" },
  "igntp-john": { id: "igntp-john", name: "International Greek New Testament Project (IGNTP), John", web: "https://itseeweb.cal.bham.ac.uk/iohannes/", license: "CC BY 4.0 (each file's header)" },
  "igntp-romans": { id: "igntp-romans", name: "INTF and ITSEE, Romans", web: "https://edata.bham.ac.uk/1111/", license: "CC BY 4.0 (the eData record and each file's header)" },
  "igntp-galatians": { id: "igntp-galatians", name: "INTF and ITSEE, Galatians", web: "https://edata.bham.ac.uk/1107/", license: "CC BY 4.0 (each file's header)" },
  "igntp-ephesians": { id: "igntp-ephesians", name: "INTF and ITSEE, Ephesians", web: "https://edata.bham.ac.uk/1109/", license: "CC BY 4.0 (each file's header)" },
  "igntp-2thessalonians": { id: "igntp-2thessalonians", name: "ITSEE, 2 Thessalonians", web: "https://edata.bham.ac.uk/510/", license: "CC BY 4.0 (the eData record)" },
  "family-pi-mark": { id: "family-pi-mark", name: "ITSEE, Family Π in Mark", web: "https://edata.bham.ac.uk/983/", license: "CC BY 4.0 (the eData record and the files' headers)" },
  intf: { id: "intf", name: "Institut für Neutestamentliche Textforschung (INTF), New Testament Virtual Manuscript Room", web: "https://ntvmr.uni-muenster.de/", license: "per file, see the transcription's entry" },
  "igntp-catena": { id: "igntp-catena", name: "ITSEE, University of Birmingham, catenae on Romans and Ephesians", web: "https://doi.org/10.25500/edata.bham.00001097", license: "CC BY 4.0 (each file's header)" },
  uxlc: { id: "uxlc", name: "Unicode/XML Leningrad Codex (Tanach.us)", web: "https://tanach.us/", license: "\"All biblical Hebrew text, in any format, may be viewed or copied without restriction\" (Tanach.us)" },
  "dt-ucph-sp": { id: "dt-ucph-sp", name: "Samaritanus project and CACCHT, Samaritan Pentateuch", web: "https://doi.org/10.5281/zenodo.7734632", license: "CC BY-NC 4.0" },
  "etcbc-dss": { id: "etcbc-dss", name: "ETCBC and CACCHT, biblical Dead Sea Scrolls", web: "https://github.com/ETCBC/dss", license: "CC BY-NC 4.0" },
  cntr: { id: "cntr", name: "Center for New Testament Restoration (CNTR)", web: "https://github.com/Center-for-New-Testament-Restoration/transcriptions/tree/4e743a41a4b2ca010ece53229cd272aa59b1efe6", license: "CC BY-SA 4.0 (the repository's LICENSE.md)" },
};
/** The order in which transcriptions of one manuscript are listed (and break a tie, scripts/METHOD.md). */
export const ARCHIVE_ORDER = Object.keys(ARCHIVES);

// ---------- manuscripts ----------
type Transcription = { archive: string; file?: string; files?: string[]; source: string; member?: string; format: string; license: string; lines: number; words: number };
/** kind: a continuous-text manuscript; a lectionary (readings in the order of the church year); a catena (commentary with the
 * biblical text in pieces); a scroll (a fragmentary scroll from the Judaean desert). Only a continuous-text manuscript can show
 * that a word is absent (scripts/METHOD.md). */
type Kind = "continuous" | "lectionary" | "catena" | "scroll";
type Manuscript = { siglum: string; kind: Kind; language: string; name?: string; shelfmark?: string; century?: string; year?: number; dateSource?: string; viewer?: { name: string; url: string }[]; transcriptions: Transcription[] };
const MSS = new Map<string, Manuscript>();
const intf = snap("intf-ntvmr");
const rdCat = (f: string) => JSON.parse(readFileSync(`${intf}/${f}`, "utf8")).data.manuscripts.manuscript as { docID: number; lang: string; orig: string; origEarly: number; origLate: number }[];
const CAT = new Map(rdCat("catalogue.json").map((m) => [m.docID, m]));
const IMAGES = new Set(rdCat("images.json").map((m) => m.docID));
const FAX = JSON.parse(readFileSync(`${SRC}/../forensics/facsimiles.json`, "utf8")).sources as Record<string, { name: string; shelfmark?: string; century?: string; facsimiles?: { provider: string; url: string }[] }>;

const lineOrder = (a: string, b: string) => { const [x, y] = [a, b].map((r) => r.split(":").map(Number)); return x[0] - y[0] || x[1] - y[1]; };
const NT_ORDER = NT_BOOKS.map((b) => b.id);
const OSIS = NT_ORDER;
/** Writes one transcription: units in book, chapter, line order. */
type Unit = { book: string; ref: string; words: { w: string; gap: boolean }[]; gapEnd: boolean; absent?: boolean };
type Opts = { member?: string; format?: string; part?: string; xml?: string | Buffer; files?: { part: string; xml: string | Buffer }[]; why?: string; title?: string; dir?: string; order?: string[]; kind?: Kind; language?: string; date?: { century: string; year?: number; from?: number; to?: number; basis?: string; source: string }; name?: string; shelfmark?: string; viewer?: { name: string; url: string }[] };
function save(siglum: string, archive: string, source: string, license: string, units: Unit[], faxKey?: string, o: Opts = {}) {
  siglum = gaSiglum(siglum) ?? siglum;
  const OSIS = o.order ?? NT_ORDER;
  const by = new Map<string, typeof units[number]>();
  for (const u of units) { const k = `${u.book} ${u.ref}`; const o = by.get(k); if (!o || u.words.length > o.words.length) by.set(k, u); }
  const list = [...by.values()].sort((a, b) => OSIS.indexOf(a.book) - OSIS.indexOf(b.book) || lineOrder(a.ref, b.ref));
  let words = 0;
  const text = list.map((u) => {
    if (u.absent) return `${u.book} ${u.ref}\t-`;
    const ws: string[] = [];
    for (const x of u.words) { if (x.gap) ws.push("…"); ws.push(x.w); words++; }
    if (u.gapEnd) ws.push("…");
    return `${u.book} ${u.ref}\t${ws.join(" ")}`;
  }).filter((l) => !/\t$/.test(l));
  if (!words) return;
  let file: string | undefined, files: string[] | undefined;
  if (o.files?.length) {
    files = o.files.map((f) => { const q = xmlName(siglum, archive, f.part); writeFileSync(`${ROOT}${q}`, f.xml); return q; });
  } else {
    file = xmlName(siglum, archive, o.part);
    const xml = o.xml ?? teiDoc({
      title: o.title ?? `Manuscript ${siglum}`,
      source, license, why: o.why ?? WHY_TF,
      lang: (o.language ?? "Greek").startsWith("Hebrew") ? "hbo" : "grc",
      body: list.map((u) => {
        if (u.absent) return `<ab type="absent" n="${esc(`${u.book} ${u.ref}`)}"/>`;
        const parts: string[] = [];
        for (const x of u.words) { if (x.gap) parts.push('<gap reason="lost"/>'); parts.push(`<w>${esc(x.w)}</w>`); }
        if (u.gapEnd) parts.push('<gap reason="lost"/>');
        return `<ab n="${esc(`${u.book} ${u.ref}`)}">${parts.join("")}</ab>`;
      }).join("\n"),
    });
    writeFileSync(`${ROOT}${file}`, xml);
  }
  let m = MSS.get(siglum);
  if (!m) {
    const c = o.language && o.language !== "Greek" ? undefined : CAT.get(docOf(siglum));
    const f = (faxKey && FAX[faxKey]) || FAX[`intf-ntvmr/${siglum}`] || FAX[`cntr-mss/${siglum}`];
    const viewer: { name: string; url: string }[] = [];
    if (!o.dir && IMAGES.has(docOf(siglum))) viewer.push({ name: "INTF New Testament Virtual Manuscript Room", url: `https://ntvmr.uni-muenster.de/manuscript-workspace?docID=${docOf(siglum)}` });
    for (const x of f?.facsimiles ?? []) if (!viewer.some((v) => v.url === x.url)) viewer.push({ name: x.provider, url: x.url });
    for (const v of o.viewer ?? []) if (!viewer.some((x) => x.url === v.url)) viewer.push(v);
    const name = o.name ?? f?.name, shelfmark = o.shelfmark ?? f?.shelfmark;
    const date = o.date ?? (c?.origEarly ? { century: String(c.orig), year: Math.round((c.origEarly + c.origLate) / 2), from: c.origEarly, to: c.origLate, basis: "catalogue date range (the catalogue does not state its method)", source: "INTF catalogue (catalogue.json in the archive's metadata)" } : f?.century ? { century: f.century, source: "not stated in the archive records" } : undefined);
    m = { siglum, kind: o.kind ?? "continuous", language: o.language ?? "Greek", ...(name ? { name } : {}), ...(shelfmark ? { shelfmark } : {}), ...(date ? { century: date.century, ...(date.year !== undefined ? { year: date.year } : {}), ...(date.from !== undefined ? { yearFrom: date.from, yearTo: date.to } : {}), ...(date.basis ? { dateBasis: date.basis } : {}), dateSource: date.source } : {}), viewer, transcriptions: [] };
    MSS.set(siglum, m);
  }
  m.transcriptions.push({ archive, ...(file ? { file } : {}), ...(files ? { files } : {}), source, ...(o.member ? { member: o.member } : {}), format: o.format ?? "TEI XML", license, lines: text.length, words });
}
const fromTei = (us: TeiUnit[]) => us.filter((u) => u.book >= 1).map((u) => ({ book: OSIS[u.book - 1], ref: u.ref, words: u.words, gapEnd: u.gapEnd }));
const SP = { sacred, numeral };

// ---------- CNTR: one line per text line, "BBCCCLLL text" ----------
function cntrLine(text: string) {
  // corrections "x{first hand} {correction}": the first hand is read, always
  const t = text.replace(/x\{([^}]*)\}(?:\s*[ab]?\{[^}]*\})*/g, "$1").replace(/[a-z]?\{([^}]*)\}/g, "$1");
  const words: { w: string; gap: boolean }[] = [];
  let gap = false;
  for (const raw of t.split(/\s+/)) {
    if (!raw) continue;
    const tok = raw.replace(/\\\d*/g, "");
    const letters = [...tok].filter((c) => /\p{L}/u.test(c) || c === "¯").length;
    const first = tok.search(/[\p{L}¯]/u), last = Math.max(...[...tok].map((c, i) => (/[\p{L}¯]/u.test(c) ? i : -1)));
    const marks = [...tok].map((c, i) => (c === "*" || c === "&" ? i : -1)).filter((i) => i >= 0);
    if (!letters) { if (marks.length || tok.includes("\uFFFD")) gap = true; continue; }
    if (marks.some((i) => i < first)) gap = true;
    const damaged = tok.includes("~") || tok.includes("^") || tok.includes("\uFFFD");
    let ws = [skel(tok.replace(/[|\/%^~+*&\[\]_⋄$]/g, "").replace(/=/g, "").replace(/¯/g, "ν"))];
    if (tok.includes("$")) ws = numeral(ws[0]) ?? ws;
    else if (tok.includes("=")) ws = [sacred(ws[0])];
    if (damaged || !ws[0]) gap = true;
    else { ws.forEach((w, i) => words.push({ w, gap: i === 0 && gap })); gap = false; }
    if (marks.some((i) => i > last)) gap = true;
  }
  return { words, gapEnd: gap };
}
function cntr(path: string, siglum: string, faxKey: string, src: string) {
  const raw = readFileSync(path, "utf8");
  const units = [];
  for (const l of raw.split("\n")) {
    const m = l.match(/^(\d\d)(\d{3})(\d{3}) (.*)$/); if (!m) continue;
    const book = OSIS[+m[1] - 40]; if (!book) continue;
    const ref = `${+m[2]}:${+m[3]}`;
    if (m[4].trim() === "-") { units.push({ book, ref, words: [], gapEnd: false, absent: true }); continue; }
    units.push({ book, ref, ...cntrLine(m[4]) });
  }
  const xml = teiDoc({ title: `Manuscript ${siglum}, from the Center for New Testament Restoration`, source: src.replace("/tree/", "/blob/"), license: ARCHIVES.cntr.license, why: WHY_PLAIN, lang: "grc", body: `<ab type="source-text">${esc(raw)}</ab>` });
  save(siglum, "cntr", src.replace("/tree/", "/blob/"), ARCHIVES.cntr.license, units, faxKey, { format: "TEI P5 (the source archive publishes no XML; the body is the archive's plain text, unchanged)", xml });
}

// ---------- run ----------
const CNTR_LEFT_OUT = new Set(["O23"]); // not a Gregory-Aland number the INTF catalogue knows
const cm = `${snap("cntr-mss")}/class 1`;
for (const f of readdirSync(cm).filter((f) => f.endsWith(".txt")).sort()) {
  const n = f.slice(0, -4); if (CNTR_LEFT_OUT.has(n)) continue;
  cntr(`${cm}/${f}`, n, `cntr-mss/${n}`, `${ARCHIVES.cntr.web}/class%201/${n}.txt`);
}
for (const n of ["01", "02", "03", "04"]) cntr(`${snap(`cntr-${n}`)}/class 1/${n}.txt`, n, `cntr-${n}`, `${ARCHIVES.cntr.web}/class%201/${n}.txt`);
console.log(`cntr: ${MSS.size} manuscripts`);

{ // Codex Sinaiticus Project (its New Testament books)
  const A = ARCHIVES["sinaiticus-project"], zip = `${snap("sinaiticus-project")}/FINAL_TRANSCRIPTION_version105.xml.zip`;
  const sina = memberBuf(zip, "FINAL_TRANSCRIPTION_version105.xml");
  save("01", A.id, "https://epapers.bham.ac.uk/id/eprint/3306/1/FINAL_TRANSCRIPTION_version105.xml.zip", A.license, fromTei(teiUnits(sina.toString("utf8"), SP)), "sinaiticus-project", { member: "FINAL_TRANSCRIPTION_version105.xml", format: "TEI XML (the source archive's file, unchanged)", xml: sina });
}
{ const A = ARCHIVES.zacynthius; const zac = readFileSync(`${snap("zacynthius")}/Zacynthius-gospel_2-0.xml`); save("040", A.id, "https://edata.bham.ac.uk/496/", A.license, fromTei(teiUnits(zac.toString("utf8"), SP)), "zacynthius", { member: "Zacynthius-gospel_2-0.xml", format: "TEI XML (the source archive's file, unchanged)", xml: zac }); }

const DONE = new Set<string>();
const teiZip = (F: string, zip: string, pick: (m: string) => string | undefined, url: string) => {
  const A = ARCHIVES[F], seen = new Set<string>();
  let n = 0;
  for (const m of zipList(`${snap(F)}/${zip}`)) {
    const s = pick(m); if (!s || seen.has(s) || DONE.has(`${F}/${s}`)) continue; seen.add(s); DONE.add(`${F}/${s}`); n++;
    const xml = memberBuf(`${snap(F)}/${zip}`, m);
    save(s, A.id, url, A.license, fromTei(teiUnits(xml.toString("utf8"), SP)), undefined, { member: m, format: "TEI XML (the source archive's file, unchanged)", xml, ...(s.startsWith("L") ? { kind: "lectionary" as Kind } : {}) });
  }
  console.log(`${F}: ${n} files`);
};
for (const zip of ["IGNTP_greek_john_transcriptions.zip", "Family1_greek_john_transcriptions.zip", "Byzantine_john_transcriptions.zip"])
  teiZip("igntp-john", zip, (m) => (m.endsWith(".xml") ? gaSiglum(m.replace(/^.*\//, "").replace(/^04_/, "").replace(/\.xml$/, "")) : undefined), `https://itseeweb.cal.bham.ac.uk/iohannes/downloads/${zip}`);
const ecm = (m: string) => (/^ecm_[a-z]+\/NT_GRC_[^/]+\.xml$/.test(m) ? gaSiglum(m.match(/NT_GRC_([^_]+)_/)?.[1] ?? "") : undefined);
teiZip("igntp-romans", "Romans-transcriptions.zip", ecm, "https://edata.bham.ac.uk/1111/5/Romans-transcriptions.zip");
teiZip("igntp-galatians", "Galatians-transcriptions.zip", ecm, "https://edata.bham.ac.uk/1107/7/Galatians-transcriptions.zip");
teiZip("igntp-ephesians", "Ephesians-transcriptions.zip", ecm, "https://edata.bham.ac.uk/1109/7/Ephesians-transcriptions.zip");
const nn = (m: string) => (/^(transcriptions\/)?\d\d_[^/]+\.xml$/.test(m) ? gaSiglum(m.replace(/^(transcriptions\/)?\d\d_/, "").replace(/\.xml$/, "")) : undefined);
teiZip("igntp-2thessalonians", "transcriptions.zip", nn, "https://edata.bham.ac.uk/510/1/transcriptions.zip");
teiZip("family-pi-mark", "transcriptions.zip", nn, "https://edata.bham.ac.uk/983/4/transcriptions.zip");

{ // INTF: every Greek continuous-text manuscript (papyrus, majuscule, minuscule) with a transcription
  let n = 0;
  for (const f of readdirSync(`${intf}/transcriptions`).filter((f) => f.endsWith(".xml")).sort()) {
    const d = +f.slice(0, -4), c = CAT.get(d);
    if (!c || !/^g/.test(c.lang) || d < 10000 || d >= 50000) continue;
    const k = d % 10000, lect = d >= 40000, s = gaSiglum(lect ? `L${d - 40000}` : d < 20000 ? `P${k}` : d < 30000 ? `0${k}` : String(k)); if (!s) continue;
    const xml = readFileSync(`${intf}/transcriptions/${f}`);
    const head = xml.toString("utf8").slice(0, 20000);
    const license = /creativecommons\.org\/licenses\/by\/4\.0/.test(head) ? "CC BY 4.0 (the file's header)" : /All rights reserved/i.test(head) ? "the file's header states \"All rights reserved by the INTF\"" : "the file's header states no license";
    save(s, "intf", `https://ntvmr.uni-muenster.de/community/api/transcript/get/?docID=${d}&pageID=ALL&format=teiraw`, license, fromTei(teiUnits(xml.toString("utf8"), SP)), undefined, { format: "TEI XML (the source archive's file, unchanged)", xml, ...(lect ? { kind: "lectionary" as Kind } : {}) });
    if (++n % 100 === 0) console.log(`intf: ${n}`);
  }
  console.log(`intf: ${n} files`);
}


// ---------- catenae: the biblical text (lemmata) of commentary manuscripts, IGNTP/ITSEE Romans and Ephesians ----------
{
  const dir = snap("igntp-catena"); let n = 0;
  const OSIS_OF: Record<string, string> = { Rom: "Rom", Eph: "Eph" };
  for (const bk of ["romans", "ephesians"]) for (const f of readdirSync(`${dir}/${bk}`).filter((f) => /^\d+\.xml$/.test(f)).sort()) {
    const siglum = gaSiglum(f.slice(0, -4)); if (!siglum) continue;
    const catXml = readFileSync(`${dir}/${bk}/${f}`);
    const root = parseXml(catXml.toString("utf8").replace(/<teiHeader[\s\S]*?<\/teiHeader>/, ""));
    const units: Unit[] = [];
    const walk = (x: any, ref?: string) => {
      if (typeof x === "string") return;
      if (x.t === "div" && x.a.verseBegin && x.a.verseBegin === x.a.verseEnd) { const m = x.a.verseBegin.match(/^(\w+)\.(\d+)\.(\d+)$/); if (m && OSIS_OF[m[1]]) ref = `${OSIS_OF[m[1]]} ${+m[2]}:${+m[3]}`; }
      if (x.t === "div" && x.a.verseBegin && x.a.verseBegin !== x.a.verseEnd) ref = undefined;
      if (x.t === "ab" && x.a.type === "biblical") {
        if (!ref) return;
        const words: { w: string; gap: boolean }[] = []; let gap = false;
        const take = (n: any) => {
          if (typeof n === "string") return;
          if (n.t === "gap") { gap = true; return; }
          if (n.t === "w") {
            let damaged = false, sac = false; const txt = (q: any): string => typeof q === "string" ? q : (q.t === "supplied" || q.t === "gap" ? (damaged = true, "") : q.t === "note" || q.t === "pc" ? "" : (q.t === "abbr" && q.a.type === "nomSac" ? (sac = true) : 0, q.c.map(txt).join("")));
            const w0 = skel(txt(n)); const w = sac ? sacred(w0) : w0;
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
    // a lemma can be split over several pieces of commentary: the pieces of one line are joined in order
    const joined = new Map<string, Unit>();
    for (const u of units) { const k = `${u.book} ${u.ref}`, o = joined.get(k); if (!o) joined.set(k, { ...u, words: [...u.words] }); else { if (u.words[0]) u.words[0] = { ...u.words[0], gap: true }; o.words.push(...u.words); o.gapEnd = u.gapEnd; } }
    save(siglum, "igntp-catena", `https://doi.org/10.25500/edata.bham.00001097`, "CC BY 4.0 (each file's header)", [...joined.values()], undefined, { kind: "catena", member: `${bk}/${f}`, format: "TEI XML (the source archive's file, unchanged)", xml: catXml, part: bk });
    n++;
  }
  console.log(`catena: ${n} files`);
}

// ---------- Old Testament: Hebrew and Aramaic ----------
const HEB = HEB_BOOKS.map((b) => b.id);
const tf = (path: string) => {
  const lines = readFileSync(path, "utf8").replace(/\n$/, "").split(/\r?\n/), out = new Map<number, string>();
  let i = 0; while (i < lines.length && lines[i] !== "") i++; i++;
  let node = 1;
  for (; i < lines.length; i++) { const l = lines[i], t = l.indexOf("\t"); if (t >= 0 && /^\d+$/.test(l.slice(0, t))) { node = +l.slice(0, t); out.set(node, l.slice(t + 1)); } else out.set(node, l); node++; }
  return out;
};
const firstLast = (x: string): [number, number] => { const ps = x.split(","), a = +ps[0].split("-")[0], z = ps[ps.length - 1].split("-"); return [a, +(z[1] ?? z[0])]; };
const spansOf = (os: Map<number, string>, f: Map<number, string>) => [...f.keys()].filter((n) => os.has(n)).map((n) => { const [a, z] = firstLast(os.get(n)!); return { a, z, v: f.get(n)! }; }).sort((x, y) => x.a - y.a);
const inSpan = (arr: { a: number; z: number; v: string }[], q: number) => { let lo = 0, hi = arr.length - 1; while (lo < hi) { const mid = (lo + hi + 1) >> 1; if (arr[mid].a <= q) lo = mid; else hi = mid - 1; } return arr[lo] && arr[lo].a <= q && q <= arr[lo].z ? arr[lo] : undefined; };
/** A Hebrew word as shown: letters and vowel points, without cantillation marks; a maqaf or space splits words. */
const hebWords = (raw: string) => raw.normalize("NFD").replace(/[\u0591-\u05AF\u05BD\u05C0\u05C3-\u05C6\u034F\u200C-\u200F\/\\]/g, "").split(/[\u05BE\s]+/).filter((w) => /[\u05D0-\u05EA]/.test(w)).map((w) => w.normalize("NFC"));
{ // the Leningrad Codex, UXLC: the words as written in the line (Ketiv); the marginal reading (Qere) is not the line's text
  const dir = `${snap("uxlc")}/downloads/Books`, units: Unit[] = [];
  for (const b of HEB_BOOKS) {
    const t = readFileSync(`${dir}/${b.uxlc}.xml`, "utf8");
    let c = "", cur: Unit | undefined;
    for (const x of t.matchAll(/<c n="(\d+)">|<v n="(\d+)"[^>]*>|<(w|k)>([\s\S]*?)<\/\3>/g)) {
      if (x[1]) c = x[1];
      else if (x[2]) { cur = { book: b.id, ref: `${+c}:${+x[2]}`, words: [], gapEnd: false }; units.push(cur); }
      else if (cur) for (const w of hebWords(x[4].replace(/<[^>]*>/g, ""))) cur.words.push({ w, gap: false });
    }
  }
  save("L", "uxlc", "https://github.com/nerd-bible/tanach.us/tree/a89d77f15771e885038015c20d425c04ee2", "Tanach.us: \"All biblical Hebrew text, in any format, may be viewed or copied without restriction\"", units, "uxlc",
    { member: "downloads/Books/<book>.xml", format: "XML (UXLC), one file per book (the source archive's original files, unchanged)", dir: "hebrew", order: HEB, language: "Hebrew",
      files: HEB_BOOKS.map((b) => ({ part: b.uxlc, xml: readFileSync(`${dir}/${b.uxlc}.xml`) })),
      date: { century: "11th (1008 or 1009)", year: 1008, from: 1008, to: 1009, basis: "colophon (a date written in the manuscript by its copyist)", source: "the colophon date as recorded with the Internet Archive images (forensics/facsimiles.json in the evidence repository)" } });
}
{ // the Samaritan Pentateuch: MS Dublin, Chester Beatty Library 751, and MS Garizim 1 from Deuteronomy 32:36b to the end
  const d = `${snap("sp")}/tf/7.5.0`, word = tf(`${d}/g_cons_utf8.tf`), trail = tf(`${d}/trailer.tf`), os = tf(`${d}/oslots.tf`);
  const bk = spansOf(os, tf(`${d}/book.tf`)), ch = spansOf(os, tf(`${d}/chapter.tf`)), vs = spansOf(os, tf(`${d}/verse.tf`));
  const by = new Map(HEB_BOOKS.map((b) => [b.uxlc, b.id]));
  const D1: Unit[] = [], G1: Unit[] = [];
  let cur = "", first = 0, u: Unit | undefined;
  const nodes = [...word.keys()].sort((a, b) => a - b);
  for (const [i, n] of nodes.entries()) {
    if (!cur) first = firstLast(os.get(n)!)[0];
    cur += word.get(n)!;
    if ((trail.get(n) ?? "") !== "" || i === nodes.length - 1) {
      const id = by.get(inSpan(bk, first)!.v)!, ref = `${+inSpan(ch, first)!.v}:${+inSpan(vs, first)!.v}`;
      const late = id === "Deut" && (+ref.split(":")[0] > 32 || (+ref.split(":")[0] === 32 && +ref.split(":")[1] >= 37));
      const list = late ? G1 : D1;
      if (!u || u.book !== id || u.ref !== ref || (list[list.length - 1] !== u)) { u = { book: id, ref, words: [], gapEnd: false }; list.push(u); }
      for (const w of hebWords(cur)) u.words.push({ w, gap: false });
      cur = "";
    }
  }
  const lic = "CC BY-NC 4.0 (the dataset's README and LICENSE)", src = "https://github.com/DT-UCPH/sp/tree/e8a120f2e92b6558fd39bbe72f830ded871a0a47";
  save("CBL751", "dt-ucph-sp", src, lic, D1, undefined, { format: "TEI P5 (the source archive publishes no XML; made from Text-Fabric data, tf/7.5.0)", why: WHY_TF, title: "Samaritan Pentateuch, Chester Beatty Library MS 751", dir: "hebrew", order: HEB, language: "Hebrew", name: "Samaritan Pentateuch, Chester Beatty Library MS 751", shelfmark: "Dublin, Chester Beatty Library, MS 751", date: { century: "13th (1225)", year: 1225, from: 1225, to: 1225, basis: "date stated by the project that made the transcription (its method is not stated there)", source: "http://schorch.at/html/samaritanus_english.html (the Samaritanus project, which made the transcription)" } });
  save("Garizim1", "dt-ucph-sp", src, lic, G1, undefined, { format: "TEI P5 (the source archive publishes no XML; made from Text-Fabric data, tf/7.5.0)", why: WHY_TF, title: "Samaritan Pentateuch, MS Garizim 1 (Deuteronomy 32:36b to the end)", dir: "hebrew", order: HEB, language: "Hebrew", name: "Samaritan Pentateuch, MS Garizim 1 (Deuteronomy 32:36b to the end)", shelfmark: "Mount Gerizim, MS Garizim 1" });
}
{ // the biblical scrolls from the Judaean desert (ETCBC dss): a word with a letter a modern editor reconstructed is lost
  const d = `${snap("dss")}/tf/2.0.5`;
  const otype = readFileSync(`${d}/otype.tf`, "utf8"), wr = /^(\d+)-(\d+)\tword$/m.exec(otype)!, w0 = +wr[1], w1 = +wr[2];
  const os = tf(`${d}/oslots.tf`), glyph = tf(`${d}/glyph.tf`), rec = tf(`${d}/rec.tf`), after = tf(`${d}/after.tf`);
  const book = tf(`${d}/book.tf`), chapter = tf(`${d}/chapter.tf`), verse = tf(`${d}/verse.tf`), sc = spansOf(os, tf(`${d}/scroll.tf`));
  const DSS_BOOK: Record<string, string> = { Is: "Isa", Ex: "Exod" }, ids = new Set(HEB);
  const out = new Map<string, Unit[]>();
  let cur = "", bad = false, at: { id: string; scroll: string; ref: string } | undefined, lostBefore = new Map<string, boolean>();
  for (let n = w0; n <= w1; n++) {
    const b = book.get(n);
    if (b !== undefined && !cur) {
      const id = DSS_BOOK[b] ?? b, sq = inSpan(sc, firstLast(os.get(n)!)[0]);
      at = ids.has(id) && sq && chapter.get(n) && verse.get(n) ? { id, scroll: sq.v.replace(/\//g, "-"), ref: `${chapter.get(n)}:${verse.get(n)}` } : undefined;
    }
    if (b === undefined) { cur = ""; bad = false; continue; }
    const [a, z] = firstLast(os.get(n)!);
    for (let q = a; q <= z; q++) { const g = (glyph.get(q) ?? "").replace(/[^\u05D0-\u05EA]/g, ""); if (!g) continue; if (rec.get(q) === "1") bad = true; cur += g; }
    if (after.get(n) === undefined && n < w1 && book.get(n + 1) !== undefined) continue; // a prefix: joined to the next word
    if (at && cur) {
      const list = out.get(at.scroll) ?? out.set(at.scroll, []).get(at.scroll)!;
      let u = list[list.length - 1];
      if (!u || u.book !== at.id || u.ref !== at.ref) { u = { book: at.id, ref: at.ref, words: [], gapEnd: false }; list.push(u); }
      if (bad) lostBefore.set(at.scroll, true);
      else { u.words.push({ w: cur, gap: !!lostBefore.get(at.scroll) }); lostBefore.set(at.scroll, false); }
    }
    cur = ""; bad = false;
  }
  for (const [scroll, units] of [...out].sort((x, y) => (x[0] < y[0] ? -1 : 1))) {
    // a line held in pieces in one scroll: the pieces are joined, with a lacuna between them
    const by = new Map<string, Unit>();
    for (const u of units) { const k = `${u.book} ${u.ref}`, o = by.get(k); if (!o) by.set(k, { ...u, words: [...u.words] }); else { if (u.words[0]) u.words[0] = { ...u.words[0], gap: true }; o.words.push(...u.words); } }
    save(scroll, "etcbc-dss", "https://github.com/ETCBC/dss/tree/0b7774a72b6d0e91712aa2156d2a1d354f1f5e6d", "CC BY-NC 4.0 (the dataset's README and LICENSE)", [...by.values()], undefined,
      { format: "TEI P5 (the source archive publishes no XML; made from Text-Fabric data, tf/2.0.5)", why: WHY_TF, title: `Dead Sea Scroll ${scroll.replace(/-/g, "/")}`, dir: "hebrew", order: HEB, language: "Hebrew", kind: "scroll", name: `Dead Sea Scroll ${scroll.replace(/-/g, "/")}`, viewer: [{ name: "Leon Levy Dead Sea Scrolls Digital Library", url: "https://www.deadseascrolls.org.il/" }],
        date: { century: "3rd century BC to 1st century AD (the span stated for the scrolls; this data gives no date for each scroll)", year: -100, from: -250, to: 70, basis: "the span stated for the scrolls as a group, not a date for this scroll", source: "http://dss.collections.imj.org.il/significance (Israel Museum): the scrolls are ascribed to the third century BCE to the first century CE; the middle, 100 BC, is used for every scroll" } });
  }
  console.log(`dss: ${out.size} scrolls`);
}


const list = [...MSS.values()].sort((a, b) => (a.siglum < b.siglum ? -1 : a.siglum > b.siglum ? 1 : 0));
for (const m of list) m.transcriptions.sort((a, b) => ARCHIVE_ORDER.indexOf(a.archive) - ARCHIVE_ORDER.indexOf(b.archive));
writeFileSync(`${ROOT}archives/manuscripts.json`, JSON.stringify({
  note: "The list of manuscripts this specification uses. Each transcription is a file in archives/{archive}/, named {manuscript}.xml (or {manuscript}.{part}.xml when one manuscript and archive give more than one file). Where the format says the source archive's file is stored unchanged, the file is as the archive published it. Where the source archive publishes no XML, the file is a TEI P5 document and the format says so.",
  archives: ARCHIVES,
  manuscripts: list,
}, null, 1) + "\n");
console.log(`${list.length} manuscripts, ${list.reduce((a, m) => a + m.transcriptions.length, 0)} transcriptions`);
