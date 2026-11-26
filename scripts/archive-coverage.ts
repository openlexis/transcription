// Writes site/src/data/archive-coverage.json: for every XML file in the archive, which
// books, lines, and words it contains; and for every manuscript, the combined totals.
// A book or line counts if any portion is present. A word is a token of the transcribed
// text (text an edition filled in is not counted). When more than one transcription has
// the same line, the manuscript word total uses the highest word count on that line.
// The archive page uses this to show those totals and each transcription's share.
// It reads the archive and changes nothing in it.
// Run it again after adding archive files:  bun run archive:coverage
import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { readTranscriptionFile } from "./lib/readers.ts";
import { OSIS_BOOKS } from "./lib/tei.ts";
import { HEB_BOOKS } from "./lib/text.ts";

const ROOT = new URL("../", import.meta.url).pathname;
const OUT = `${ROOT}site/src/data/archive-coverage.json`;
const archives = (await Array.fromAsync(new Bun.Glob("archives/*/index.json").scan({ cwd: ROOT }))).sort();

const BOOK_ORDER = new Map<string, number>(
  [...HEB_BOOKS.map((b) => b.id), ...OSIS_BOOKS].map((id, i) => [id, i]),
);
const sortBooks = (books: Iterable<string>) =>
  [...books].sort((a, b) => (BOOK_ORDER.get(a) ?? 999) - (BOOK_ORDER.get(b) ?? 999) || a.localeCompare(b));

type Counts = { books: string[]; lines: number; words: number };
const files: Record<string, Counts> = {};
const msLines = new Map<string, Map<string, number>>();
const msBooks = new Map<string, Set<string>>();

function addManuscript(id: string, lineWords: Map<string, number>, books: Iterable<string>) {
  let lines = msLines.get(id);
  if (!lines) {
    lines = new Map();
    msLines.set(id, lines);
  }
  for (const [k, n] of lineWords) lines.set(k, Math.max(lines.get(k) ?? 0, n));
  let set = msBooks.get(id);
  if (!set) {
    set = new Set();
    msBooks.set(id, set);
  }
  for (const b of books) set.add(b);
}

let scanned = 0;
for (const idx of archives) {
  const inst = idx.split("/")[1];
  const j = JSON.parse(readFileSync(`${ROOT}${idx}`, "utf8")) as { items: { id: string; paths: string[] }[] };
  for (const item of j.items) {
    for (const p of item.paths) {
      if (files[p] || !existsSync(`${ROOT}${p}`)) continue;
      try {
        const r = readTranscriptionFile(`${ROOT}${p}`, inst);
        const lineWords = new Map<string, number>();
        const books = new Set<string>();
        for (const u of r.units) {
          if (u.absent) continue;
          const n = u.words.filter((w) => !w.supplied).length;
          const onlySupplied = u.words.length > 0 && n === 0 && !u.gapEnd && !u.words.some((w) => w.gap);
          if (onlySupplied) continue;
          const k = `${u.book} ${u.ref}`;
          books.add(u.book);
          lineWords.set(k, Math.max(lineWords.get(k) ?? 0, n));
        }
        const words = [...lineWords.values()].reduce((a, b) => a + b, 0);
        files[p] = { books: sortBooks(books), lines: lineWords.size, words };
        addManuscript(item.id, lineWords, books);
      } catch (e) {
        console.error(`skipped ${p}: ${(e as Error).message}`);
      }
      scanned++;
    }
  }
  console.log(`${inst}: done (${scanned} files so far)`);
}

const manuscripts: Record<string, Counts> = {};
for (const id of [...msLines.keys()].sort()) {
  const lineWords = msLines.get(id)!;
  manuscripts[id] = {
    books: sortBooks(msBooks.get(id) ?? []),
    lines: lineWords.size,
    words: [...lineWords.values()].reduce((a, b) => a + b, 0),
  };
}

const sortedFiles = Object.fromEntries(Object.keys(files).sort().map((k) => [k, files[k]]));
mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, JSON.stringify({ files: sortedFiles, manuscripts }) + "\n");
console.log(`wrote ${Object.keys(sortedFiles).length} files and ${Object.keys(manuscripts).length} manuscripts to site/src/data/archive-coverage.json`);
const sample = manuscripts["01"];
if (sample) {
  console.log(`01 totals: ${sample.books.length} books, ${sample.lines} lines, ${sample.words} words`);
  for (const p of Object.keys(sortedFiles).filter((p) => p.endsWith("/01.xml")).sort()) {
    const f = files[p];
    const bp = sample.books.length ? Math.round((f.books.length / sample.books.length) * 1000) / 10 : 0;
    const lp = sample.lines ? Math.round((f.lines / sample.lines) * 1000) / 10 : 0;
    const wp = sample.words ? Math.round((f.words / sample.words) * 1000) / 10 : 0;
    console.log(`  ${p}: ${f.books.length} books (${bp}%), ${f.lines} lines (${lp}%), ${f.words} words (${wp}%)`);
  }
}
