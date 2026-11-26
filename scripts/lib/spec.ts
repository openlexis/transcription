// Loads a specification file (specifications/<id>.yaml). A compilation reads only what this file lists: its `targets`
// (the books) and its `sources` (the manuscripts, their documented metadata and their XML files).
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";


export type SpecLicense = { copyright: string; name: string; url: string };

/** Every specification must declare a copyright and license. `bun run check` fails if this is missing. */
export function readSpecLicense(raw: Record<string, unknown>, at: string): SpecLicense {
  const license = raw.license;
  if (!license || typeof license !== "object" || Array.isArray(license)) {
    throw new Error(`${at}: missing required field license`);
  }
  const o = license as Record<string, unknown>;
  const field = (key: "copyright" | "name" | "url") => {
    const v = o[key];
    if (typeof v !== "string" || !v.trim()) throw new Error(`${at}: license.${key} is required`);
    return v.trim();
  };
  return { copyright: field("copyright"), name: field("name"), url: field("url") };
}

export type Target = { id: string; name: string; section: string; number: number; language: string };
export type SourceFile = { paths: string[]; format: string; license: string; sourceUrl: string; provenance: { id: string; name: string; url: string }; member?: string; lines: number; words: number };
export type Source = {
  id: string; type: "continuous" | "lectionary" | "catena" | "scroll"; language: string; name?: string; shelfmark?: string;
  century?: string; year?: number; yearFrom?: number; yearTo?: number; dateBasis?: string; dateSource?: string;
  viewers?: { name: string; url: string }[]; files: SourceFile[]; targets: string[];
};
export type Spec = { id: string; title: string; file: string; text: string; sha256: string; targets: Target[]; sources: Source[]; raw: Record<string, unknown> };

export function loadSpec(root: string, id: string): Spec {
  const file = `specifications/${id}.yaml`;
  const text = readFileSync(`${root}${file}`, "utf8");
  const raw = Bun.YAML.parse(text) as Record<string, any>;
  if (raw.id !== id) throw new Error(`${file}: its id is ${raw.id}, not ${id}`);
  const sources = (raw.sources as Source[]).map((s) => ({ ...s, id: String(s.id) }));
  const ids = new Set<string>();
  for (const s of sources) { if (ids.has(s.id)) throw new Error(`${file}: source ${s.id} is listed twice`); ids.add(s.id); }
  return { id, title: raw.title, file, text, sha256: createHash("sha256").update(text).digest("hex"), targets: raw.targets as Target[], sources, raw };
}

/** Removes a top-level YAML key and its indented lines (`key:` up to the next unindented line), then appends `block` at the end. */
export function setTopLevelBlock(yamlText: string, key: string, block: string): string {
  const lines = yamlText.split(/\r?\n/), out: string[] = [];
  let skipping = false;
  for (const line of lines) {
    if (line.startsWith(`${key}:`)) { skipping = true; continue; }
    if (skipping && (line === "" || /^[\s-]/.test(line) || line.startsWith("#"))) continue;
    skipping = false;
    out.push(line);
  }
  return out.join("\n").replace(/\s*$/, "\n") + block;
}
