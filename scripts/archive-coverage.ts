// Writes site/src/data/archive-coverage.json: for every XML file in the archive, which books it contains.
// The archive page uses it to say which books each provider's file covers. It reads the archive and changes nothing in it.
// Run it again after adding archive files:  bun run archive:coverage
import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { readTranscriptionFile } from "./lib/readers.ts";

const ROOT = new URL("../", import.meta.url).pathname;
const OUT = `${ROOT}site/src/data/archive-coverage.json`;
const archives = (await Array.fromAsync(new Bun.Glob("archives/*/index.json").scan({ cwd: ROOT }))).sort();

const out: Record<string, string[]> = {};
let files = 0;
for (const idx of archives) {
  const inst = idx.split("/")[1];
  const j = JSON.parse(readFileSync(`${ROOT}${idx}`, "utf8")) as { items: { paths: string[] }[] };
  for (const item of j.items) {
    for (const p of item.paths) {
      if (out[p] || !existsSync(`${ROOT}${p}`)) continue;
      try {
        const r = readTranscriptionFile(`${ROOT}${p}`, inst);
        const seen: string[] = [];
        for (const u of r.units) if (!seen.includes(u.book)) seen.push(u.book);
        out[p] = seen;
      } catch (e) {
        console.error(`skipped ${p}: ${(e as Error).message}`);
      }
      files++;
    }
  }
  console.log(`${inst}: done (${files} files so far)`);
}
mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, JSON.stringify(out, Object.keys(out).sort(), 0) + "\n");
console.log(`wrote ${Object.keys(out).length} files to site/src/data/archive-coverage.json`);
