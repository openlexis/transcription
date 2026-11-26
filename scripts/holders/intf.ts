#!/usr/bin/env bun
/**
 * Adds INTF NTVMR transcriptions that are published but not yet in src/intf (add only; existing entries are left as they are).
 * Usage: bun scripts/holders/intf.ts <folder with <docID>.xml files from transcript/get?format=teiraw>
 * Files are copied unchanged. Metadata comes from the NTVMR catalogue (metadata/manuscript/get).
 */
import { copyFileSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { readTranscriptionFile } from "../lib/readers";
import { CANONICAL_BOOKS } from "../sets";

const DIR = process.argv[2];
const ROOT = new URL("../..", import.meta.url).pathname;
const IDX = `${ROOT}src/intf/index.json`;
const idx = JSON.parse(readFileSync(IDX, "utf8"));
const have = new Set(idx.items.map((i: any) => +(i.sourceUrl.match(/docID=(\d+)/)?.[1] ?? 0)));
const ORDER = CANONICAL_BOOKS.map((b) => b.id);
const API = "https://ntvmr.uni-muenster.de/community/vmr/api";

for (const f of readdirSync(DIR).filter((f) => /^\d+\.xml$/.test(f)).sort()) {
  const d = +f.slice(0, -4);
  if (have.has(d)) continue;
  const xml = readFileSync(`${DIR}/${f}`, "utf8");
  if (!xml.includes("<TEI")) { console.log(`${d}: no published transcription, skipped`); continue; }
  const k = d % 10000, lect = d >= 40000;
  const id = lect ? `L${d - 40000}` : d < 20000 ? `P${k}` : d < 30000 ? `0${k}` : String(k);
  const dest = `src/intf/${id}.xml`;
  copyFileSync(`${DIR}/${f}`, `${ROOT}${dest}`);
  const r = readTranscriptionFile(`${ROOT}${dest}`, "intf");
  const units = r.units.filter((u) => u.words.length || u.gapEnd);
  if (!units.length) { console.log(`${d}: no lines of text, skipped`); continue; }
  const books = new Set(units.map((u) => u.book));
  const m = (await (await fetch(`${API}/metadata/manuscript/get/?docID=${d}&format=json&detail=1`)).json()).data.manuscript;
  const si = [].concat(m.shelfInstances?.shelfInstance ?? [])[0] as any;
  const shelfmark = si ? [si.institution?.place, si.institution?.name, si.shelfNumber].filter(Boolean).join(", ") : undefined;
  const y = m.originYear ?? {};
  const head = xml.slice(0, 20000);
  const license = /creativecommons\.org\/licenses\/by\/4\.0/.test(head) ? "CC BY 4.0 (the file's header)" : /All rights reserved/i.test(head) ? "the file's header states \"All rights reserved by the INTF\"" : "the file's header states no license";
  const item: any = {
    id, type: lect ? "lectionary" : "continuous", language: "Greek",
    ...(lect ? {} : { name: `${d < 20000 ? "Papyrus" : d < 30000 ? "Majuscule" : "Minuscule"} ${id}` }),
    ...(shelfmark ? { shelfmark } : {}),
    ...(y.early !== undefined ? { century: String(y.content).trim(), year: Math.round((y.early + y.late) / 2), yearFrom: y.early, yearTo: y.late,
      dateBasis: "catalogue date range (the catalogue does not state its method)", dateSource: `INTF catalogue (${API}/metadata/manuscript/get/?docID=${d})` } : {}),
    viewers: [{ name: "INTF New Testament Virtual Manuscript Room", url: `https://ntvmr.uni-muenster.de/manuscript-workspace?docID=${d}` }],
    targets: ORDER.filter((b) => books.has(b)),
    paths: [dest],
    format: "TEI XML (the holder's file, unchanged)",
    license,
    sourceUrl: `${API}/transcript/get/?docID=${d}&pageID=ALL&format=teiraw`,
    lines: units.length,
    words: units.reduce((a, u) => a + u.words.length, 0),
  };
  idx.items.push(item);
  console.log(`${d} -> ${id}: ${item.targets.join(",")} (${item.lines} lines)`);
}
idx.items.sort((a: any, b: any) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
writeFileSync(IDX, JSON.stringify(idx, null, 2) + "\n");
