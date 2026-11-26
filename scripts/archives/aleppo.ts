#!/usr/bin/env bun
/**
 * Converts the Aleppo Codex Text-Fabric dataset (github.com/MartijnNaaijer/aleppo, tf/1.0) to TEI P5, one file per book.
 *
 * Usage: bun scripts/archives/aleppo.ts <path to a clone of the aleppo repository> <commit>
 *
 * Only lines on a surviving page of the codex (feature aleppo_extant = 1) are the codex's own text. Lines in lost parts,
 * where the edition gives the text of closely related Tiberian manuscripts, are wrapped in <supplied reason="lost">
 * naming that source; lines known from an old photograph name the photograph. Words are the written words (ketiv),
 * split at spaces and maqaf, as in the Leningrad Codex reader.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const [repo, commit] = process.argv.slice(2);
if (!repo || !commit) {
  console.error("Usage: bun scripts/archives/aleppo.ts <path to aleppo repo clone> <commit>");
  process.exit(1);
}

const ROOT = new URL("../..", import.meta.url).pathname;
const OUT = join(ROOT, "archives", "aleppo");
mkdirSync(OUT, { recursive: true });

// BHSA Latin book names -> OSIS ids and UXLC file names (scripts/lib/text.ts HEB_BOOKS)
const BOOKS: [string, string, string][] = [
  ["Genesis", "Gen", "Genesis"], ["Exodus", "Exod", "Exodus"], ["Leviticus", "Lev", "Leviticus"], ["Numeri", "Num", "Numbers"],
  ["Deuteronomium", "Deut", "Deuteronomy"], ["Josua", "Josh", "Joshua"], ["Judices", "Judg", "Judges"], ["Samuel_I", "1Sam", "Samuel_1"],
  ["Samuel_II", "2Sam", "Samuel_2"], ["Reges_I", "1Kgs", "Kings_1"], ["Reges_II", "2Kgs", "Kings_2"], ["Jesaia", "Isa", "Isaiah"],
  ["Jeremia", "Jer", "Jeremiah"], ["Ezechiel", "Ezek", "Ezekiel"], ["Hosea", "Hos", "Hosea"], ["Joel", "Joel", "Joel"], ["Amos", "Amos", "Amos"],
  ["Obadia", "Obad", "Obadiah"], ["Jona", "Jonah", "Jonah"], ["Micha", "Mic", "Micah"], ["Nahum", "Nah", "Nahum"], ["Habakuk", "Hab", "Habakkuk"],
  ["Zephania", "Zeph", "Zephaniah"], ["Haggai", "Hag", "Haggai"], ["Sacharia", "Zech", "Zechariah"], ["Maleachi", "Mal", "Malachi"],
  ["Chronica_I", "1Chr", "Chronicles_1"], ["Chronica_II", "2Chr", "Chronicles_2"], ["Psalmi", "Ps", "Psalms"], ["Iob", "Job", "Job"],
  ["Proverbia", "Prov", "Proverbs"], ["Ruth", "Ruth", "Ruth"], ["Canticum", "Song", "Song_of_Songs"], ["Ecclesiastes", "Eccl", "Ecclesiastes"],
  ["Threni", "Lam", "Lamentations"], ["Esther", "Esth", "Esther"], ["Daniel", "Dan", "Daniel"], ["Esra", "Ezra", "Ezra"], ["Nehemia", "Neh", "Nehemiah"],
];

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const escAttr = (s: string) => esc(s).replace(/"/g, "&quot;");
const unescTf = (s: string) =>
  s.replace(/\\([nt\\])/g, (_, c) => (c === "n" ? "\n" : c === "t" ? "\t" : "\\"));

/** Parses a Text-Fabric .tf node or edge feature file into a Map<nodeId, value>. */
function readTfFeature(filePath: string): Map<number, string> {
  const out = new Map<number, string>();
  if (!existsSync(filePath)) return out;
  const lines = readFileSync(filePath, "utf8").replace(/\r?\n$/, "").split(/\r?\n/);
  let i = 0;
  while (i < lines.length && lines[i] !== "") i++;
  i++;
  let node = 1;
  for (; i < lines.length; i++) {
    const line = lines[i];
    const tab = line.indexOf("\t");
    if (tab >= 0) {
      const head = line.slice(0, tab);
      const val = unescTf(line.slice(tab + 1));
      const range = head.match(/^(\d+)-(\d+)$/);
      if (range) {
        const a = +range[1];
        const b = +range[2];
        for (let n = a; n <= b; n++) out.set(n, val);
        node = b + 1;
        continue;
      }
      if (/^\d+$/.test(head)) {
        node = +head;
        out.set(node, val);
        node++;
        continue;
      }
    }
    out.set(node, unescTf(line));
    node++;
  }
  return out;
}

