import { existsSync, readdirSync, readFileSync } from "node:fs";
import { parse } from "yaml";

export const ROOT = new URL("../../../", import.meta.url).pathname;
export const REPO = "https://github.com/openlexis/transcription";

export const githubBlob = (relPath: string) =>
  `${REPO}/blob/main/${relPath.split("/").map(encodeURIComponent).join("/")}`;

export const githubTree = (relPath: string) =>
  `${REPO}/tree/main/${relPath.split("/").map(encodeURIComponent).join("/")}`;

export interface NamedItem {
  name: string;
  description: string;
}

export interface TargetBook {
  id: string;
  name: string;
  section: string;
  number: number;
  language: string;
  setId?: string;
}

export interface SourceFileEntry {
  paths: string[];
  format: string;
  license: string;
  sourceUrl: string;
  member?: string;
  lines?: number;
  words?: number;
  provenance: {
    id: string;
    name: string;
    url: string;
  };
}

export interface SourceItem {
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
  files: SourceFileEntry[];
}

export type AuthorInfo = string | { name: string; organization?: string };

export function formatAuthor(a?: AuthorInfo): string {
  if (!a) return "";
  if (typeof a === "string") return a.trim();
  if (!a.name) return a.organization ?? "";
  return a.organization && a.organization !== a.name ? `${a.name} · ${a.organization}` : a.name;
}

export interface SpecFile {
  file: string;
  id: string;
  title: string;
  author?: AuthorInfo;
  summary: string;
  objective: {
    mission: string;
    scope: string[];
  };
  evidence: {
    allowlist_rule: string;
    metadata_fields: NamedItem[];
    unknowns: string;
    exclusion_rule: string;
  };
  corpus_layout: {
    root: string;
    structure: string;
    naming: {
      sets?: string;
      index?: string;
      single_file: string;
      multi_file: string;
    };
    formats: NamedItem[];
  };
  statistical_modeling: {
    mission_principle: string;
    rationale: string;
    uncertainty_guidance: string[];
    source_assessment?: NamedItem[];
    model_freedom: string;
  };
  output_requirements: NamedItem[];
  output_format: {
    standard: string;
    references: {
      critical_apparatus: string;
      certainty: string;
    };
    encoding: string[];
    directory_layout: string;
    contents: string[];
  };
  targets: TargetBook[];
  sourceRefs: string[] | Record<string, string[]>;
  sources: SourceItem[];
}

interface SourceSetJson {
  id: string;
  kind: "book" | "institution";
  key: string;
  name: string;
  section?: string;
  number?: number;
  language?: string;
  sha256: string;
  sources: Record<string, string[]>;
}

