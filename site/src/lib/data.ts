// Reads the output artifacts in outputs/<specification>/<compiler>/ at build time. Nothing here is fetched from the web.
import { createHash } from "node:crypto";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";

export const ROOT = new URL("../../../", import.meta.url).pathname;
export const REPO = "https://github.com/openlexis/transcription";

/** The one specification of this repository, read at build time. */
export const SPEC = readFileSync(`${ROOT}SPECIFICATION.md`, "utf8");
export const SPEC_SHA = createHash("sha256").update(SPEC).digest("hex");
export const SPEC_ULID = (SPEC.match(/\b([0-9A-HJKMNP-TV-Z]{26})\b/) ?? [])[1] ?? "";
export const shortHash = (h?: string) => (h ? h.slice(0, 12) : "");

export type Stats = { manuscripts: number; early: number; lines: number; uncoveredLines: number; words: number; columns: number; unanimousColumns: number; places: number; meanPlaceConfidence: number; meanWordConfidence: number; meanManuscriptsPerLine: number; aramaicLines?: number; aramaicWords?: number };
export type BookEntry = { id: string; book: string; name: string; section: string; language: string; file: string; sha256: string; stats: Stats };
export type Manifest = {
  specification: { file: string; sha256: string; statement: string };
  compiler: Record<string, string | boolean | undefined> & { id: string };
  method: { file: string; sha256: string; text: string };
  evidence: Record<string, string>;
  sections: Record<string, { name: string; languages: string; folders: string[] }>;
  books: BookEntry[];
};
export type Artifact = { slug: string; dir: string; spec: string; compiler: string; manifest: Manifest; current: boolean; time: number; isDefault: boolean };
export type DateInfo = { estimate: number | null; margin: number | null; from?: number; to?: number; method: string; source: string | null };
export type Reliability = { estimate: number; low: number; high: number; linesCompared: number; agreementShare: number | null; priorMean: number; priorStrength: number; dateRangeKnown: boolean };
export type Witness = { siglum: string; leaves?: string[]; kind: string; name?: string; century?: string; date: DateInfo; year: number; early: boolean; viewer: { name: string; url: string }[]; files: string[]; reliability: Reliability };
export type Word = { t: string; k: string; c?: number; lo?: number; hi?: number; p?: number; l?: number[]; d?: number[]; a?: number; x: number };
export type Line = { ref: string; aramaic?: string; uncovered?: boolean; witnesses: number[]; src?: string[]; g?: string[]; words?: Word[] };
export type Reading = { text: string; keys: string; xs: number[]; witnesses: number[]; partly?: number[]; p: number; lo: number; hi: number };
export type Place = { id: number; ref: string; at: number; n: number; cols: [number, number]; confidence: number; weight: number; lost?: boolean; readings: Reading[]; partlyLost?: number[]; lostEverywhere?: { p: number; lo: number; hi: number } };
export type Book = { id: string; book: string; name: string; section: string; language: string; settings: { origin: number; halfLife: number; lateAfter: number; undated: number }; inputs: string[]; stats: Stats; witnesses: Witness[]; lines: Line[]; places: Place[] };

const git = (...a: string[]) => { const r = spawnSync("git", a, { cwd: ROOT }); return r.status === 0 ? r.stdout.toString().trim() : ""; };
let LIST: Artifact[] | undefined;
/** Every artifact on disk. The default is the newest one under the current specification made by unchanged, committed code. */
export function artifacts(): Artifact[] {
  if (LIST) return LIST;
  const out = `${ROOT}outputs`, list: Artifact[] = [];
  for (const spec of existsSync(out) ? readdirSync(out).sort() : []) for (const compiler of readdirSync(`${out}/${spec}`).sort()) {
    const dir = `${out}/${spec}/${compiler}`;
    if (!existsSync(`${dir}/compilation.json`)) continue;
    const manifest = JSON.parse(readFileSync(`${dir}/compilation.json`, "utf8")) as Manifest;
    const c = manifest.compiler.commit;
    list.push({ slug: `${spec}-${compiler}`, dir, spec, compiler, manifest, current: manifest.specification.sha256 === SPEC_SHA, time: typeof c === "string" ? Number(git("show", "-s", "--format=%ct", c)) || 0 : 0, isDefault: false });
  }
  const rank = (a: Artifact) => [a.current ? 1 : 0, a.manifest.compiler.codeMatchesCommit === true ? 1 : 0, a.time];
  const best = [...list].sort((x, y) => { const [a, b] = [rank(x), rank(y)]; return b[0] - a[0] || b[1] - a[1] || b[2] - a[2]; })[0];
  if (best) best.isDefault = true;
  LIST = list.sort((x, y) => Number(y.isDefault) - Number(x.isDefault) || y.time - x.time || (x.slug < y.slug ? -1 : 1));
  return LIST;
}
export const defaultArtifact = () => artifacts().find((a) => a.isDefault)!;
export const artifactBySlug = (slug: string) => artifacts().find((a) => a.slug === slug)!;
/** Where an artifact's pages live: the default at /, the others under /a/<slug>/. */
export const base = (a: Artifact) => (a.isDefault ? "" : `/a/${a.slug}`);
export const bookUrl = (a: Artifact, id: string, rest = "") => `${base(a)}/c/${id}/${rest}`;

