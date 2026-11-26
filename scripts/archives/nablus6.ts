#!/usr/bin/env bun
/**
 * Converts the Hebrew running text of MS Nablus 6, as printed by Tal and Florentin (2024) and extracted by the CACCHT
 * Samaritan Pentateuch project (DT-UCPH/sp, scripts/tal_florentin/results/tf_verses.json), to TEI P5.
 *
 * Usage: bun scripts/archives/nablus6.ts <tf_verses.json>
 *
 * The edition (Introduction, section 4.1.2.2) fills the manuscript's lost beginning from other manuscripts: Gen 1:1-11 from
 * St Petersburg P. 177, and Gen 1:12 to 3:24 from Cambridge University Library Add 714. Those lines are wrapped in
 * <supplied reason="lost"> naming that source. Leaves of MS Nablus 6 now held elsewhere (Oxford, Turin, London, Princeton)
 * are the manuscript's own text. The edition says it filled a few small lacunae from Add 714 and the Abisha scroll without
 * marking them; those cannot be marked here.
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const inputPath = process.argv[2];
if (!inputPath) {
  console.error("Usage: bun scripts/archives/nablus6.ts <tf_verses.json>");
  process.exit(1);
}

const d = JSON.parse(readFileSync(inputPath, "utf8")) as Record<string, string[]>;
const ROOT = new URL("../..", import.meta.url).pathname;
const OUT = join(ROOT, "archives", "tal-florentin-sp");
mkdirSync(OUT, { recursive: true });

const OSIS: Record<string, string> = {
  Genesis: "Gen",
  Exodus: "Exod",
  Leviticus: "Lev",
  Numbers: "Num",
  Deuteronomy: "Deut",
};
const LIC = "CC BY-NC 4.0 (the edition's copyright page and the dataset's README and LICENSE)";
const SRC =
  "https://github.com/DT-UCPH/sp/blob/e8a120f2e92b6558fd39bbe72f830ded871a0a47/scripts/tal_florentin/results/tf_verses.json";

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const escAttr = (s: string) => esc(s).replace(/"/g, "&quot;");

function suppliedSource(book: string, ch: number, vs: number): string | null {
  if (book !== "Gen") return null;
  if (ch === 1 && vs <= 11) {
    return "another manuscript, St Petersburg P. 177 (the edition's Introduction, section 4.1.2.2)";
  }
  if (ch <= 3) {
    return "another manuscript, Cambridge University Library Add 714, copied 1219 CE (the edition's Introduction, section 4.1.2.2)";
  }
  return null;
}

const rows: string[] = [];
const books: string[] = [];
let lines = 0;
let words = 0;
let slines = 0;
let swords = 0;

for (const [key, ws] of Object.entries(d)) {
  const splitIdx = key.lastIndexOf(" ");
  const name = key.slice(0, splitIdx);
  const ref = key.slice(splitIdx + 1);
  const book = OSIS[name];
  const [ch, vs] = ref.split(":").map(Number);
  if (!books.includes(book)) books.push(book);
  const inner = ws.map((w) => `<w>${esc(w)}</w>`).join("");
  const src = suppliedSource(book, ch, vs);
  if (src) {
    slines++;
    swords += ws.length;
    rows.push(`<ab n="${book} ${ch}:${vs}"><supplied reason="lost" source="${escAttr(src)}">${inner}</supplied></ab>`);
  } else {
    lines++;
    words += ws.length;
    rows.push(`<ab n="${book} ${ch}:${vs}">${inner}</ab>`);
  }
}

const head = `<?xml version="1.0" encoding="UTF-8"?>
<TEI xmlns="http://www.tei-c.org/ns/1.0">
<teiHeader>
<fileDesc>
<titleStmt><title>Samaritan Pentateuch, MS Nablus 6</title></titleStmt>
<publicationStmt><p>${esc(LIC)}</p><p>The text is the Hebrew running text of Moshe Florentin and Abraham Tal, The Samaritan Pentateuch: An English Translation with a Parallel Annotated Hebrew Text (Open Book Publishers, 2024, https://doi.org/10.11647/OBP.0415), which presents MS Nablus 6 diplomatically, as extracted by the CACCHT Samaritan Pentateuch project. The source archive publishes it as JSON, not XML; this file is a TEI P5 transcription made from that data.</p><p>Text the edition takes from other manuscripts for the lost beginning (Gen 1:1 to 3:24) is marked with supplied (reason="lost"), naming the edition's stated source. The edition says it filled a few small lacunae from Cambridge Add 714 and the Abisha scroll without marking them; they are not marked here either.</p></publicationStmt>
<sourceDesc><p>${SRC}</p></sourceDesc>
</fileDesc>
</teiHeader>
<text xml:lang="hbo">
<body>
`;

writeFileSync(join(OUT, "Nablus6.xml"), head + rows.join("\n") + "\n</body>\n</text>\n</TEI>\n", "utf8");
console.log(JSON.stringify({ books, lines, words, suppliedLines: slines, suppliedWords: swords }));