function firstLast(spec: string): [number, number] {
  const parts = spec.split(",");
  const a = +parts[0].split("-")[0];
  const tail = parts[parts.length - 1].split("-");
  return [a, +(tail[1] ?? tail[0])];
}

function expandSlots(spec: string): number[] {
  const out: number[] = [];
  for (const part of spec.split(",")) {
    const [aStr, bStr] = part.split("-");
    const a = +aStr;
    const b = bStr !== undefined ? +bStr : a;
    for (let s = a; s <= b; s++) out.push(s);
  }
  return out;
}

type Span = { node: number; a: number; z: number; val: string };

function findContainingSpan(spans: Span[], slot: number): Span | undefined {
  let lo = 0;
  let hi = spans.length - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (spans[mid].a <= slot) lo = mid;
    else hi = mid - 1;
  }
  const hit = spans[lo];
  return hit && hit.a <= slot && slot <= hit.z ? hit : undefined;
}

const tfDir = join(repo, "tf", "1.0");
const otype = readTfFeature(join(tfDir, "otype.tf"));
const oslots = readTfFeature(join(tfDir, "oslots.tf"));
const fBook = readTfFeature(join(tfDir, "book.tf"));
const fChapter = readTfFeature(join(tfDir, "chapter.tf"));
const fVerse = readTfFeature(join(tfDir, "verse.tf"));
const fWord = readTfFeature(join(tfDir, "g_word_utf8.tf"));
const fTrailer = readTfFeature(join(tfDir, "trailer_utf8.tf"));
const fExtant = readTfFeature(join(tfDir, "aleppo_extant.tf"));
const fPage = readTfFeature(join(tfDir, "aleppo_page.tf"));
const fPhoto = readTfFeature(join(tfDir, "aleppo_photo.tf"));

const bookSpans = new Map<string, Span>();
const chapterSpans: Span[] = [];
const verseSpans: Span[] = [];

for (const [node, kind] of otype.entries()) {
  const slotSpec = oslots.get(node);
  if (!slotSpec) continue;
  const [a, z] = firstLast(slotSpec);
  if (kind === "book") {
    const name = fBook.get(node);
    if (name) bookSpans.set(name, { node, a, z, val: name });
  } else if (kind === "chapter") {
    chapterSpans.push({ node, a, z, val: fChapter.get(node) ?? "" });
  } else if (kind === "verse") {
    verseSpans.push({ node, a, z, val: fVerse.get(node) ?? "" });
  }
}

chapterSpans.sort((x, y) => x.a - y.a);
verseSpans.sort((x, y) => x.a - y.a);

const LOST_SRC =
  "the edition's text from closely related Tiberian manuscripts, where the codex is lost (the dataset's feature aleppo_extant)";
const LICENSE =
  'CC BY-SA 4.0 (the dataset\'s README and feature headers; attribution: "מקרא על פי המסורה", he.wikisource.org)';
const SRC_URL = `https://github.com/MartijnNaaijer/aleppo/tree/${commit}`;

