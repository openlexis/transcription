// Writes the data the browser loads on demand: each compilation's manuscripts and its disagreements, in a slim form.
import { mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync, existsSync } from "node:fs";
const ROOT = new URL("../", import.meta.url).pathname;
const OUT = new URL("./public/data/", import.meta.url).pathname;
rmSync(OUT, { recursive: true, force: true });
const index: unknown[] = [];
const CAT = JSON.parse(readFileSync(`${ROOT}transcriptions/manuscripts.json`, "utf8"));
const FILE = new Map<string, [string, string, string]>();
for (const m of CAT.manuscripts) for (const t of m.transcriptions) FILE.set(t.file, [t.source, CAT.holders[t.holder]?.name ?? t.holder, t.license]);
for (const id of readdirSync(`${ROOT}compilations`).sort()) {
  const dir = `${ROOT}compilations/${id}`;
  if (!existsSync(`${dir}/stats.json`)) continue;
  mkdirSync(`${OUT}${id}`, { recursive: true });
  const t = JSON.parse(readFileSync(`${dir}/transcription.json`, "utf8"));
  const d = JSON.parse(readFileSync(`${dir}/disagreements.json`, "utf8"));
  const stats = JSON.parse(readFileSync(`${dir}/stats.json`, "utf8"));
  // the manuscripts: siglum, name, century, year, early, proximity, images, transcription files
  writeFileSync(`${OUT}${id}/witnesses.json`, JSON.stringify(t.witnesses.map((w: any) => [w.siglum, w.name ?? "", w.century ?? "", w.year, w.dated ? 1 : 0, w.early ? 1 : 0, w.proximity, w.viewer, w.files.map((f: string) => [f, ...(FILE.get(f) ?? ["", "", ""])])])));
  // the disagreements: [id, ref, type, severity, weight, confidence, readings [text, share, manuscripts, votes, flags, first sigla]]
  const sig = (i: number) => t.witnesses[i].siglum;
  writeFileSync(`${OUT}${id}/places.json`, JSON.stringify(d.places.map((p: any) => [p.id, p.ref, p.type, p.severity, p.weight, p.confidence,
    p.readings.map((r: any) => { const all = [...r.witnesses, ...(r.partly ?? [])]; return [r.text, r.share, all.length, r.votes, (r.flags ?? []).join(","), all.slice(0, 16).map(sig).join(" ")]; })])));
  index.push({ id, name: stats.name, places: stats.places });
}
writeFileSync(`${OUT}index.json`, JSON.stringify(index));
console.log(`prepared ${index.length} compilations`);
