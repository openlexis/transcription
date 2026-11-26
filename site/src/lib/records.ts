// Reads the archive records (archives/manuscripts/*.yaml, archives/transcriptions/<archive>/*.yaml; docs/archive-records.md)
// and turns them into short display entries for the archive page: each entry is a text, optional detail lines, and its sources.
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { parse } from "yaml";
import { ROOT, githubBlob } from "./corpus";

export type Src = { u: string; q: string; l: string };
export type Item = { t: string; sub?: string[]; s: Src[]; id?: string; link?: string };
export type ManuscriptView = { id: string; names: Item[]; ids: Item[]; physical: Item[]; holdings: Item[]; dates: Item[]; origin: Item[]; history: Item[]; repro: Item[] };
export type TranscriptionView = { id: string; who: Item[]; others: Item[]; usual: Item[]; when: Item[]; from: Item[]; checked: Item[]; based: Item[] };

const ROLE: Record<string, string> = { cre: "made it", trc: "transcribed", pfr: "proofread", rev: "reconciled or revised", edt: "edited", mrk: "converted it to XML", fnd: "funded", spn: "sponsored", pbl: "published", pdr: "directed the project", pht: "photographed", ctb: "contributed corrections", dtc: "contributed data", prg: "wrote software" };
const SUPPORT = new Set(["fnd", "spn", "pbl", "pdr"]);
const KIND: Record<string, string> = {
  "independent-double-transcription": "Two independent transcriptions", "automatic-comparison": "Compared automatically by software",
  reconciliation: "Differences reconciled", proofreading: "Proofread", "verification-against-original": "Checked against the manuscript itself",
  "checked-against-images": "Checked against images", "compared-with-edition": "Compared with a printed edition",
  "compared-with-other-transcriptions": "Compared with other transcriptions", "base-text-adaptation": "Started from a printed base text and changed to match the manuscript",
  "conversion-to-xml": "Converted to XML",
};
const FROM: Record<string, string> = { images: "Images", original: "The manuscript itself", edition: "A printed edition", microfilm: "Microfilm", typescript: "A typed transcription", facsimile: "A printed facsimile", "no-images": "No images were available", other: "Other" };
const REPRO: Record<string, string> = { "digital-colour": "colour digital images", "digital-raking-light": "digital images in raking light", multispectral: "multispectral images (taken under different wavelengths of light)", infrared: "infrared images", ultraviolet: "ultraviolet images", "black-and-white-photograph": "black and white photographs", facsimile: "printed facsimile", microfilm: "microfilm", edition: "printed edition" };
const METHOD: Record<string, string> = { catalogue: "as given in a catalogue, which does not say how it was reached", palaeography: "from the style of the handwriting", codicology: "from how the book is made", colophon: "from a colophon, a note by the copyist", radiocarbon: "radiocarbon dating", dendrochronology: "tree-ring dating", "decoration-style": "from the style of decoration" };

const host = (u: string) => { try { return new URL(u).host; } catch { return u; } };
const src = (ss: any[] = []): Src[] => ss.map((s) => (s.path ? { u: githubBlob(s.path), q: s.quote, l: s.path } : { u: s.url, q: s.quote, l: s.citation ? s.citation : host(s.url) }));
const yr = (y: any) => (typeof y === "number" ? (y < 0 ? `${-y} BC` : String(y)) : String(y));
const range = (o: any) => {
  const a = o.notBefore ?? o.from, b = o.notAfter ?? o.to;
  if (o.when !== undefined) return yr(o.when);
  if (a !== undefined && b !== undefined) return a === b ? yr(a) : `${yr(a)} to ${yr(b)}`;
  if (a !== undefined) return `not before ${yr(a)}`;
  if (b !== undefined) return `not after ${yr(b)}`;
  return "";
};
const nameKey = (n: string) => n.toLowerCase().replace(/^the /, "").replace(/[^\p{L}\p{N}]/gu, "");
/** Adds an item, or merges its sources into an item with the same text. */
function put(list: Item[], it: Item) {
  const old = list.find((x) => x.t === it.t);
  if (!old) { list.push(it); return; }
  for (const s of it.s) if (!old.s.some((o) => o.u === s.u && o.q === s.q)) old.s.push(s);
  for (const l of it.sub ?? []) if (!(old.sub ??= []).includes(l)) old.sub.push(l);
}

