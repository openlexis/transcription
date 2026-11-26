// Which source transcriptions a compiled book used, and their credits (server side).
import type { CompilationRecord, CompiledBookEntry, SourceFileEntry, SourceItem, SpecFile } from "./corpus";
import { bookUrl, compUrl, shortUlid, specUrl } from "./corpus";
import { parseLicense, type OurCredit, type SourceCredit } from "./cite";

/** "archives/uxlc/L.Obadiah.xml" and "src/uxlc/L.Obadiah.xml" both give "uxlc/L.Obadiah.xml". */
const tail = (p: string) => p.trim().split("/").slice(1).join("/");

export interface UsedFile {
  item: SourceItem;
  file: SourceFileEntry;
  path: string;
}

const pathIndexes = new WeakMap<SpecFile, Map<string, UsedFile>>();
function pathIndex(spec: SpecFile): Map<string, UsedFile> {
  let idx = pathIndexes.get(spec);
  if (!idx) {
    idx = new Map();
    for (const item of spec.sources) for (const file of item.files) for (const path of file.paths) idx.set(tail(path), { item, file, path });
    pathIndexes.set(spec, idx);
  }
  return idx;
}

/** The source files a witness used, from its "source-files" note; falls back to the specification's record for its siglum. */
export function witnessFiles(spec: SpecFile, siglum: string, filesNote: string): UsedFile[] {
  const idx = pathIndex(spec);
  const out: UsedFile[] = [];
  for (const p of filesNote.split(/,\s*/).filter(Boolean)) {
    const hit = idx.get(tail(p));
    if (hit && !out.some((u) => u.path === hit.path)) out.push(hit);
  }
  if (out.length) return out;
  const item = spec.sources.find((s) => s.id === siglum);
  return item ? item.files.map((file) => ({ item, file, path: file.paths[0] })) : [];
}

export function creditOf(u: { item: SourceItem; file: SourceFileEntry }): SourceCredit {
  const name = u.item.name && u.item.name !== u.item.id ? `${u.item.name} (${u.item.id})` : u.item.id;
  return {
    project: u.file.provenance.name,
    projectUrl: u.file.provenance.url,
    title: name,
    link: u.file.sourceUrl,
    license: parseLicense(u.file.license, u.file.sourceUrl),
  };
}

/** One credit per manuscript and source project (files of the same manuscript from one project count once). */
export function perManuscript(used: UsedFile[]): SourceCredit[] {
  const seen = new Set<string>();
  const out: SourceCredit[] = [];
  for (const u of used) {
    const c = creditOf(u);
    const k = `${u.item.id}\u0000${c.project}\u0000${c.license.name}\u0000${c.license.where}`;
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(c);
  }
  return out;
}

export function allSpecFiles(spec: SpecFile): UsedFile[] {
  return spec.sources.flatMap((item) => item.files.map((file) => ({ item, file, path: file.paths[0] })));
}

const license = (spec: SpecFile | undefined) => ({
  copyright: spec?.license?.copyright ?? "",
  licenseName: spec?.license?.name ?? "",
  licenseUrl: spec?.license?.url ?? "",
});

export function specCredit(spec: SpecFile): OurCredit {
  return { key: `openlexis-spec-${shortUlid(spec.id)}`, title: spec.title, path: specUrl(spec.id), ids: [["Specification", spec.id]], ...license(spec) };
}

export function compilationCredit(c: CompilationRecord, title: string, spec: SpecFile | undefined): OurCredit {
  return {
    key: `openlexis-${shortUlid(c.compilationId)}`,
    title,
    path: compUrl(c.compilationId),
    ids: [["Transcription", c.compilationId], ["Specification", c.specId]],
    ...license(spec),
  };
}

export function bookCredit(c: CompilationRecord, b: CompiledBookEntry, compTitle: string, spec: SpecFile | undefined): OurCredit {
  return {
    key: `openlexis-${shortUlid(c.compilationId)}-${b.id}`,
    title: `${b.name}, ${compTitle}`,
    path: bookUrl(c.compilationId, b.id),
    ids: [["Transcription", c.compilationId], ["Specification", c.specId]],
    ...license(spec),
  };
}
