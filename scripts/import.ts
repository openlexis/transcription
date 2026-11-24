// Brings the ancient Greek manuscript transcriptions into transcriptions/greek/, one plain text file per transcription,
// and lists every manuscript with its date, holder and links in transcriptions/manuscripts.json.
//   bun scripts/import.ts <folder holding the holders' downloaded files>
// Each output line is "<book> <chapter>:<line><TAB><words>". A word is the first hand's letters, without accents, with sacred
// names and letter numbers written out. "…" marks text lost or not read in the manuscript (a lacuna); a line that is only
// "-" is a line the manuscript marks as not having. Nothing from a printed edition, translation or image is read.
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { teiUnits, type TeiUnit } from "../src/tei";
import { NT_BOOKS, numeral, sacred, skel } from "../src/text";

const SRC = process.argv[2];
if (!SRC || !existsSync(SRC)) throw new Error("usage: bun scripts/import.ts <folder with the holders' files>");
const ROOT = new URL("..", import.meta.url).pathname;
const OUT = `${ROOT}transcriptions/greek`;
rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });

const snap = (p: string) => { const d = readdirSync(`${SRC}/${p}`).filter((x) => /^\d{4}-\d\d-\d\d$/.test(x)).sort().pop()!; return `${SRC}/${p}/${d}`; };
const zipList = (zip: string) => spawnSync("unzip", ["-Z1", zip], { maxBuffer: 1 << 26 }).stdout.toString().split("\n").filter(Boolean).sort();
const member = (zip: string, m: string) => {
  const r = spawnSync("unzip", ["-p", zip, m.replace(/[\[\]*?\\]/g, "\\$&")], { maxBuffer: 1 << 30 });
  if (r.status !== 0) throw new Error(`unzip ${zip} ${m}`);
  return r.stdout.toString("utf8");
};
export function gaSiglum(s: string): string | undefined {
  let m = s.match(/^P0*(\d+)$/); if (m) return `P${+m[1]}`;
  m = s.match(/^0(\d+)$/); if (m) return `0${m[1].replace(/^0+(?=\d{2})/, "")}`;
  m = s.match(/^([1-9]\d*)$/); if (m) return m[1];
  return undefined;
}
const docOf = (s: string) => (s.startsWith("P") ? 10000 + +s.slice(1) : s.startsWith("0") ? 20000 + +s : 30000 + +s);

// ---------- the holders ----------
type Holder = { id: string; name: string; web: string; license: string };
const HOLDERS: Record<string, Holder> = {
  "sinaiticus-project": { id: "sinaiticus-project", name: "Codex Sinaiticus Project", web: "https://epapers.bham.ac.uk/id/eprint/3306/", license: "CC BY-NC-SA 3.0 (the ePapers record)" },
  zacynthius: { id: "zacynthius", name: "ITSEE, University of Birmingham (Codex Zacynthius project)", web: "https://edata.bham.ac.uk/496/", license: "CC BY 4.0 (the eData record)" },
  "igntp-john": { id: "igntp-john", name: "International Greek New Testament Project (IGNTP), John", web: "https://itseeweb.cal.bham.ac.uk/iohannes/", license: "CC BY 4.0 (each file's header)" },
  "igntp-romans": { id: "igntp-romans", name: "INTF and ITSEE, Romans", web: "https://edata.bham.ac.uk/1111/", license: "CC BY 4.0 (the eData record and each file's header)" },
  "igntp-galatians": { id: "igntp-galatians", name: "INTF and ITSEE, Galatians", web: "https://edata.bham.ac.uk/1107/", license: "CC BY 4.0 (each file's header)" },
  "igntp-ephesians": { id: "igntp-ephesians", name: "INTF and ITSEE, Ephesians", web: "https://edata.bham.ac.uk/1109/", license: "CC BY 4.0 (each file's header)" },
  "igntp-2thessalonians": { id: "igntp-2thessalonians", name: "ITSEE, 2 Thessalonians", web: "https://edata.bham.ac.uk/510/", license: "CC BY 4.0 (the eData record)" },
  "family-pi-mark": { id: "family-pi-mark", name: "ITSEE, Family Π in Mark", web: "https://edata.bham.ac.uk/983/", license: "CC BY 4.0 (the eData record and the files' headers)" },
  intf: { id: "intf", name: "Institut für Neutestamentliche Textforschung (INTF), New Testament Virtual Manuscript Room", web: "https://ntvmr.uni-muenster.de/", license: "per file, see the transcription's entry" },
  cntr: { id: "cntr", name: "Center for New Testament Restoration (CNTR)", web: "https://github.com/Center-for-New-Testament-Restoration/transcriptions/tree/4e743a41a4b2ca010ece53229cd272aa59b1efe6", license: "CC BY-SA 4.0 (the repository's LICENSE.md)" },
};
/** The order in which transcriptions of one manuscript are listed (and break a tie, RULES.md). */
export const HOLDER_ORDER = Object.keys(HOLDERS);