const read = (p: string) => parse(readFileSync(p, "utf8"));
let cache: { ms: Map<string, any>; byMs: Map<string, any[]> } | undefined;
function load() {
  if (cache) return cache;
  const ms = new Map<string, any>(), byMs = new Map<string, any[]>();
  const md = `${ROOT}archives/manuscripts`, td = `${ROOT}archives/transcriptions`;
  if (existsSync(md)) for (const f of readdirSync(md)) { const r = read(`${md}/${f}`); ms.set(r.id, r); }
  if (existsSync(td)) for (const a of readdirSync(td)) for (const f of readdirSync(`${td}/${a}`)) {
    const r = read(`${td}/${a}/${f}`); (byMs.get(r.manuscript) ?? byMs.set(r.manuscript, []).get(r.manuscript)!).push(r);
  }
  return (cache = { ms, byMs });
}
export const manuscriptRecordIds = () => [...load().ms.keys()];

export function manuscriptView(m: any): ManuscriptView {
  const v: ManuscriptView = { id: m.id, names: [], ids: [], physical: [], holdings: [], dates: [], origin: [], history: [], repro: [] };
  for (const n of m.names ?? []) put(v.names, { t: n.text, s: src(n.sources) });
  for (const i of m.identifiers ?? []) put(v.ids, { t: `${i.scheme} ${i.value}`, s: src(i.sources) });
  for (const k of ["form", "material"]) if (m[k]) put(v.physical, { t: m[k].text, s: src(m[k].sources) });
  for (const l of m.languages ?? []) put(v.physical, { t: l.text, s: src(l.sources) });
  for (const h of m.holdings ?? []) {
    const t = [h.repository, h.settlement, h.country].filter(Boolean).join(", ") + (h.idno?.length ? `: ${h.idno.join(", ")}` : "");
    const leaves = h.leaves ? [/^\d+$/.test(h.leaves) ? `${h.leaves} leaves` : `Leaves: ${h.leaves}`] : undefined;
    put(v.holdings, { t, ...(leaves ? { sub: leaves } : {}), s: src(h.sources) });
  }
  for (const d of m.dates ?? []) {
    const r = range(d), sub: string[] = [];
    if (d.text && r && r !== d.text) sub.push(`Years: ${r}`);
    for (const x of d.method ?? []) sub.push(`How it was dated: ${METHOD[x.name] ?? x.name.replace(/-/g, " ")}`);
    if (d.statedBy?.length) sub.push(`Stated by ${d.statedBy.map((p: any) => p.name).join(", ")}`);
    if (d.publication) sub.push(d.publication);
    if (d.of && d.of !== "writing") sub.push(`Dates the ${d.of}`);
    put(v.dates, { t: d.text ?? r, sub, s: src(d.sources) });
  }
  for (const o of m.originPlaces ?? []) put(v.origin, { t: o.text, s: src(o.sources) });
  for (const p of m.provenance ?? []) put(v.history, { t: p.description ?? p.type, ...(p.when ? { sub: [`When: ${p.when.text ?? range(p.when)}`] } : {}), s: src(p.sources) });
  for (const r of m.reproductions ?? []) {
    const sub = [
      r.kind ? `Kind: ${REPRO[r.kind] ?? r.kind}` : "",
      r.when ? `When: ${r.when.text ?? range(r.when)}` : "",
      r.madeBy?.length ? `Made by ${r.madeBy.map((p: any) => p.name).join(", ")}` : "",
      r.device ? `Camera: ${r.device}` : "", r.lighting ? `Lighting: ${r.lighting}` : "", r.coverage ? `Covers: ${r.coverage}` : "",
      r.owner ? r.owner : "",
    ].filter(Boolean);
    v.repro.push({ id: r.id, t: r.description ?? REPRO[r.kind] ?? r.id, sub, s: src(r.sources), ...(r.where?.startsWith("http") ? { link: r.where } : {}) });
  }
  return v;
}