const CACHE = new Map<string, Book>();
export function book(a: Artifact, id: string): Book {
  const key = `${a.slug}/${id}`;
  let b = CACHE.get(key);
  if (!b) {
    if (CACHE.size >= 2) CACHE.delete(CACHE.keys().next().value!);
    const e = a.manifest.books.find((x) => x.id === id)!;
    b = JSON.parse(readFileSync(`${a.dir}/${e.file}`, "utf8")) as Book;
    CACHE.set(key, b);
  }
  return b;
}
const CH = new Map<string, string[]>();
/** The chapters of a book, read once per book. */
export function chapters(a: Artifact, id: string) {
  const key = `${a.slug}/${id}`;
  if (!CH.has(key)) CH.set(key, [...new Set(book(a, id).lines.map((l) => l.ref.split(":")[0]))]);
  return CH.get(key)!;
}

/** How a book's text is written: Hebrew runs right to left. */
export const script = (language?: string) => (language?.startsWith("Hebrew") ? { lang: "hbo", dir: "rtl", cls: "hebrew" } : { lang: "grc", dir: "ltr", cls: "greek" });
export const num = (x: number) => x.toLocaleString("en-US");
export const era = (y: number) => (y < 0 ? `${-y} BC` : `AD ${y}`);
/** A probability in plain words, never rounded to a certainty it does not have. */
export const pct = (x: number) => (x >= 0.9995 ? "over 99.9%" : x <= 0.0005 ? "under 0.1%" : `${Math.round(x * 1000) / 10}%`);
export const range = (lo: number, hi: number) => `${pct(lo)} to ${pct(hi)}`;

/** The holders' own files, from the inventory: never this repository's derived text files. */
type Tr = { holder: string; file?: string; files?: string[]; source: string; license: string; member?: string; format?: string };
let FILES: Map<string, Tr & { holderName: string; holderWeb: string }> | undefined;
export function holderFile(f: string) {
  if (!FILES) {
    const CAT = JSON.parse(readFileSync(`${ROOT}source/manuscripts.json`, "utf8"));
    FILES = new Map();
    for (const m of CAT.manuscripts) for (const t of m.transcriptions as Tr[]) {
      const rec = { ...t, holderName: CAT.holders[t.holder]?.name ?? t.holder, holderWeb: CAT.holders[t.holder]?.web ?? "" };
      for (const f of t.files ?? (t.file ? [t.file] : [])) FILES.set(f, rec);
    }
  }
  return FILES.get(f);
}

/** A small renderer for the specification and method files: headings, numbered and bulleted lists (one level of bullets inside
 * an item), tables, bold, code, links and paragraphs. It uses nothing else. */
export function md(src: string): string {
  const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const inline = (s: string) => esc(s).replace(/`([^`]+)`/g, "<code>$1</code>").replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>").replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');
  const out: string[] = [];
  let para: string[] = [], list: "ul" | "ol" | null = null, item: string[] | null = null, sub: string[][] | null = null, rows: string[][] = [];
  const flushItem = () => { if (item) { out.push(`<li>${inline(item.join(" "))}${sub ? `<ul>${sub.map((x) => `<li>${inline(x.join(" "))}</li>`).join("")}</ul>` : ""}</li>`); item = null; sub = null; } };
  const flush = () => {
    if (para.length) { out.push(`<p>${inline(para.join(" "))}</p>`); para = []; }
    flushItem(); if (list) { out.push(`</${list}>`); list = null; }
    if (rows.length) { const [h, , ...b] = rows; out.push(`<div class="scroll"><table><thead><tr>${h.map((c) => `<th>${inline(c)}</th>`).join("")}</tr></thead><tbody>${b.map((r) => `<tr>${r.map((c) => `<td>${inline(c)}</td>`).join("")}</tr>`).join("")}</tbody></table></div>`); rows = []; }
  };
  for (const raw of src.split("\n")) {
    const l = raw.trimEnd(); let m;
    if ((m = l.match(/^(#{1,3}) (.*)$/))) { flush(); const n = m[1].length + 1; out.push(`<h${n} id="${m[2].toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}">${inline(m[2])}</h${n}>`); continue; }
    if (l.startsWith("|")) { if (!rows.length) flush(); rows.push(l.slice(1, -1).split("|").map((c) => c.trim())); continue; }
    if ((m = l.match(/^(\d+)\. (.*)$/)) || (m = l.match(/^- (.*)$/))) {
      const kind = /^\d/.test(l) ? "ol" : "ul";
      if (list !== kind) { flush(); out.push(kind === "ol" ? `<ol start="${m[1]}">` : "<ul>"); list = kind; } else flushItem();
      item = [m.length === 3 ? m[2] : m[1]]; continue;
    }
    if ((m = l.match(/^\s{2,4}- (.*)$/)) && item) { (sub ??= []).push([m[1]]); continue; }
    if (/^\s+\S/.test(l) && item) { (sub ? sub[sub.length - 1] : item).push(l.trim()); continue; }
    if (!l.trim()) { if (!list) flush(); continue; }
    if (list) flush();
    para.push(l.trim());
  }
  flush();
  return out.join("\n");
}
