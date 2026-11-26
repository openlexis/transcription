// Checks for the archive records (archives/manuscripts/*.yaml and archives/transcriptions/<archive>/*.yaml), run by bun run check:
// each record matches its schema (schema/*.schema.json) and its file name; every transcription file listed in an archive's
// index.json has a record and every record a file; pointers to manuscripts, reproductions and other transcriptions resolve;
// every quote from a file of this repository is found there; no value is a placeholder such as "unknown".
import { existsSync, readdirSync, readFileSync } from "node:fs";
import Ajv2020 from "ajv/dist/2020";
import { headerHaystacks, manuscriptPath, norm, PLACEHOLDER, readHeader, transcriptionId, transcriptionPath } from "./records";

export function checkRecords(ROOT: string) {
  const fails: string[] = [];
  const ajv = new Ajv2020({ allErrors: true, strict: false });
  for (const f of ["common", "manuscript", "transcription"]) ajv.addSchema(JSON.parse(readFileSync(`${ROOT}schema/${f}.schema.json`, "utf8")), `${f}.schema.json`);
  const vM = ajv.getSchema("manuscript.schema.json")!, vT = ajv.getSchema("transcription.schema.json")!;
  const read = (rel: string) => { try { return Bun.YAML.parse(readFileSync(`${ROOT}${rel}`, "utf8")) as any; } catch (e) { fails.push(`${rel}: ${e}`); return undefined; } };
  const hay = new Map<string, string[]>();
  let quotes = 0;
  const walk = (o: any, rel: string, at = ""): void => {
    if (typeof o === "string") { if (PLACEHOLDER.test(o.trim())) fails.push(`${rel}${at}: placeholder value "${o}" (leave the field out instead)`); return; }
    if (!o || typeof o !== "object") return;
    if (Array.isArray(o)) { o.forEach((x, i) => walk(x, rel, `${at}[${i}]`)); return; }
    if (typeof o.path === "string" && typeof o.quote === "string") {
      quotes++;
      if (!existsSync(`${ROOT}${o.path}`)) fails.push(`${rel}${at}: source file ${o.path} not found`);
      else {
        if (!hay.has(o.path)) hay.set(o.path, headerHaystacks(readHeader(`${ROOT}${o.path}`)));
        if (!hay.get(o.path)!.some((h) => h.includes(norm(o.quote)))) fails.push(`${rel}${at}: quote not found in the header of ${o.path}: ${o.quote.slice(0, 80)}`);
      }
    }
    for (const [k, v] of Object.entries(o)) walk(v, rel, `${at}.${k}`);
  };
  const schemaErrors = (rel: string, v: any) => fails.push(...(v.errors ?? []).slice(0, 5).map((e: any) => `${rel}: ${e.instancePath || "/"} ${e.message}`));

  const ms = new Map<string, any>();
  const mdir = `${ROOT}archives/manuscripts`;
  for (const f of existsSync(mdir) ? readdirSync(mdir).sort() : []) {
    const rel = `archives/manuscripts/${f}`, r = read(rel); if (!r) continue;
    if (!vM(r)) schemaErrors(rel, vM);
    if (manuscriptPath(r.id) !== rel) fails.push(`${rel}: id ${r.id} does not match the file name`);
    const ids = (r.reproductions ?? []).map((x: any) => x.id);
    if (new Set(ids).size !== ids.length) fails.push(`${rel}: reproduction ids repeat`);
    walk(r, rel); ms.set(r.id, r);
  }
  const listed = new Set<string>();
  for (const a of readdirSync(`${ROOT}archives`).filter((d) => existsSync(`${ROOT}archives/${d}/index.json`))) {
    for (const it of JSON.parse(readFileSync(`${ROOT}archives/${a}/index.json`, "utf8")).items) for (const p of it.paths) listed.add(p);
  }
  const ts = new Set<string>(), tdir = `${ROOT}archives/transcriptions`, recs: [string, any][] = [];
  for (const a of existsSync(tdir) ? readdirSync(tdir).sort() : []) for (const f of readdirSync(`${tdir}/${a}`).sort()) {
    const rel = `archives/transcriptions/${a}/${f}`, r = read(rel); if (!r) continue;
    if (!vT(r)) schemaErrors(rel, vT);
    if (transcriptionPath(r.file ?? "") !== rel || transcriptionId(r.file ?? "") !== r.id) fails.push(`${rel}: id ${r.id} or file ${r.file} does not match the record's path`);
    if (!listed.has(r.file)) fails.push(`${rel}: ${r.file} is not listed in its archive's index.json`);
    ts.add(r.id); recs.push([rel, r]); walk(r, rel);
  }
  for (const p of listed) if (!ts.has(transcriptionId(p))) fails.push(`${p}: no transcription record (run bun scripts/records.ts)`);
  for (const [rel, r] of recs) {
    const m = ms.get(r.manuscript);
    if (!m) { fails.push(`${rel}: manuscript record ${r.manuscript} not found`); continue; }
    for (const x of r.madeFrom ?? []) if (x.reproduction && !(m.reproductions ?? []).some((y: any) => y.id === x.reproduction)) fails.push(`${rel}: reproduction ${x.reproduction} not in ${r.manuscript}`);
    for (const x of r.basedOn ?? []) if (x.transcription && !ts.has(x.transcription)) fails.push(`${rel}: based-on transcription ${x.transcription} has no record`);
  }
  return { fails, manuscripts: ms.size, transcriptions: recs.length, quotes };
}