// ---------- manuscripts ----------
type Transcription = { holder: string; file: string; source: string; license: string; lines: number; words: number };
type Manuscript = { siglum: string; name?: string; shelfmark?: string; century?: string; year?: number; viewer?: { name: string; url: string }[]; transcriptions: Transcription[] };
const MSS = new Map<string, Manuscript>();
const intf = snap("intf-ntvmr");
const rdCat = (f: string) => JSON.parse(readFileSync(`${intf}/${f}`, "utf8")).data.manuscripts.manuscript as { docID: number; lang: string; orig: string; origEarly: number; origLate: number }[];
const CAT = new Map(rdCat("catalogue.json").map((m) => [m.docID, m]));
const IMAGES = new Set(rdCat("images.json").map((m) => m.docID));
const FAX = JSON.parse(readFileSync(`${SRC}/../forensics/facsimiles.json`, "utf8")).sources as Record<string, { name: string; shelfmark?: string; century?: string; facsimiles?: { provider: string; url: string }[] }>;

const lineOrder = (a: string, b: string) => { const [x, y] = [a, b].map((r) => r.split(":").map(Number)); return x[0] - y[0] || x[1] - y[1]; };
const OSIS = NT_BOOKS.map((b) => b.id);
/** Writes one transcription: units in book, chapter, line order. */
function save(siglum: string, holder: string, source: string, license: string, units: { book: string; ref: string; words: { w: string; gap: boolean }[]; gapEnd: boolean; absent?: boolean }[], faxKey?: string) {
  siglum = gaSiglum(siglum) ?? siglum;
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
  const file = `transcriptions/greek/${siglum}.${holder}.txt`;
  writeFileSync(`${ROOT}${file}`, text.join("\n") + "\n");
  let m = MSS.get(siglum);
  if (!m) {
    const c = CAT.get(docOf(siglum));
    const f = (faxKey && FAX[faxKey]) || FAX[`intf-ntvmr/${siglum}`] || FAX[`cntr-mss/${siglum}`];
    const viewer: { name: string; url: string }[] = [];
    if (IMAGES.has(docOf(siglum))) viewer.push({ name: "INTF New Testament Virtual Manuscript Room", url: `https://ntvmr.uni-muenster.de/manuscript-workspace?docID=${docOf(siglum)}` });
    for (const x of f?.facsimiles ?? []) if (!viewer.some((v) => v.url === x.url)) viewer.push({ name: x.provider, url: x.url });
    m = { siglum, ...(f?.name ? { name: f.name } : {}), ...(f?.shelfmark ? { shelfmark: f.shelfmark } : {}), century: c?.orig ?? f?.century, ...(c?.origEarly ? { year: Math.round((c.origEarly + c.origLate) / 2) } : {}), viewer, transcriptions: [] };
    MSS.set(siglum, m);
  }
  m.transcriptions.push({ holder, file, source, license, lines: text.length, words });
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
function cntr(path: string, siglum: string, faxKey: string, src: string) {
  const units = [];
  for (const l of readFileSync(path, "utf8").split("\n")) {
    const m = l.match(/^(\d\d)(\d{3})(\d{3}) (.*)$/); if (!m) continue;
    const book = OSIS[+m[1] - 40]; if (!book) continue;
    const ref = `${+m[2]}:${+m[3]}`;
    if (m[4].trim() === "-") { units.push({ book, ref, words: [], gapEnd: false, absent: true }); continue; }
    units.push({ book, ref, ...cntrLine(m[4]) });
  }
  save(siglum, "cntr", src, HOLDERS.cntr.license, units, faxKey);
}

// ---------- run ----------
const CNTR_LEFT_OUT = new Set(["O23"]); // not a Gregory-Aland number the INTF catalogue knows
const cm = `${snap("cntr-mss")}/class 1`;
for (const f of readdirSync(cm).filter((f) => f.endsWith(".txt")).sort()) {
  const n = f.slice(0, -4); if (CNTR_LEFT_OUT.has(n)) continue;
  cntr(`${cm}/${f}`, n, `cntr-mss/${n}`, `${HOLDERS.cntr.web}/class%201/${n}.txt`);
}
for (const n of ["01", "02", "03", "04"]) cntr(`${snap(`cntr-${n}`)}/class 1/${n}.txt`, n, `cntr-${n}`, `${HOLDERS.cntr.web}/class%201/${n}.txt`);
console.log(`cntr: ${MSS.size} manuscripts`);

{ // Codex Sinaiticus Project (its New Testament books)
  const H = HOLDERS["sinaiticus-project"], zip = `${snap("sinaiticus-project")}/FINAL_TRANSCRIPTION_version105.xml.zip`;
  save("01", H.id, "https://epapers.bham.ac.uk/id/eprint/3306/1/FINAL_TRANSCRIPTION_version105.xml.zip", H.license, fromTei(teiUnits(member(zip, "FINAL_TRANSCRIPTION_version105.xml"), SP)), "sinaiticus-project");
}
{ const H = HOLDERS.zacynthius; save("040", H.id, "https://edata.bham.ac.uk/496/", H.license, fromTei(teiUnits(readFileSync(`${snap("zacynthius")}/Zacynthius-gospel_2-0.xml`, "utf8"), SP)), "zacynthius"); }

const DONE = new Set<string>();
const teiZip = (F: string, zip: string, pick: (m: string) => string | undefined, url: string) => {
  const H = HOLDERS[F], seen = new Set<string>();
  let n = 0;
  for (const m of zipList(`${snap(F)}/${zip}`)) {
    const s = pick(m); if (!s || seen.has(s) || DONE.has(`${F}/${s}`)) continue; seen.add(s); DONE.add(`${F}/${s}`); n++;
    save(s, H.id, url, H.license, fromTei(teiUnits(member(`${snap(F)}/${zip}`, m), SP)));
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
    if (!c || !/^g/.test(c.lang) || d < 10000 || d >= 40000) continue;
    const k = d % 10000, s = gaSiglum(d < 20000 ? `P${k}` : d < 30000 ? `0${k}` : String(k)); if (!s) continue;
    const xml = readFileSync(`${intf}/transcriptions/${f}`, "utf8");
    const head = xml.slice(0, 20000);
    const license = /creativecommons\.org\/licenses\/by\/4\.0/.test(head) ? "CC BY 4.0 (the file's header)" : /All rights reserved/i.test(head) ? "the file's header states \"All rights reserved by the INTF\"" : "the file's header states no license";
    save(s, "intf", `https://ntvmr.uni-muenster.de/community/api/transcript/get/?docID=${d}&pageID=ALL&format=teiraw`, license, fromTei(teiUnits(xml, SP)));
    if (++n % 100 === 0) console.log(`intf: ${n}`);
  }
  console.log(`intf: ${n} files`);
}

const list = [...MSS.values()].sort((a, b) => (a.siglum < b.siglum ? -1 : 1));
for (const m of list) m.transcriptions.sort((a, b) => HOLDER_ORDER.indexOf(a.holder) - HOLDER_ORDER.indexOf(b.holder));
writeFileSync(`${ROOT}transcriptions/manuscripts.json`, JSON.stringify({ holders: HOLDERS, manuscripts: list }, null, 1) + "\n");
console.log(`${list.length} manuscripts, ${list.reduce((a, m) => a + m.transcriptions.length, 0)} transcriptions`);
