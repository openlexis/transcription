// Reads the compilations/ folders at build time. Nothing here is fetched from the web.
import { existsSync, readdirSync, readFileSync } from "node:fs";

export const ROOT = new URL("../../../", import.meta.url).pathname;
export const REPO = "https://github.com/openlexis/transcription";
export const blob = (file: string, line?: number) => `${REPO}/blob/main/${file.split("/").map(encodeURIComponent).join("/")}${line ? `#L${line}` : ""}`;

export type Stats = {
  name: string; book: string; section: string; language?: string; origin: number; lateAfter: number;
  producedUnder: { file: string; sha256: string }; producedBy: Record<string, string | boolean | undefined>; manuscripts: number; early: number; lines: number; uncoveredLines: number; words: number;
  columns: number; unanimousColumns: number; places: number; settled: number; contested: number; meanPlaceConfidence: number; meanWordConfidence: number;
  singularReadingsWithoutVote: number; translationLines?: number; translationWords?: number; aramaicLines?: number; aramaicWords?: number; eyeSkipsWithoutVote: number; byType: Record<string, number>; bySeverity: Record<string, number>; meanManuscriptsPerLine: number; sha256: string;
};
export type Witness = { siglum: string; leaves?: string[]; name?: string; century?: string; year: number; dated: boolean; early: boolean; proximity: number; viewer: { name: string; url: string }[]; files: string[] };
export type Word = { t: string; k: string; c?: number; p?: number; l?: number[]; d?: number[]; a?: number; tr?: number };
export type Line = { ref: string; aramaic?: string; translation?: string; uncovered?: boolean; witnesses: number[]; src?: string[]; words?: Word[] };
export type Reading = { text: string; keys: string; witnesses: number[]; partly?: number[]; votes: number; score: number; share: number; flags?: string[] };
export type Place = { id: number; ref: string; at: number; n: number; confidence: number; weight: number; type: string; severity: string; readings: Reading[]; partlyLost?: number[] };
export type Compilation = { id: string; stats: Stats; chapters: string[] };

export const SECTIONS: Record<string, string> = { ot: "Old Testament (Hebrew and Aramaic)", nt: "New Testament (Greek)" };
/** How a compilation's text is written: Hebrew runs right to left. */
export const script = (language?: string) => (language?.startsWith("Hebrew") ? { lang: "hbo", dir: "rtl", cls: "hebrew" } : { lang: "grc", dir: "ltr", cls: "greek" });

let LIST: Compilation[] | undefined;
export function compilations(): Compilation[] {
  if (LIST) return LIST;
  const dir = `${ROOT}compilations`;
  LIST = readdirSync(dir).filter((d) => existsSync(`${dir}/${d}/stats.json`)).sort().map((id) => {
    const stats = JSON.parse(readFileSync(`${dir}/${id}/stats.json`, "utf8")) as Stats;
    const t = full(id);
    const chapters = [...new Set(t.lines.map((l) => l.ref.split(":")[0]))];
    return { id, stats, chapters };
  });
  return LIST;
}
const CACHE = new Map<string, { t: { witnesses: Witness[]; lines: Line[] }; d: { places: Place[] } }>();
function load(id: string) {
  let c = CACHE.get(id);
  if (!c) {
    if (CACHE.size >= 2) CACHE.delete(CACHE.keys().next().value!);
    const dir = `${ROOT}compilations/${id}`;
    c = { t: JSON.parse(readFileSync(`${dir}/transcription.json`, "utf8")), d: JSON.parse(readFileSync(`${dir}/disagreements.json`, "utf8")) };
    CACHE.set(id, c);
  }
  return c;
}
export const full = (id: string) => load(id).t;
export const placesOf = (id: string) => load(id).d.places;
export const sectionOf = (id: string) => id.split("-")[0];
export const pct = (x: number) => `${Math.round(x * 1000) / 10}%`;
export const num = (x: number) => x.toLocaleString("en-US");
export const linkOf = (id: string, ref: string) => `/c/${id}/${ref.split(":")[0]}/#l${ref.replace(":", "-")}`;

/** A small renderer for SPECIFICATION.md: headings, numbered and bulleted lists (one level of bullets inside a numbered
 * item), tables, bold, code, links and paragraphs. It uses nothing else. */
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
    if ((m = l.match(/^(#{1,3}) (.*)$/))) { flush(); const n = m[1].length + 1; out.push(`<h${n} id="${m[2].toLowerCase().replace(/[^a-z0-9]+/g, "-")}">${inline(m[2])}</h${n}>`); continue; }
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

/** The one specification of this repository, read at build time. */
export const SPEC = readFileSync(`${ROOT}SPECIFICATION.md`, "utf8");
export const shortHash = (h?: string) => (h ? h.slice(0, 12) : "");
