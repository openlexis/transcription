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

export interface SpecFile {
  file: string;
  id: string;
  title: string;
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
  sources: SourceItem[];
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
    const parsed = parse(readFileSync(`${ROOT}${file}`, "utf8")) as Omit<SpecFile, "file">;
    return { file, ...parsed };
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