/** Join BHSA segments into written words; split at whitespace and maqaf. */
function graphicWords(verseNode: number): string[] {
  const slots = expandSlots(oslots.get(verseNode) ?? "");
  const out: string[] = [];
  let cur = "";
  for (const w of slots) {
    cur += fWord.get(w) ?? "";
    const tr = fTrailer.get(w) ?? "";
    if (tr && (/[\s\u05BE\u05C3\u05C0]|[ספ]/.test(tr))) {
      out.push(cur);
      cur = "";
    }
  }
  if (cur) out.push(cur);
  return out.filter((x) => /[\u05D0-\u05EA]/.test(x));
}

const stats: Record<
  string,
  { file: string; extantLines: number; lostLines: number; extantWords: number; lostWords: number }
> = {};

for (const [latin, osis, fname] of BOOKS) {
  const bSpan = bookSpans.get(latin);
  if (!bSpan) throw new Error(`Missing book "${latin}" in ${tfDir}`);
  const bookVerses = verseSpans.filter((v) => v.a >= bSpan.a && v.z <= bSpan.z);
  const rows: string[] = [];
  let extantLines = 0;
  let lostLines = 0;
  let wordsExtant = 0;
  let wordsLost = 0;
  let lastPage: string | null = null;

  for (const v of bookVerses) {
    const chSpan = findContainingSpan(chapterSpans, v.a);
    const ch = chSpan?.val ?? "";
    const vs = v.val;
    const ref = `${osis} ${ch}:${vs}`;
    const ws = graphicWords(v.node);
    const inner = ws.map((x) => `<w>${esc(x)}</w>`).join("");
    const extVal = fExtant.get(v.node);
    const isExtant = Boolean(extVal && extVal !== "0");
    if (isExtant) {
      extantLines++;
      wordsExtant += ws.length;
      for (const page of (fPage.get(v.node) ?? "").split(/\s+/).filter(Boolean)) {
        if (page !== lastPage) {
          rows.push(`<pb n="${escAttr(page)}"/>`);
          lastPage = page;
        }
      }
      rows.push(`<ab n="${ref}">${inner}</ab>`);
    } else {
      lostLines++;
      wordsLost += ws.length;
      const photo = fPhoto.get(v.node);
      const src = photo ? `lost page known from an old photograph: ${photo}` : LOST_SRC;
      rows.push(`<ab n="${ref}"><supplied reason="lost" source="${escAttr(src)}">${inner}</supplied></ab>`);
    }
  }

  const head = `<?xml version="1.0" encoding="UTF-8"?>
<TEI xmlns="http://www.tei-c.org/ns/1.0">
<teiHeader>
<fileDesc>
<titleStmt><title>Aleppo Codex, ${esc(fname.replace(/_/g, " "))}</title></titleStmt>
<publicationStmt><p>${esc(LICENSE)}</p><p>The source archive publishes this transcription as Text-Fabric data, not XML. This file is a TEI P5 transcription made from that data, which is the closest scholarly standard for a transcription of a single manuscript.</p><p>Only lines on a surviving page of the codex are the codex's own text; pb gives the codex page (leaf:side, side a is the recto) from the dataset's feature aleppo_page. Text that the edition fills in for lost pages is marked with supplied (reason="lost"), naming the edition's stated source.</p></publicationStmt>
<sourceDesc><p>${SRC_URL}</p></sourceDesc>
</fileDesc>
</teiHeader>
<text xml:lang="hbo">
<body>
`;
  const outPath = join(OUT, `A.${fname}.xml`);
  writeFileSync(outPath, head + rows.join("\n") + "\n</body>\n</text>\n</TEI>\n", "utf8");
  stats[osis] = {
    file: `archives/aleppo/A.${fname}.xml`,
    extantLines,
    lostLines,
    extantWords: wordsExtant,
    lostWords: wordsLost,
  };
}

if (process.env.STATS) {
  writeFileSync(process.env.STATS, JSON.stringify(stats, null, 1) + "\n", "utf8");
}
console.log(
  JSON.stringify(
    Object.fromEntries(Object.entries(stats).map(([k, v]) => [k, [v.extantLines, v.lostLines]])),
  ),
);
