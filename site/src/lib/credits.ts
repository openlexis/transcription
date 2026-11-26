// Which source transcriptions a compiled book used, and their credits (server side).
import type { CompilationRecord, CompiledBookEntry, SourceFileEntry, SourceItem, SpecFile } from "./corpus";
import { bookUrl, compUrl, shortUlid, specUrl } from "./corpus";
import { parseLicense, sourceTitle, type OurCredit, type SourceCredit } from "./cite";

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

export function creditOf(u: UsedFile, paths?: string[]): SourceCredit {
  const allPaths = paths ?? [u.path];
  return {
    project: u.file.provenance.name,
    projectUrl: u.file.provenance.url,
    title: sourceTitle({
      project: u.file.provenance.name,
      paths: allPaths,
      id: u.item.id,
      name: u.item.name,
      language: u.item.language,
      targets: u.item.targets,
    }),
    link: u.file.sourceUrl,
    license: parseLicense(u.file.license, u.file.sourceUrl),
  };
}

/** One credit per manuscript and source project, naming the books those files cover. */
export function perManuscript(used: UsedFile[]): SourceCredit[] {
  const groups = new Map<string, { first: UsedFile; paths: string[] }>();
  for (const u of used) {
    const lic = parseLicense(u.file.license, u.file.sourceUrl);
    const k = `${u.item.id}\u0000${u.file.provenance.name}\u0000${lic.name}\u0000${lic.where}`;
    const cur = groups.get(k);
    if (cur) {
      if (!cur.paths.includes(u.path)) cur.paths.push(u.path);
    } else groups.set(k, { first: u, paths: [u.path] });
  }
  return [...groups.values()]
    .map((g) => creditOf(g.first, g.paths))
    .sort((a, b) => (a.title ?? "").localeCompare(b.title ?? ""));
}

export function allSpecFiles(spec: SpecFile): UsedFile[] {
  return spec.sources.flatMap((item) =>
    item.files.flatMap((file) => file.paths.map((path) => ({ item, file, path }))),
  );
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