export function transcriptionView(r: any, m: any): TranscriptionView {
  const v: TranscriptionView = { id: r.id, who: [], others: [], usual: [], when: [], from: [], checked: [], based: [] };
  const seen = new Map<string, Item>();
  for (const p of r.people ?? []) {
    const roles: string[] = p.roles ?? [];
    const list = p.generalPractice ? v.usual : roles.length && roles.every((x) => SUPPORT.has(x)) ? v.others : v.who;
    const key = (list === v.who ? "w" : list === v.others ? "o" : "u") + nameKey(p.name);
    const label = roles.map((x) => ROLE[x] ?? x).join(", ");
    const old = seen.get(key);
    if (old) { for (const s of src(p.sources)) if (!old.s.some((o) => o.u === s.u && o.q === s.q)) old.s.push(s); if (label && !(old.sub ??= []).includes(label)) old.sub.push(label); continue; }
    const it: Item = { t: p.name, ...(label ? { sub: [label] } : {}), s: src(p.sources) };
    seen.set(key, it); list.push(it);
  }
  for (const d of r.made ?? []) put(v.when, { t: d.text ?? range(d), s: src(d.sources) });
  for (const d of r.published ?? []) put(v.when, { t: `Published: ${d.text ?? range(d)}`, s: src(d.sources) });
  if (r.version) put(v.when, { t: `Version: ${r.version.text ?? r.version.label}`, s: src(r.version.sources) });
  const repro = new Map((m?.reproductions ?? []).map((x: any) => [x.id, x]));
  for (const f of r.madeFrom ?? []) {
    const rep: any = f.reproduction ? repro.get(f.reproduction) : undefined;
    const sub = [f.description, rep ? `Image set: ${rep.description ?? rep.id}${rep.when ? ` (${rep.when.text ?? range(rep.when)})` : ""}` : "", f.generalPractice ? "The project's usual practice" : ""].filter(Boolean);
    put(v.from, { t: FROM[f.kind] ?? f.kind, sub, s: src(f.sources) });
  }
  for (const p of r.method?.practices ?? []) put(v.checked, { t: `${KIND[p.kind] ?? p.kind}${p.generalPractice ? " (the project's usual practice)" : ""}`, sub: [p.text], s: src(p.sources) });
  for (const b of r.basedOn ?? []) put(v.based, { t: b.transcription ? `${b.name ?? "transcription"} (${b.transcription})` : b.name, ...(b.description ? { sub: [b.description] } : {}), s: src(b.sources), ...(b.url ? { link: b.url } : {}) });
  for (const b of r.baseText ?? []) put(v.based, { t: b.text, s: src(b.sources) });
  return v;
}

/** Everything the archive page shows for one manuscript record: the manuscript and each of its transcription files, by file path. */
export function recordBundle(id: string) {
  const { ms, byMs } = load(), m = ms.get(id);
  const t: Record<string, TranscriptionView> = {};
  for (const r of byMs.get(id) ?? []) t[r.file] = transcriptionView(r, m);
  return { m: m ? manuscriptView(m) : undefined, t };
}

/** Counts for the page header. */
export function recordStats() {
  const { ms, byMs } = load();
  const people = new Set<string>();
  let files = 0;
  for (const list of byMs.values()) for (const r of list) { files++; for (const p of r.people ?? []) if (!p.generalPractice) people.add(nameKey(p.name)); }
  return { manuscripts: ms.size, transcriptions: files, people: people.size };
}
