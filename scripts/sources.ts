#!/usr/bin/env bun
/**
 * Programmatic resolver and CLI for specification source references.
 * Resolves a specification YAML's `sources` entries, supporting:
 *   - Immutable set ULIDs (`archives/sets/<ULID>.json`, e.g., pinned book or institution snapshots)
 *   - Direct item identifiers (`<institution>:<id>`, e.g., `uxlc:L`, `intf:01`)
 *
 * Derives target books directly from the resolved sources (single source of truth).
 *
 * Two kinds of specification:
 *   - Folder specification: `specifications/<ULID>/specification.yaml` with `sources: sources.json`. Everything it uses is in
 *     that folder; `sources.json` (made by `bun run spec:freeze`) lists every transcript with the git commit that holds it.
 *   - Older single-file specification: `specifications/<ULID>.yaml`, whose `sources` name source sets and catalogs elsewhere
 *     in the repository (read as before so existing compilations keep displaying).
 *
 * Usage:
 *   bun run sources summary [--spec <id>] [--json]
 *   bun run sources targets [--spec <id>] [--json]
 *   bun run sources list [--target Gen] [--institution intf] [--type scroll] [--language Greek] [--json]
 *   bun run sources get <id|institution:id> [--spec <id>] [--json]
 */
import { spawnSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { CANONICAL_BOOKS, type SourceSet } from "./sets";

const ROOT = new URL("..", import.meta.url).pathname;
const ULID_RE = /^[0-9A-HJKMNP-TV-Z]{26}$/;
const BOOK_META = new Map(CANONICAL_BOOKS.map((b, i) => [b.id, { ...b, order: i }]));

export interface InstitutionIndex {
  institution: { id: string; name: string; url: string };
  items: {
    id: string;
    type: "continuous" | "scroll" | "lectionary" | "catena";
    language: string;
    name?: string;
    shelfmark?: string;
    century?: string;
    year?: number;
    yearFrom?: number;
    yearTo?: number;
    dateBasis?: string;
    dateSource?: string;
    viewers?: { name: string; url: string }[];
    targets?: string[];
    paths: string[];
    format: string;
    license: string;
    sourceUrl: string;
    member?: string;
    lines?: number;
    words?: number;
  }[];
}

export interface TargetBook {
  id: string;
  name: string;
  section: string;
  number: number;
  language: string;
  setId?: string;
}

export interface ResolvedSource {
  id: string;
  type: "continuous" | "scroll" | "lectionary" | "catena";
  language: string;
  name?: string;
  shelfmark?: string;
  century?: string;
  year?: number;
  yearFrom?: number;
  yearTo?: number;
  dateBasis?: string;
  dateSource?: string;
  viewers?: { name: string; url: string }[];
  targets: string[];
  files: {
    paths: string[];
    format: string;
    license: string;
    sourceUrl: string;
    member?: string;
    lines?: number;
    words?: number;
    provenance: { id: string; name: string; url: string };
    /** Folder specifications only: each transcript's identifier, repository path, and the git commit to read it from. */
    transcripts?: PinnedTranscript[];
  }[];
}

export interface PinnedTranscript {
  id: string;
  path: string;
  commit: string;
}

/** The shape of `specifications/<ULID>/sources.json`: only the specification id and the transcripts, each with its
 * identifier, repository path, and the git commit that holds it. Book, language, date, license and archive details are
 * read from the transcript and its catalog (`archives/<archive>/index.json`) at that same commit. */
export interface FrozenSources {
  specification: string;
  transcripts: PinnedTranscript[];
  /** Earlier folder form only: a copied catalog. Still read when present; new lists do not include it. */
  manuscripts?: FrozenSourcesLegacy["manuscripts"];
  archives?: FrozenSourcesLegacy["archives"];
  books?: TargetBook[];
  selection?: string[];
}

export interface FrozenSourcesLegacy {
  specification: string;
  description?: string;
  createdAt?: string;
  selection?: string[];
  books: TargetBook[];
  archives: Record<string, { id: string; name: string; url: string }>;
  manuscripts: (Omit<ResolvedSource, "files"> & {
    files: {
      archive: string;
      format: string;
      license: string;
      sourceUrl: string;
      member?: string;
      lines?: number;
      words?: number;
      transcripts: PinnedTranscript[];
    }[];
  })[];
}

/** A file's text as it is in a given git commit (`git show <commit>:<path>`). */
export function gitShow(commit: string, relPath: string): string {
  const r = spawnSync("git", ["show", `${commit}:${relPath}`], { cwd: ROOT, encoding: "utf8", maxBuffer: 1 << 30 });
  if (r.status !== 0) throw new Error(`Cannot read ${relPath} at commit ${commit}: ${(r.stderr || "").trim()}`);
  return r.stdout;
}

const catalogCache = new Map<string, InstitutionIndex>();
function catalogAt(archive: string, commit: string): InstitutionIndex {
  const key = `${commit}:${archive}`;
  const hit = catalogCache.get(key);
  if (hit) return hit;
  const idx = JSON.parse(gitShow(commit, `archives/${archive}/index.json`)) as InstitutionIndex;
  catalogCache.set(key, idx);
  return idx;
}

export function archiveOfPath(path: string): string {
  const m = path.match(/^archives\/([^/]+)\//);
  if (!m) throw new Error(`Transcript path is not under archives/: ${path}`);
  return m[1];
}

/** Look up each pinned transcript in its archive catalog at the same commit, and build the compiler/site source list. */
export function sourcesFromPinned(transcripts: PinnedTranscript[]): { targets: TargetBook[]; sources: ResolvedSource[] } {
  const merged = new Map<string, ResolvedSource>();
  const discoveredBooks = new Set<string>();
  for (const t of transcripts) {
    const archive = archiveOfPath(t.path);
    const idx = catalogAt(archive, t.commit);
    const item = idx.items.find((i) => i.paths.includes(t.path));
    if (!item) throw new Error(`${t.path} is not listed in archives/${archive}/index.json at commit ${t.commit}`);
    for (const b of item.targets ?? []) discoveredBooks.add(b);
    const fileEntry = {
      paths: [t.path],
      format: item.format,
      license: item.license,
      sourceUrl: item.sourceUrl,
      ...(item.member ? { member: item.member } : {}),
      ...(item.lines !== undefined ? { lines: item.lines } : {}),
      ...(item.words !== undefined ? { words: item.words } : {}),
      provenance: idx.institution,
      transcripts: [t],
    };
    const existing = merged.get(item.id);
    if (existing) {
      existing.files.push(fileEntry);
      const set = new Set([...existing.targets, ...(item.targets ?? [])]);
      existing.targets = [...set].sort(
        (a, b) => (BOOK_META.get(a)?.order ?? 999) - (BOOK_META.get(b)?.order ?? 999)
      );
    } else {
      merged.set(item.id, {
        id: item.id,
        type: item.type,
        language: item.language,
        ...(item.name ? { name: item.name } : {}),
        ...(item.shelfmark ? { shelfmark: item.shelfmark } : {}),
        ...(item.century ? { century: item.century } : {}),
        ...(item.year !== undefined ? { year: item.year } : {}),
        ...(item.yearFrom !== undefined ? { yearFrom: item.yearFrom } : {}),
        ...(item.yearTo !== undefined ? { yearTo: item.yearTo } : {}),
        ...(item.dateBasis ? { dateBasis: item.dateBasis } : {}),
        ...(item.dateSource ? { dateSource: item.dateSource } : {}),
        ...(item.viewers?.length ? { viewers: item.viewers } : {}),
        targets: [...(item.targets ?? [])],
        files: [fileEntry],
      });
    }
  }
  const targets: TargetBook[] = [...discoveredBooks]
    .map((k) => {
      const meta = BOOK_META.get(k);
      return {
        id: k,
        name: meta?.name ?? k,
        section: meta?.section ?? "Other",
        number: meta?.number ?? 0,
        language: meta?.language ?? "Unknown",
      };
    })
    .sort((a, b) => (BOOK_META.get(a.id)?.order ?? 999) - (BOOK_META.get(b.id)?.order ?? 999));
  const sources = [...merged.values()].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  return { targets, sources };
}

/** A folder specification's YAML path, `specifications/<ULID>/specification.yaml`. */
export const folderSpecFile = (id: string) => `${ROOT}specifications/${id}/specification.yaml`;
export const isFolderSpec = (specPath: string) => specPath.endsWith("/specification.yaml");

/** Every specification in the repository (folder and single-file), oldest first, as `{ id, path }`. */
export function listSpecs(): { id: string; path: string }[] {
  const dir = `${ROOT}specifications`;
  const out: { id: string; path: string }[] = [];
  for (const f of readdirSync(dir, { withFileTypes: true })) {
    if (f.isDirectory() && ULID_RE.test(f.name) && existsSync(folderSpecFile(f.name))) out.push({ id: f.name, path: folderSpecFile(f.name) });
    else if (f.isFile() && /\.ya?ml$/.test(f.name)) out.push({ id: f.name.replace(/\.ya?ml$/, ""), path: `${dir}/${f.name}` });
  }
  return out.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
}

/** With no ID, the newest specification. */
export function findSpecPath(specId?: string): string {
  const specs = listSpecs();
  if (!specs.length) throw new Error("No specifications found in specifications/");
  if (!specId) return specs[specs.length - 1].path;
  const match = specs.find((s) => s.id === specId) ?? specs.find((s) => s.id.startsWith(specId));
  if (!match) throw new Error(`Specification "${specId}" not found in specifications/`);
  return match.path;
}

/** Reads a folder specification's `sources.json` into the same shape the older specifications resolve to. */
export function loadFrozenSources(specPath: string): { frozen: FrozenSources; targets: TargetBook[]; sources: ResolvedSource[] } {
  const jsonPath = specPath.replace(/specification\.yaml$/, "sources.json");
  if (!existsSync(jsonPath)) throw new Error(`Missing ${jsonPath.slice(ROOT.length)} (run bun run spec:freeze)`);
  const frozen = JSON.parse(readFileSync(jsonPath, "utf8")) as FrozenSources;
  if (frozen.transcripts?.length && !frozen.manuscripts) {
    const { targets, sources } = sourcesFromPinned(frozen.transcripts);
    return { frozen, targets, sources };
  }
  // Earlier folder form: the list already copied catalog details.
  const legacy = frozen as FrozenSources & FrozenSourcesLegacy;
  const sources: ResolvedSource[] = (legacy.manuscripts ?? []).map(({ files, ...m }) => ({
    ...m,
    files: files.map(({ archive, transcripts, ...f }) => ({
      ...f,
      paths: transcripts.map((t) => t.path),
      provenance: legacy.archives[archive],
      transcripts,
    })),
  }));
  return { frozen, targets: legacy.books ?? [], sources };
}

export function loadSpecWithSources(specId?: string) {
  const specPath = findSpecPath(specId);
  const spec = Bun.YAML.parse(readFileSync(specPath, "utf8")) as {
    id: string;
    title: string;
    sources: string | string[] | Record<string, string[]>;
  };
  if (isFolderSpec(specPath)) {
    if (spec.sources !== "sources.json") throw new Error(`${specPath.slice(ROOT.length)}: sources must be "sources.json"`);
    const { frozen, targets, sources } = loadFrozenSources(specPath);
    if (frozen.specification !== spec.id) throw new Error(`sources.json is for ${frozen.specification}, not ${spec.id}`);
    return { spec, specPath, targets, sources, resolvedSets: [] as SourceSet[] };
  }
  return { spec, specPath, ...resolveSelection(spec.sources as string[] | Record<string, string[]>) };
}

/** Resolves an older specification's `sources` (source set ULIDs and `<archive>:<id>` items) through archives/sets and the
 * archive catalogs. Also used by `bun run spec:freeze` to turn a selection into a frozen list. */
export function resolveSelection(selection: string[] | Record<string, string[]>) {
  const spec = { sources: selection };

  // Expand ULID sets and direct `institution:id` refs into explicit inst -> Set<id>
  const allowedByInst = new Map<string, Set<string>>();
  const bookSetIds = new Map<string, string>();
  const resolvedSets: SourceSet[] = [];

  const addRef = (instId: string, itemId: string) => {
    let set = allowedByInst.get(instId);
    if (!set) {
      set = new Set();
      allowedByInst.set(instId, set);
    }
    set.add(itemId);
  };

  if (Array.isArray(spec.sources)) {
    for (const ref of spec.sources) {
      if (ULID_RE.test(ref)) {
        const setPath = `${ROOT}archives/sets/${ref}.json`;
        if (!existsSync(setPath)) throw new Error(`Missing source set: archives/sets/${ref}.json`);
        const setObj = JSON.parse(readFileSync(setPath, "utf8")) as SourceSet;
        resolvedSets.push(setObj);
        if (setObj.kind === "book") bookSetIds.set(setObj.key, setObj.id);
        for (const [instId, ids] of Object.entries(setObj.sources)) {
          for (const id of ids) addRef(instId, id);
        }
      } else if (ref.includes(":")) {
        const [instId, itemId] = ref.split(":", 2);
        addRef(instId, itemId);
      } else {
        throw new Error(`Unrecognized source reference "${ref}" (expected a ULID or institution:id)`);
      }
    }
  } else {
    for (const [instId, ids] of Object.entries(spec.sources)) {
      for (const id of ids) addRef(instId, id);
    }
  }

  const merged = new Map<string, ResolvedSource>();
  const discoveredBooks = new Set<string>(bookSetIds.keys());

  for (const [instId, idSet] of [...allowedByInst.entries()].sort()) {
    const idxPath = `${ROOT}archives/${instId}/index.json`;
    if (!existsSync(idxPath)) throw new Error(`Missing catalog: archives/${instId}/index.json`);
    const idx = JSON.parse(readFileSync(idxPath, "utf8")) as InstitutionIndex;
    const byId = new Map(idx.items.map((item) => [item.id, item]));

    for (const id of [...idSet].sort()) {
      const item = byId.get(id);
      if (!item) throw new Error(`Source "${id}" not found in archives/${instId}/index.json`);
      for (const b of item.targets ?? []) discoveredBooks.add(b);

      const fileEntry = {
        paths: item.paths,
        format: item.format,
        license: item.license,
        sourceUrl: item.sourceUrl,
        ...(item.member ? { member: item.member } : {}),
        ...(item.lines !== undefined ? { lines: item.lines } : {}),
        ...(item.words !== undefined ? { words: item.words } : {}),
        provenance: idx.institution,
      };
      const existing = merged.get(id);
      if (existing) {
        existing.files.push(fileEntry);
        const set = new Set([...existing.targets, ...(item.targets ?? [])]);
        existing.targets = [...set].sort(
          (a, b) => (BOOK_META.get(a)?.order ?? 999) - (BOOK_META.get(b)?.order ?? 999)
        );
      } else {
        merged.set(id, {
          id: item.id,
          type: item.type,
          language: item.language,
          ...(item.name ? { name: item.name } : {}),
          ...(item.shelfmark ? { shelfmark: item.shelfmark } : {}),
          ...(item.century ? { century: item.century } : {}),
          ...(item.year !== undefined ? { year: item.year } : {}),
          ...(item.yearFrom !== undefined ? { yearFrom: item.yearFrom } : {}),
          ...(item.yearTo !== undefined ? { yearTo: item.yearTo } : {}),
          ...(item.dateBasis ? { dateBasis: item.dateBasis } : {}),
          ...(item.dateSource ? { dateSource: item.dateSource } : {}),
          ...(item.viewers?.length ? { viewers: item.viewers } : {}),
          targets: [...(item.targets ?? [])],
          files: [fileEntry],
        });
      }
    }
  }

  // Derive targets directly from resolved book sets (or discovered books if only direct/institution refs were used)
  const targetKeys = bookSetIds.size ? [...bookSetIds.keys()] : [...discoveredBooks];
  const targets: TargetBook[] = targetKeys
    .map((k) => {
      const meta = BOOK_META.get(k);
      return {
        id: k,
        name: meta?.name ?? k,
        section: meta?.section ?? "Other",
        number: meta?.number ?? 0,
        language: meta?.language ?? "Unknown",
        ...(bookSetIds.has(k) ? { setId: bookSetIds.get(k) } : {}),
      };
    })
    .sort((a, b) => (BOOK_META.get(a.id)?.order ?? 999) - (BOOK_META.get(b.id)?.order ?? 999));

  const sources = [...merged.values()].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  return { targets, sources, resolvedSets };
}

if (import.meta.main) {
  const args = process.argv.slice(2);
  const cmd = args[0] ?? "summary";
  const flag = (name: string) => {
    const i = args.indexOf(name);
    return i >= 0 ? args[i + 1] : undefined;
  };
  const asJson = args.includes("--json");
  const specFlag = flag("--spec");

  if (cmd === "summary") {
    const { spec, targets, sources, resolvedSets } = loadSpecWithSources(
      specFlag ?? (args[1] && !args[1].startsWith("-") ? args[1] : undefined)
    );
    const xmlFiles = sources.reduce((n, s) => n + s.files.reduce((m, f) => m + f.paths.length, 0), 0);
    const instCounts: Record<string, number> = {};
    for (const s of sources) {
      for (const f of s.files) instCounts[f.provenance.id] = (instCounts[f.provenance.id] ?? 0) + 1;
    }
    const out = {
      specification: spec.id,
      title: spec.title,
      pinnedSets: resolvedSets.length,
      targets: targets.length,
      sources: sources.length,
      xmlFiles,
      institutions: instCounts,
    };
    console.log(
      asJson
        ? JSON.stringify(out, null, 2)
        : `${spec.title} (${spec.id})\n  Pinned sets: ${out.pinnedSets}\n  Targets: ${out.targets} books\n  Sources: ${out.sources} primary sources (${out.xmlFiles} XML files across ${Object.keys(instCounts).length} institutions)`
    );
  } else if (cmd === "targets") {
    const { targets, sources } = loadSpecWithSources(specFlag);
    const counts = Object.fromEntries(targets.map((t) => [t.id, 0]));
    for (const s of sources) for (const t of s.targets) counts[t] = (counts[t] ?? 0) + 1;
    const rows = targets.map((t) => ({ ...t, sources: counts[t.id] ?? 0 }));
    if (asJson) console.log(JSON.stringify(rows, null, 2));
    else
      for (const r of rows)
        console.log(
          `${r.id.padEnd(7)} ${r.name.padEnd(18)} ${String(r.sources).padStart(4)} sources  ${r.setId ?? ""}`
        );
  } else if (cmd === "list") {
    const { sources } = loadSpecWithSources(specFlag);
    const target = flag("--target");
    const inst = flag("--institution");
    const type = flag("--type");
    const lang = flag("--language");
    const filtered = sources.filter((s) => {
      if (target && !s.targets.includes(target)) return false;
      if (inst && !s.files.some((f) => f.provenance.id === inst)) return false;
      if (type && s.type !== type) return false;
      if (lang && s.language.toLowerCase() !== lang.toLowerCase()) return false;
      return true;
    });
    if (asJson) {
      console.log(JSON.stringify(filtered, null, 2));
    } else {
      for (const s of filtered) {
        const paths = s.files.flatMap((f) => f.paths).length;
        console.log(`${s.id.padEnd(16)} ${s.type.padEnd(11)} ${s.language.padEnd(7)} ${String(paths).padStart(3)} XML  ${s.name ?? ""}`);
      }
      console.error(`\n${filtered.length} source(s)`);
    }
  } else if (cmd === "get") {
    const query = args[1];
    if (!query) throw new Error("usage: bun run sources get <id|institution:id> [--json]");
    const { sources } = loadSpecWithSources(specFlag);
    const [instFilter, idFilter] = query.includes(":") ? query.split(":", 2) : [undefined, query];
    const match = sources.find((s) => s.id === idFilter);
    if (!match) {
      console.error(`Source "${query}" is not in this specification.`);
      process.exit(1);
    }
    const result = instFilter
      ? { ...match, files: match.files.filter((f) => f.provenance.id === instFilter) }
      : match;
    console.log(JSON.stringify(result, null, 2));
  } else {
    console.log(
      "Usage:\n  bun run sources summary [--spec <id>] [--json]\n  bun run sources targets [--spec <id>] [--json]\n  bun run sources list [--target <book>] [--institution <id>] [--type <kind>] [--language <lang>] [--json]\n  bun run sources get <id|institution:id> [--spec <id>] [--json]"
    );
  }
}