interface InstitutionIndexJson {
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

const ULID_RE = /^[0-9A-HJKMNP-TV-Z]{26}$/;

function resolveSpecSources(
  sourceRefs: string[] | Record<string, string[]>,
  explicitTargets?: TargetBook[]
): { targets: TargetBook[]; sources: SourceItem[] } {
  const allowedByInst = new Map<string, Set<string>>();
  const bookSets: SourceSetJson[] = [];
  const bookSetIds = new Map<string, string>();

  const addRef = (instId: string, itemId: string) => {
    let set = allowedByInst.get(instId);
    if (!set) {
      set = new Set();
      allowedByInst.set(instId, set);
    }
    set.add(itemId);
  };

  if (Array.isArray(sourceRefs)) {
    for (const ref of sourceRefs) {
      if (ULID_RE.test(ref)) {
        const setPath = `${ROOT}src/sets/${ref}.json`;
        if (!existsSync(setPath)) throw new Error(`Missing source set: src/sets/${ref}.json`);
        const setObj = JSON.parse(readFileSync(setPath, "utf8")) as SourceSetJson;
        if (setObj.kind === "book") {
          bookSets.push(setObj);
          bookSetIds.set(setObj.key, setObj.id);
        }
        for (const [instId, ids] of Object.entries(setObj.sources)) {
          for (const id of ids) addRef(instId, id);
        }
      } else if (ref.includes(":")) {
        const [instId, itemId] = ref.split(":", 2);
        addRef(instId, itemId);
      }
    }
  } else {
    for (const [instId, ids] of Object.entries(sourceRefs)) {
      for (const id of ids) addRef(instId, id);
    }
  }

  const targets: TargetBook[] = explicitTargets?.length
    ? explicitTargets
    : bookSets.map((s) => ({
        id: s.key,
        name: s.name,
        section: s.section ?? "Old Testament",
        number: s.number ?? 0,
        language: s.language ?? "Hebrew",
        setId: s.id,
      }));

  const targetOrder = new Map(targets.map((t, i) => [t.id, i]));
  const merged = new Map<string, SourceItem>();

  for (const [instId, idSet] of [...allowedByInst.entries()].sort()) {
    const idxPath = `${ROOT}src/${instId}/index.json`;
    if (!existsSync(idxPath)) {
      throw new Error(`Missing institutional catalog: src/${instId}/index.json`);
    }
    const idx = JSON.parse(readFileSync(idxPath, "utf8")) as InstitutionIndexJson;
    const byId = new Map(idx.items.map((item) => [item.id, item]));

    for (const id of [...idSet].sort()) {
      const item = byId.get(id);
      if (!item) throw new Error(`Source "${id}" not found in src/${instId}/index.json`);
      const fileEntry: SourceFileEntry = {
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
        const set = new Set([...(existing.targets ?? []), ...(item.targets ?? [])]);
        existing.targets = [...set].sort(
          (a, b) => (targetOrder.get(a) ?? 999) - (targetOrder.get(b) ?? 999)
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

  return {
    targets,
    sources: [...merged.values()].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)),
  };
}

let _specs: SpecFile[] | undefined;
export function getSpecifications(): SpecFile[] {
  if (_specs) return _specs;
  const specDir = `${ROOT}specifications`;
  if (!existsSync(specDir)) {
    _specs = [];
    return _specs;
  }
  const files = readdirSync(specDir)
    .filter((f) => f.endsWith(".yaml") || f.endsWith(".yml"))
    .sort();

  _specs = files.map((name) => {
    const file = `specifications/${name}`;
    const raw = parse(readFileSync(`${ROOT}${file}`, "utf8")) as Omit<
      SpecFile,
      "file" | "sources" | "sourceRefs" | "targets"
    > & { targets?: TargetBook[]; sources: string[] | Record<string, string[]> };
    const { targets, sources } = resolveSpecSources(raw.sources, raw.targets);
    return { ...raw, file, targets, sourceRefs: raw.sources, sources };
  });
  return _specs;
}

export function getPrimarySpec(): SpecFile {
  const specs = getSpecifications();
  if (!specs.length) throw new Error("No specification YAML files found in specifications/");
  return specs[0];
}

export const formatNum = (n: number) => n.toLocaleString("en-US");
export const formatEra = (y: number) => (y < 0 ? `${-y} BC` : `AD ${y}`);
export const shortUlid = (id: string) => (id.length > 6 ? id.slice(-6) : id);

const CROCKFORD = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";

/** Decode the 48-bit millisecond timestamp embedded in the first 10 chars of a ULID. */
export function ulidTimestamp(id: string): number | null {
  if (!ULID_RE.test(id)) return null;
  let ms = 0;
  for (let i = 0; i < 10; i++) {
    const v = CROCKFORD.indexOf(id[i]);
    if (v < 0) return null;
    ms = ms * 32 + v;
  }
  return ms;
}

export function formatUlidDate(id: string): string {
  const ms = ulidTimestamp(id);
  if (ms === null) return "";
  return new Date(ms).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

/** Escapes HTML, formats `code`, and makes mentions of `targets` / `sources` clickable links to their expandable sections. */
export function formatSpecText(s: string, linkEmbeds = false): string {
  const escaped = s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
  return escaped.replace(/`([^`]+)`/g, (_, token: string) => {
    if (linkEmbeds && token === "targets") {
      return '<a href="#embedded-targets" class="inline-ref" data-open-target="embedded-targets"><code>targets</code></a>';
    }
    if (linkEmbeds && token === "sources") {
      return '<a href="#embedded-sources" class="inline-ref" data-open-target="embedded-sources"><code>sources</code></a>';
    }
    return `<code>${token}</code>`;
  });
}

export function displayLanguage(lang: string): string {
  if (lang === "Greek") return "Koine Greek";
  if (lang === "Hebrew") return "Biblical Hebrew";
  if (lang === "Hebrew and Aramaic") return "Biblical Hebrew & Aramaic";
  return lang;
}

export function formatDateRange(s: SourceItem): { short: string; detail: string } {
  if (s.yearFrom !== undefined && s.yearTo !== undefined) {
    const mid = Math.round((s.yearFrom + s.yearTo) / 2);
    const margin = Math.round((s.yearTo - s.yearFrom) / 2);
    const range =
      s.yearFrom === s.yearTo
        ? formatEra(s.yearFrom)
        : `${formatEra(s.yearFrom)}–${formatEra(s.yearTo)}`;
    return {
      short: `${formatEra(mid)}${margin ? ` ± ${margin}` : ""}`,
      detail: s.dateBasis ? `${range} · ${s.dateBasis}` : range,
    };
  }
  return {
    short: "Unknown",
    detail: s.dateBasis ?? "No date range recorded",
  };
}

export interface ProvenanceSummary {
  id: string;
  name: string;
  url: string;
  sourceCount: number;
  fileCount: number;
  words: number;
}

export function getCorpusStats(spec: SpecFile = getPrimarySpec()) {
  const types: Record<string, number> = {
    continuous: 0,
    scroll: 0,
    lectionary: 0,
    catena: 0,
  };
  const languages: Record<string, number> = {};
  const targetSourceCounts: Record<string, number> = Object.fromEntries(
    spec.targets.map((t) => [t.id, 0])
  );
  const provMap = new Map<
    string,
    { id: string; name: string; url: string; srcs: Set<string>; files: number; words: number }
  >();

  let totalFileEntries = 0;
  let totalXmlFiles = 0;
  let totalLines = 0;
  let totalWords = 0;

  for (const s of spec.sources) {
    types[s.type] = (types[s.type] ?? 0) + 1;
    languages[s.language] = (languages[s.language] ?? 0) + 1;
    for (const t of s.targets ?? []) {
      targetSourceCounts[t] = (targetSourceCounts[t] ?? 0) + 1;
    }

    for (const f of s.files) {
      totalFileEntries++;
      totalXmlFiles += f.paths.length;
      const l = f.lines ?? 0;
      const w = f.words ?? 0;
      totalLines += l;
      totalWords += w;

      const p = f.provenance;
      const cur = provMap.get(p.id) ?? {
        id: p.id,
        name: p.name,
        url: p.url,
        srcs: new Set<string>(),
        files: 0,
        words: 0,
      };
      cur.srcs.add(s.id);
      cur.files += f.paths.length;
      cur.words += w;
      provMap.set(p.id, cur);
    }
  }

  const provenances: ProvenanceSummary[] = [...provMap.values()]
    .map((p) => ({
      id: p.id,
      name: p.name,
      url: p.url,
      sourceCount: p.srcs.size,
      fileCount: p.files,
      words: p.words,
    }))
    .sort((a, b) => b.sourceCount - a.sourceCount);

  const otTargets = spec.targets.filter((t) => t.section === "Old Testament");
  const ntTargets = spec.targets.filter((t) => t.section === "New Testament");
  const aramaicTargets = spec.targets.filter((t) => t.language.includes("Aramaic"));

  return {
    targetCount: spec.targets.length,
    otCount: otTargets.length,
    ntCount: ntTargets.length,
    aramaicTargetCount: aramaicTargets.length,
    aramaicTargetNames: aramaicTargets.map((t) => t.name),
    sourceCount: spec.sources.length,
    provenanceCount: provenances.length,
    totalFileEntries,
    totalXmlFiles,
    totalLines,
    totalWords,
    types,
    languages,
    provenances,
    targetSourceCounts,
  };
}

/** Compact client-side index for interactive expandable source explorers. */
export function buildClientSourceIndex(spec: SpecFile) {
  return spec.sources.map((s) => {
    const d = formatDateRange(s);
    return {
      id: s.id,
      name: s.name ?? "",
      sh: s.shelfmark ?? "",
      ty: s.type,
      lg: s.language,
      ld: displayLanguage(s.language),
      ds: d.short,
      dd: d.detail + (s.dateSource ? ` · ${s.dateSource}` : ""),
      vw: s.viewers ?? [],
      tg: s.targets ?? [],
      fl: s.files.map((f) => ({
        ps: f.paths,
        fmt: f.format,
        lic: f.license,
        url: f.sourceUrl,
        ln: f.lines ?? 0,
        wd: f.words ?? 0,
        pid: f.provenance.id,
        pn: f.provenance.name,
        pu: f.provenance.url,
      })),
    };
  });
}

// ---------- Compiled Outputs (outputs/<spec-id>/<compilation-id>/) ----------

export interface CompiledBookEntry {
  id: string;
  name: string;
  section?: string;
  number?: number;
  language?: string;
  attributes?: Record<string, string | string[]>;
  file: string;
  format: string;
  sha256: string;
  bytes: number;
  stats: {
    manuscripts: number;
    early: number;
    lines: number;
    uncoveredLines: number;
    words: number;
    places: number;
    meanPlaceConfidence: number;
    meanWordConfidence: number;
    meanManuscriptsPerLine: number;
  };
}

/** Normalize a book's open-ended attributes (merging explicit `attributes` with any top-level `section`/`language`). */
export function getBookAttributes(book: CompiledBookEntry): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  const add = (k: string, v: string | string[] | undefined) => {
    if (!v) return;
    const vals = (Array.isArray(v) ? v : [v]).map((x) => String(x).trim()).filter(Boolean);
    if (!vals.length) return;
    const cur = out[k] ?? [];
    for (const val of vals) if (!cur.includes(val)) cur.push(val);
    out[k] = cur;
  };
  if (book.section) add("section", book.section);
  if (book.language) add("language", book.language);
  if (book.attributes) {
    for (const [k, v] of Object.entries(book.attributes)) add(k, v);
  }
  return out;
}

export interface CompilationManifest {
  specification: {
    id: string;
    file: string;
    sha256: string;
    statement: string;
  };
  compilation: {
    id: string;
    title?: string;
    subtitle?: string;
    summary?: string;
    author?: AuthorInfo;
    createdAt: string;
    outputDirectory: string;
    outputFormat: string;
  };
  modelAttribution: {
    provider: string;
    modelFamily?: string;
    modelName: string;
    modelId: string;
    effortLevel?: string;
    harness?: string;
    role?: string;
    deterministicEngine?: {
      program: string;
      runtime: string;
      repository?: string;
      commit?: string;
      codeSha256?: string;
    };
  };
  method: {
    summary: string;
    description: string;
    steps?: { title: string; body: string }[];
    scenarios?: { scenario: string; treatment: string }[];
    differenceCategories?: { label: string; meaning: string }[];
    unknownsAndLimitations?: string[];
  };
  totals: {
    books: number;
    lines: number;
    words: number;
    variantPlaces: number;
    totalBytes: number;
  };
  books: CompiledBookEntry[];
}

export interface DisagreementCategory {
  id: string;
  label: string;
  description: string;
  count: number;
}

export interface DisagreementScale {
  min: number;
  max: number;
  description?: string;
}

export interface DisagreementSubcategory {
  id: string;
  label: string;
  category_id?: string;
  level: number;
  level_label?: string;
  short_label?: string;
  description: string;
  local_confidence_effect?: string;
  corpus_authenticity_effect?: string;
  confidence_effect?: string;
  count?: number;
  variant_readings_count?: number;
  app_places_count?: number;
}

export interface CompilationReport {
  file: string;
  frontmatter: {
    specification_id?: string;
    compilation_id?: string;
    created_at?: string;
    model_attribution?: Record<string, string>;
    method_summary?: string;
    disagreement_scale?: DisagreementScale;
    disagreement_categories?: DisagreementCategory[];
    disagreement_subcategories?: DisagreementSubcategory[];
    disagreement_severities?: DisagreementSubcategory[];
    authenticity_signal?: string;
    evidence_usage?: Record<string, string>;
    totals?: Record<string, number>;
  };
  body: string;
}

/** Normalize any model-defined numeric severity level onto a 1..5 visual styling bucket. */
export function normalizeSeverityBucket(level: number, scale?: DisagreementScale): 1 | 2 | 3 | 4 | 5 {
  const min = scale?.min ?? 1;
  const max = scale?.max ?? 5;
  if (max <= min) return 3;
  const ratio = Math.max(0, Math.min(1, (level - min) / (max - min)));
  return Math.max(1, Math.min(5, Math.round(1 + ratio * 4))) as 1 | 2 | 3 | 4 | 5;
}

export interface CompilationRecord {
  specId: string;
  compilationId: string;
  dir: string;
  relDir: string;
  manifest: CompilationManifest;
  report?: CompilationReport;
}

function parseReportMd(reportPath: string): CompilationReport | undefined {
  if (!existsSync(reportPath)) return undefined;
  const raw = readFileSync(reportPath, "utf8");
  const m = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/);
  if (!m) return { file: "REPORT.md", frontmatter: {}, body: raw.trim() };
  try {
    const frontmatter = (parse(m[1]) ?? {}) as CompilationReport["frontmatter"];
    return { file: "REPORT.md", frontmatter, body: m[2].trim() };
  } catch {
    return { file: "REPORT.md", frontmatter: {}, body: m[2].trim() };
  }
}

export function getWitnessViewersMap(specId: string): Map<string, { viewers: { name: string; url: string }[]; shelfmark?: string; name?: string }> {
  const spec = getSpecifications().find((s) => s.id === specId) ?? getPrimarySpec();
  const map = new Map<string, { viewers: { name: string; url: string }[]; shelfmark?: string; name?: string }>();
  for (const s of spec.sources) {
    map.set(s.id, { viewers: s.viewers ?? [], shelfmark: s.shelfmark, name: s.name });
  }
  return map;
}

let _compilations: CompilationRecord[] | undefined;
export function getCompilations(): CompilationRecord[] {
  if (_compilations) return _compilations;
  const outRoot = `${ROOT}outputs`;
  if (!existsSync(outRoot)) {
    _compilations = [];
    return _compilations;
  }
  const records: CompilationRecord[] = [];
  for (const specId of readdirSync(outRoot).sort()) {
    const specDir = `${outRoot}/${specId}`;
    let compIds: string[];
    try {
      compIds = readdirSync(specDir).sort();
    } catch {
      continue;
    }
    for (const compilationId of compIds) {
      const dir = `${specDir}/${compilationId}`;
      const mfPath = `${dir}/manifest.json`;
      if (!existsSync(mfPath)) continue;
      try {
        const manifest = JSON.parse(readFileSync(mfPath, "utf8")) as CompilationManifest;
        const report = parseReportMd(`${dir}/REPORT.md`);
        records.push({
          specId,
          compilationId,
          dir,
          relDir: `outputs/${specId}/${compilationId}`,
          manifest,
          report,
        });
      } catch {
        continue;
      }
    }
  }
  // Newest first by createdAt, then compilationId descending
  records.sort(
    (a, b) =>
      (b.manifest.compilation?.createdAt ?? "").localeCompare(a.manifest.compilation?.createdAt ?? "") ||
      b.compilationId.localeCompare(a.compilationId),
  );
  _compilations = records;
  return _compilations;
}

export function getCompilationsForSpec(specId: string): CompilationRecord[] {
  return getCompilations().filter((c) => c.specId === specId);
}

export function formatBytes(bytes: number): string {
  if (bytes >= 1_000_000) return `${(bytes / 1_000_000).toFixed(1)} MB`;
  if (bytes >= 1_000) return `${(bytes / 1_000).toFixed(0)} KB`;
  return `${bytes} B`;
}

export function formatPct(p: number): string {
  if (p >= 0.9995) return ">99.9%";
  if (p <= 0.0005) return "<0.1%";
  return `${(p * 100).toFixed(1)}%`;
}

export interface ParsedWitness {
  id: string;
  siglum: string;
  desc: string;
  dating: string;
  provenance: string;
  scientific: string;
  scribal: string;
  agreement: string;
  files: string;
}

export interface ParsedAppReading {
  type: string;
  text: string;
  witCount: number;
  wits: string[];
  degree: string;
  uncertainty: string;
  difference: string;
  severityLevel?: number;
  severitySubtype?: string;
  severityNote?: string;
}

export interface ParsedVerseToken {
  kind: "w" | "app";
  id?: string;
  text: string;
  aramaic?: boolean;
  appId?: string;
  readings?: ParsedAppReading[];
  lacunaCount?: number;
  lacunaWits?: string[];
  // For unanimous <w> tokens parsed from <spanGrp type="word-coverage">
  attestedWits?: string[];
  degree?: string;
  uncertainty?: string;
}

export interface ParsedVerse {
  ref: string;
  verseNum: string;
  uncovered?: boolean;
  tokens: ParsedVerseToken[];
}

export interface ParsedChapter {
  chapter: string;
  verses: ParsedVerse[];
}

const unentXml = (s: string) =>
  s
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");

/** Fast, lightweight parser for our TEI P5 compiled book XML files at site build time. */
export function parseCompiledBookTei(xmlPath: string): { witnesses: ParsedWitness[]; chapters: ParsedChapter[] } {
  const xml = readFileSync(xmlPath, "utf8");

  // 1. Parse <witness> records from <listWit>
  const witnesses: ParsedWitness[] = [];
  const listWitMatch = xml.match(/<listWit>([\s\S]*?)<\/listWit>/);
  if (listWitMatch) {
    const witRe = /<witness xml:id="([^"]+)">([\s\S]*?)<\/witness>/g;
    let wm: RegExpExecArray | null;
    while ((wm = witRe.exec(listWitMatch[1]))) {
      const inner = wm[2];
      const tag = (re: RegExp) => {
        const m = inner.match(re);
        return m ? unentXml(m[1]) : "";
      };
      witnesses.push({
        id: wm[1],
        siglum: tag(/<abbr type="siglum">([\s\S]*?)<\/abbr>/),
        desc: tag(/<desc>([\s\S]*?)<\/desc>/),
        dating: tag(/<note type="dating">([\s\S]*?)<\/note>/),
        provenance: tag(/<note type="provenance">([\s\S]*?)<\/note>/),
        scientific: tag(/<note type="scientific-analysis">([\s\S]*?)<\/note>/),
        scribal: tag(/<note type="physical-scribal">([\s\S]*?)<\/note>/),
        agreement: tag(/<note type="textual-agreement">([\s\S]*?)<\/note>/),
        files: tag(/<note type="source-files">([\s\S]*?)<\/note>/),
      });
    }
  }

  // 2. Parse chapters and <ab n="ch:vs"> lines
  const chapters: ParsedChapter[] = [];
  const chapMap = new Map<string, ParsedChapter>();
  const bodyMatch = xml.match(/<div type="book"[^>]*>([\s\S]*?)<\/div>\s*<\/body>/);
  const body = bodyMatch ? bodyMatch[1] : xml;

  const abRe = /<ab n="([^"]+)"([^>]*)>([\s\S]*?)<\/ab>/g;
  let am: RegExpExecArray | null;
  while ((am = abRe.exec(body))) {
    const ref = am[1];
    const attrs = am[2];
    const rawInner = am[3];
    const [ch, vs] = ref.split(":");
    let chap = chapMap.get(ch);
    if (!chap) {
      chap = { chapter: ch, verses: [] };
      chapMap.set(ch, chap);
      chapters.push(chap);
    }
    if (attrs.includes('type="uncovered"')) {
      chap.verses.push({ ref, verseNum: vs ?? ref, uncovered: true, tokens: [] });
      continue;
    }

    // Parse <spanGrp type="word-coverage"> for unanimous word witness lists & certainty
    const wordCov = new Map<
      string,
      { attested: string[]; lacuna: string[]; degree: string; uncertainty: string }
    >();
    const spanGrpM = rawInner.match(/<spanGrp[^>]*>([\s\S]*?)<\/spanGrp>/);
    if (spanGrpM) {
      const spanRe = /<span target="([^"]+)">([\s\S]*?)<\/span>/g;
      let sm: RegExpExecArray | null;
      while ((sm = spanRe.exec(spanGrpM[1]))) {
        const targets = sm[1].split(/\s+/).map((x) => x.replace(/^#/, "")).filter(Boolean);
        const sBody = sm[2];
        const attM = sBody.match(/<note type="attested">([\s\S]*?)<\/note>/);
        const lacM = sBody.match(/<note type="lacuna">([\s\S]*?)<\/note>/);
        const degM = sBody.match(/degree="([^"]+)"/);
        const uncM = sBody.match(/<note type="uncertainty">([\s\S]*?)<\/note>/);
        const attested = attM
          ? attM[1].split(/\s+/).filter(Boolean).map((x) => x.replace(/^#wit-/, ""))
          : [];
        const lacuna = lacM
          ? lacM[1].split(/\s+/).filter(Boolean).map((x) => x.replace(/^#wit-/, ""))
          : [];
        const rec = {
          attested,
          lacuna,
          degree: degM ? degM[1] : "",
          uncertainty: uncM ? unentXml(uncM[1]) : "",
        };
        for (const tid of targets) wordCov.set(tid, rec);
      }
    }

    const inner = rawInner.replace(/<spanGrp[\s\S]*?<\/spanGrp>/g, "");
    const tokens: ParsedVerseToken[] = [];
    const tokRe = /<app xml:id="([^"]+)">([\s\S]*?)<\/app>|<w xml:id="([^"]+)"([^>]*)>([\s\S]*?)<\/w>/g;
    let tm: RegExpExecArray | null;
    while ((tm = tokRe.exec(inner))) {
      if (tm[1] !== undefined) {
        const appId = tm[1];
        const appInner = tm[2];
        const lemMatch = appInner.match(/<lem[^>]*>([\s\S]*?)<\/lem>/);
        const lemText = lemMatch
          ? [...lemMatch[1].matchAll(/<w[^>]*>([\s\S]*?)<\/w>/g)].map((m) => unentXml(m[1])).join(" ")
          : "";
        const isAr = lemMatch ? lemMatch[1].includes('xml:lang="arc"') : false;

        const readings: ParsedAppReading[] = [];
        let lacunaWits: string[] = [];
        const rdgRe = /<rdg\b([^>]*)>([\s\S]*?)<\/rdg>/g;
        let rm: RegExpExecArray | null;
        while ((rm = rdgRe.exec(appInner))) {
          const rAttrs = rm[1];
          const rBody = rm[2];
          const typeM = rAttrs.match(/type="([^"]+)"/);
          const rType = typeM ? typeM[1] : "variant";
          const witM = rAttrs.match(/wit="([^"]+)"/);
          const wits = witM ? witM[1].split(/\s+/).filter(Boolean).map((x) => x.replace(/^#wit-/, "")) : [];
          if (rType === "lacuna") {
            lacunaWits = wits;
            continue;
          }
          const degM = rBody.match(/degree="([^"]+)"/);
          const uncM = rBody.match(/<note type="uncertainty">([\s\S]*?)<\/note>/);
          const diffM = rBody.match(/<note type="difference">([\s\S]*?)<\/note>/);
          const sevM = rBody.match(/<note type="severity"([^>]*)>([\s\S]*?)<\/note>/);
          let severityLevel: number | undefined;
          let severitySubtype: string | undefined;
          let severityNote: string | undefined;
          if (sevM) {
            const nM = sevM[1].match(/\bn="(\d+)"/);
            const stM = sevM[1].match(/\bsubtype="([^"]+)"/);
            if (nM) severityLevel = Number(nM[1]);
            if (stM) severitySubtype = stM[1];
            severityNote = unentXml(sevM[2]);
          }
          const plain = unentXml(rBody.replace(/<[^>]+>[\s\S]*?<\/[^>]+>|<[^>]+>/g, "")).trim();
          readings.push({
            type: rType,
            text: plain || (rType === "unseen" ? "(unattested original)" : "— (omission)"),
            witCount: wits.length,
            wits,
            degree: degM ? degM[1] : "",
            uncertainty: uncM ? unentXml(uncM[1]) : "",
            difference: diffM ? unentXml(diffM[1]) : "",
            severityLevel,
            severitySubtype,
            severityNote,
          });
        }
        tokens.push({
          kind: "app",
          text: lemText,
          aramaic: isAr,
          appId,
          readings,
          lacunaCount: lacunaWits.length,
          lacunaWits,
        });
      } else {
        const wId = tm[3];
        const cov = wordCov.get(wId);
        tokens.push({
          kind: "w",
          id: wId,
          text: unentXml(tm[5]),
          aramaic: tm[4].includes('xml:lang="arc"'),
          attestedWits: cov?.attested ?? [],
          lacunaWits: cov?.lacuna ?? [],
          lacunaCount: cov?.lacuna.length ?? 0,
          degree: cov?.degree ?? "",
          uncertainty: cov?.uncertainty ?? "",
        });
      }
    }
    chap.verses.push({ ref, verseNum: vs ?? ref, tokens });
  }

  return { witnesses, chapters };
}
