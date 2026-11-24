// Reads the compilations/ folders at build time. Nothing here is fetched from the web.
import { existsSync, readdirSync, readFileSync } from "node:fs";

export const ROOT = new URL("../../../", import.meta.url).pathname;
export const REPO = "https://github.com/openlexis/transcription";
export const blob = (file: string, line?: number) => `${REPO}/blob/main/${file.split("/").map(encodeURIComponent).join("/")}${line ? `#L${line}` : ""}`;

export type Stats = {
  name: string; book: string; language?: string; model: string; manuscripts: number; early: number; lines: number; uncoveredLines: number; words: number;
  columns: number; unanimousColumns: number; places: number; settled: number; contested: number; meanPlaceConfidence: number; meanWordConfidence: number;
  singularReadingsWithoutVote: number; translationLines?: number; translationWords?: number; aramaicLines?: number; aramaicWords?: number; eyeSkipsWithoutVote: number; byType: Record<string, number>; bySeverity: Record<string, number>; meanManuscriptsPerLine: number; sha256: string;
};
export type Witness = { siglum: string; leaves?: string[]; name?: string; century?: string; year: number; dated: boolean; early: boolean; proximity: number; viewer: { name: string; url: string }[]; files: string[] };
export type Word = { t: string; k: string; c?: number; p?: number; l?: number[]; d?: number[]; a?: number; tr?: number };
export type Line = { ref: string; aramaic?: string; translation?: string; uncovered?: boolean; witnesses: number[]; src?: string[]; words?: Word[] };
export type Reading = { text: string; keys: string; witnesses: number[]; partly?: number[]; votes: number; score: number; share: number; flags?: string[] };
export type Place = { id: number; ref: string; at: number; n: number; confidence: number; weight: number; type: string; severity: string; readings: Reading[]; partlyLost?: number[] };
export type Compilation = { id: string; stats: Stats; rules: string; chapters: string[] };

export const SECTIONS: Record<string, string> = { ot: "Old Testament (Hebrew and Aramaic)", nt: "New Testament (Greek)" };
/** How a compilation's text is written: Hebrew runs right to left. */
export const script = (language?: string) => (language?.startsWith("Hebrew") ? { lang: "hbo", dir: "rtl", cls: "hebrew" } : { lang: "grc", dir: "ltr", cls: "greek" });

let LIST: Compilation[] | undefined;
export function compilations(): Compilation[] {
  if (LIST) return LIST;
  const dir = `${ROOT}compilations`;
  LIST = readdirSync(dir).filter((d) => existsSync(`${dir}/${d}/stats.json`)).sort().map((id) => {
    const stats = JSON.parse(readFileSync(`${dir}/${id}/stats.json`, "utf8")) as Stats;
    const rules = readFileSync(`${dir}/${id}/RULES.md`, "utf8");
    const t = full(id);
    const chapters = [...new Set(t.lines.map((l) => l.ref.split(":")[0]))];
    return { id, stats, rules, chapters };
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

/** A small renderer for the rule files (headings, lists, bold, code, links, paragraphs); they use nothing else. */
export function md(src: string): string {
  const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const inline = (s: string) => esc(s).replace(/`([^`]+)`/g, "<code>$1</code>").replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>").replace(/_([^_]+)_/g, "<em>$1</em>").replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');
  const out: string[] = []; let list: "ul" | "ol" | null = null, para: string[] = [];
  const flush = () => { if (para.length) { out.push(`<p>${inline(para.join(" "))}</p>`); para = []; } };
  const close = () => { if (list) { out.push(`</li></${list}>`); list = null; } };
  for (const raw of src.split("\n")) {
    const l = raw.trimEnd();
    let m;
    if ((m = l.match(/^(#{1,3}) (.*)$/))) { flush(); close(); const n = m[1].length + 1; out.push(`<h${n}>${inline(m[2])}</h${n}>`); continue; }
    if ((m = l.match(/^(\d+)\. (.*)$/)) || (m = l.match(/^- (.*)$/))) {
      flush(); const kind = /^\d/.test(l) ? "ol" : "ul"; const text = m.length === 3 ? m[2] : m[1];
      if (list !== kind) { close(); out.push(`<${kind}${kind === "ol" ? ` start="${m[1]}"` : ""}><li>`); list = kind; } else out.push("</li><li>");
      out.push(inline(text)); continue;
    }
    if (/^\s+\S/.test(l) && list) { out.push(" " + inline(l.trim())); continue; }
    if (!l.trim()) { flush(); close(); continue; }
    close(); para.push(l.trim());
  }
  flush(); close();
  return out.join("\n");
}

/** The front fields of a rule file (Name, Book, Model, Language, ...), its numbered rules, and its inputs. */
export function ruleParts(src: string) {
  const front = [...src.matchAll(/^- \*\*([^:*]+):\*\* (.*)$/gm)].map((m) => [m[1], m[2]] as [string, string]);
  const at = (h: string) => { const i = src.indexOf(h); return i < 0 ? src.length : i; };
  const how = src.slice(at("## How the model does the work"), at("## Rules"));
  const rules = src.slice(at("## Rules"), at("## Inputs"));
  const inputs = [...src.slice(at("## Inputs")).matchAll(/^- `([^`]+)`$/gm)].map((m) => m[1]);
  const title = (src.match(/^# (.*)$/m)?.[1] ?? "");
  return { title, front, how, rules, inputs };
}
