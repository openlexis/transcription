// Citations and source licenses, shared by the server-rendered pages and the browser scripts (no Node imports here).

export const SITE_ORIGIN = "https://openlexis-transcription.pages.dev";

/** A source's license, read from the free-text license field in its archive catalog. */
export interface LicenseInfo {
  /** The license name, e.g. "CC BY 4.0". */
  name: string;
  /** The license deed, or the source's own page when no versioned deed fits. */
  url: string;
  /** Where the terms were found, as the catalog records it. */
  where: string;
}

const TANACH_LICENSE = "https://www.tanach.us/License.html";

export function parseLicense(raw: string, sourceUrl: string): LicenseInfo {
  const text = String(raw ?? "").trim();
  let m = text.match(/^CC (BY(?:-(?:NC|SA|ND))*) (\d\.\d)\s*(?:\(([\s\S]*)\))?$/);
  if (m) return { name: `CC ${m[1]} ${m[2]}`, url: `https://creativecommons.org/licenses/${m[1].toLowerCase()}/${m[2]}/`, where: m[3] ?? "" };
  // No version stated: link to the source, not to a versioned deed.
  m = text.match(/^CC (BY(?:-(?:NC|SA|ND))*)\s*(?:\(([\s\S]*)\))?$/);
  if (m) return { name: `CC ${m[1]}`, url: sourceUrl, where: m[2] ?? "" };
  m = text.match(/^the file's header states "([\s\S]*)"$/);
  if (m) return { name: m[1], url: sourceUrl, where: "the file's header" };
  m = text.match(/^Tanach\.us: "([\s\S]*)"$/);
  if (m) return { name: "Tanach.us License", url: TANACH_LICENSE, where: `Tanach.us, which states "${m[1]}"` };
  return { name: text, url: sourceUrl, where: "" };
}

/** The archive folder a repository path belongs to (archives/<archive>/<file>). */
export function archiveOf(path: string): string {
  const parts = path.split("/");
  return parts[0] === "archives" || parts[0] === "src" ? (parts[1] ?? "") : (parts[0] ?? "");
}

/** What the conversion actually did, for a source that publishes no XML. Keyed by archive folder. */
const ADAPTED: Record<string, string> = {
  cntr:
    "The source publishes this transcription as plain text. Open Lexis™ converted it to TEI XML (the standard text-encoding format used by the other transcriptions). The source text is kept as published, including the source's own marks. A TEI header was added, and the body of the file is that source text.",
  aleppo:
    "The source publishes this transcription as Text-Fabric data (tf/1.0), not XML. Open Lexis™ converted it to TEI XML (the standard text-encoding format used by the other transcriptions), one file per book, by adding tags that mark each book, chapter, line and word. The words are the written words (ketiv), split at spaces and maqaf (the hyphen that joins Hebrew words). Only lines on a surviving page of the codex are its own text; a page-break tag records the codex page. Lines the edition fills in for lost pages are marked as supplied, and that mark names the edition's stated source, or an old photograph when the text is known from one.",
  "dt-ucph-sp":
    "The source publishes this transcription as Text-Fabric data (tf/7.5.0), not XML. Open Lexis™ converted it to TEI XML (the standard text-encoding format used by the other transcriptions) by adding tags that mark each book, chapter, line and word. The words are the consonantal text from the data, split at spaces and maqaf (the hyphen that joins Hebrew words). The letters are unchanged.",
  "etcbc-dss":
    "The source publishes this transcription as Text-Fabric data (tf/2.0.5), not XML. Open Lexis™ converted it to TEI XML (the standard text-encoding format used by the other transcriptions) by adding tags that mark each book, chapter, line and word. The words are the Hebrew letters from the data. A word with a letter that a modern editor reconstructed is left out, and a gap is marked in its place. A prefix written as its own item in the data is joined to the next word. Where one line is held in separate pieces in the scroll, the pieces are joined and a gap is marked between them.",
  "tal-florentin-sp":
    "The source publishes this transcription as JSON, not XML: the edition's Hebrew running text, which the CACCHT project extracted from the edition's PDF. Open Lexis™ converted it to TEI XML (the standard text-encoding format used by the other transcriptions) by adding tags that mark each book, chapter, line and word. Genesis 1:1 to 3:24, which the edition takes from other manuscripts, is marked as supplied, and that mark names the source. The edition says it filled a few small gaps from Cambridge Add 714 and the Abisha scroll without marking them; those cannot be marked here. The words are as the JSON gives them.",
};

/** The Process note for a converted source file, or null when the file is the source's own file, unchanged. */
export function adaptedNote(path: string, format: string): string | null {
  if (!/^TEI P5 \(the source archive publishes no XML/.test(format)) return null;
  return ADAPTED[archiveOf(path)] ?? null;
}

/** How to credit Open Lexis for one page. */
export interface OurCredit {
  /** Short key for BibTeX, e.g. "openlexis-1GRFKQ-Obad". */
  key: string;
  title: string;
  /** Site path of the page, e.g. "/transcriptions/1GRFKQ/Obad/". */
  path: string;
  /** Identifiers, e.g. [["Transcription", "01M8..."], ["Specification", "01M8..."]]. */
  ids: [string, string][];
  copyright: string;
  licenseName: string;
  licenseUrl: string;
}

/** One source's own credit, license and link. title is the full citation (institution, books, manuscript). */
export interface SourceCredit {
  project: string;
  projectUrl: string;
  title?: string;
  link?: string;
  count?: number;
  license: LicenseInfo;
}

export const tm = (s: string) => s.replaceAll("Open Lexis™", "Open Lexis").replaceAll("Open Lexis", "Open Lexis™");
const plainName = (s: string) => s.replaceAll("Open Lexis™", "Open Lexis");
const bib = (s: string) => plainName(s).replace(/([&%#_$])/g, "\\$1");
const yearOf = (s: string) => s.match(/\b(\d{4})\b/)?.[1] ?? "";
const keyOf = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60) || "source";

export function formatAccessed(d: Date): { long: string; iso: string } {
  return {
    long: d.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" }),
    iso: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`,
  };
}

export function ourText(c: OurCredit, origin: string, accessed?: { long: string }, style: "full" | "short" = "full"): string {
  if (style === "short") {
    return `Open Lexis™. "${tm(c.title)}." ${origin}${c.path}` + (accessed ? `. Accessed ${accessed.long}.` : ".");
  }
  const ids = c.ids.map(([k, v], i) => `${i ? k.toLowerCase() : k} ${v}`).join(", ");
  return (
    `Open Lexis™. "${tm(c.title)}." ${ids}. ${tm(c.copyright)}. ${c.licenseName}, ${c.licenseUrl}. ${origin}${c.path}` +
    (accessed ? `. Accessed ${accessed.long}.` : ".")
  );
}

export function ourBibtex(c: OurCredit, origin: string, accessed?: { iso: string }, style: "full" | "short" = "full"): string {
  const lines = [
    `@misc{${c.key},`,
    `  author = {{Open Lexis}},`,
    `  title = {{${bib(c.title)}}},`,
    style === "full" ? `  howpublished = {${bib(c.ids.map(([k, v], i) => `${i ? k.toLowerCase() : k} ${v}`).join(", "))}},` : "",
    yearOf(c.copyright) ? `  year = {${yearOf(c.copyright)}},` : "",
    `  url = {${origin}${c.path}},`,
    accessed ? `  urldate = {${accessed.iso}},` : "",
    style === "full" ? `  note = {${bib(c.copyright)}. ${bib(c.licenseName)}, \\url{${c.licenseUrl}}}` : "",
    `}`,
  ];
  return lines.filter(Boolean).join("\n");
}


/** Book id and the English name used in citations, in biblical order. */
const BOOKS: [string, string][] = [
  ["Gen", "Genesis"], ["Exod", "Exodus"], ["Lev", "Leviticus"], ["Num", "Numbers"], ["Deut", "Deuteronomy"],
  ["Josh", "Joshua"], ["Judg", "Judges"], ["1Sam", "1 Samuel"], ["2Sam", "2 Samuel"], ["1Kgs", "1 Kings"], ["2Kgs", "2 Kings"],
  ["Isa", "Isaiah"], ["Jer", "Jeremiah"], ["Ezek", "Ezekiel"], ["Hos", "Hosea"], ["Joel", "Joel"], ["Amos", "Amos"],
  ["Obad", "Obadiah"], ["Jonah", "Jonah"], ["Mic", "Micah"], ["Nah", "Nahum"], ["Hab", "Habakkuk"], ["Zeph", "Zephaniah"],
  ["Hag", "Haggai"], ["Zech", "Zechariah"], ["Mal", "Malachi"], ["1Chr", "1 Chronicles"], ["2Chr", "2 Chronicles"],
  ["Ps", "Psalms"], ["Job", "Job"], ["Prov", "Proverbs"], ["Ruth", "Ruth"], ["Song", "Song of Songs"], ["Eccl", "Ecclesiastes"],
  ["Lam", "Lamentations"], ["Esth", "Esther"], ["Dan", "Daniel"], ["Ezra", "Ezra"], ["Neh", "Nehemiah"],
  ["Matt", "Matthew"], ["Mark", "Mark"], ["Luke", "Luke"], ["John", "John"], ["Acts", "Acts"], ["Rom", "Romans"],
  ["1Cor", "1 Corinthians"], ["2Cor", "2 Corinthians"], ["Gal", "Galatians"], ["Eph", "Ephesians"], ["Phil", "Philippians"],
  ["Col", "Colossians"], ["1Thess", "1 Thessalonians"], ["2Thess", "2 Thessalonians"], ["1Tim", "1 Timothy"], ["2Tim", "2 Timothy"],
  ["Titus", "Titus"], ["Phlm", "Philemon"], ["Heb", "Hebrews"], ["Jas", "James"], ["1Pet", "1 Peter"], ["2Pet", "2 Peter"],
  ["1John", "1 John"], ["2John", "2 John"], ["3John", "3 John"], ["Jude", "Jude"], ["Rev", "Revelation"],
];
const BOOK_NAME = new Map(BOOKS);
const BOOK_ORDER = new Map(BOOKS.map(([id], i) => [id, i]));
const NT = new Set(BOOKS.slice(BOOKS.findIndex(([id]) => id === "Matt")).map(([id]) => id));
const OT = new Set(BOOKS.slice(0, BOOKS.findIndex(([id]) => id === "Matt")).map(([id]) => id));
/** UXLC and Aleppo file names, and other file-part spellings, to a book id. */
const FILE_PART: Record<string, string> = {
  Genesis: "Gen", Exodus: "Exod", Leviticus: "Lev", Numbers: "Num", Deuteronomy: "Deut",
  Joshua: "Josh", Judges: "Judg", Samuel_1: "1Sam", Samuel_2: "2Sam", Kings_1: "1Kgs", Kings_2: "2Kgs",
  Isaiah: "Isa", Jeremiah: "Jer", Ezekiel: "Ezek", Hosea: "Hos", Joel: "Joel", Amos: "Amos",
  Obadiah: "Obad", Jonah: "Jonah", Micah: "Mic", Nahum: "Nah", Habakkuk: "Hab", Zephaniah: "Zeph",
  Haggai: "Hag", Zechariah: "Zech", Malachi: "Mal", Chronicles_1: "1Chr", Chronicles_2: "2Chr",
  Psalms: "Ps", Job: "Job", Proverbs: "Prov", Ruth: "Ruth", Song_of_Songs: "Song", Ecclesiastes: "Eccl",
  Lamentations: "Lam", Esther: "Esth", Daniel: "Dan", Ezra: "Ezra", Nehemiah: "Neh",
};
function bookFromPart(part: string): string | undefined {
  if (BOOK_NAME.has(part)) return part;
  if (FILE_PART[part]) return FILE_PART[part];
  const lower = part.toLowerCase();
  for (const [id, name] of BOOKS) if (name.toLowerCase() === lower) return id;
  return undefined;
}
function uniqueBooks(ids: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const id of ids) {
    if (!id || seen.has(id)) continue;
    seen.add(id);
    out.push(id);
  }
  return out.sort((a, b) => (BOOK_ORDER.get(a) ?? 999) - (BOOK_ORDER.get(b) ?? 999));
}
function andList(names: string[]): string {
  if (names.length === 1) return names[0];
  if (names.length === 2) return `${names[0]} and ${names[1]}`;
  return `${names.slice(0, -1).join(", ")}, and ${names[names.length - 1]}`;
}
function formatBooks(ids: string[]): string {
  if (!ids.length) return "";
  const set = new Set(ids);
  const same = (canon: Set<string>) => set.size === canon.size && [...set].every((id) => canon.has(id));
  if (same(NT)) return "the New Testament";
  if (same(OT)) return "the Old Testament";
  return andList(ids.map((id) => BOOK_NAME.get(id) ?? id));
}

/** If the project name ends with the book or work it transcribes, return the institution and those books. */
export function projectOrgAndBooks(project: string): { org: string; books: string[] } {
  if (/Family Π in Mark\s*$/.test(project)) {
    return { org: project.replace(/,?\s*Family Π in Mark\s*$/, "").trim(), books: ["Mark"] };
  }
  if (/catenae on Romans and Ephesians\s*$/.test(project)) {
    return { org: project.replace(/,?\s*catenae on Romans and Ephesians\s*$/, "").trim(), books: ["Rom", "Eph"] };
  }
  const named = [...BOOKS].sort((a, b) => b[1].length - a[1].length);
  for (const [id, name] of named) {
    const suffix = `, ${name}`;
    if (project.endsWith(suffix)) return { org: project.slice(0, -suffix.length).trim(), books: [id] };
  }
  return { org: project, books: [] };
}

/** Books a source transcription covers, from its file names, or the project's stated book, or the catalog's targets. */
export function booksCovered(paths: string[], project: string, fallbackTargets?: string[]): string[] {
  const fromPath: string[] = [];
  for (const p of paths) {
    const file = p.split("/").pop() ?? "";
    const m = file.match(/^[^.]+[.](.+)\.xml$/i);
    const id = m ? bookFromPart(m[1]) : undefined;
    if (id) fromPath.push(id);
  }
  if (fromPath.length) return uniqueBooks(fromPath);
  const named = projectOrgAndBooks(project).books;
  if (named.length) return uniqueBooks(named);
  return uniqueBooks(fallbackTargets ?? []);
}

/** "GA 01 (Codex Sinaiticus)", or "L (Leningrad Codex)" when the id is not a Gregory-Aland number. Never a bare "01". */
export function manuscriptRef(id: string, name: string | undefined, language: string): string {
  const num = /^Greek$/i.test(language) ? `GA ${id}` : id;
  const label = name && name !== id ? name : "";
  return label ? `${num} (${label})` : num;
}

/** "ITSEE transcription of 2 Thessalonians in GA 01 (Codex Sinaiticus)". */
export function sourceTitle(input: {
  project: string;
  paths: string[];
  id: string;
  name?: string;
  language: string;
  targets?: string[];
}): string {
  const org = projectOrgAndBooks(input.project).org;
  const books = formatBooks(booksCovered(input.paths, input.project, input.targets));
  const ms = manuscriptRef(input.id, input.name, input.language);
  return books ? `${org} transcription of ${books} in ${ms}` : `${org} transcription in ${ms}`;
}

export function sourceText(s: SourceCredit): string {
  const lead = s.title || s.project;
  const parts = [`${lead}.`];
  if (s.link && s.link !== s.projectUrl) parts.push(`Source: ${s.link}.`);
  else if (s.projectUrl) parts.push(`Source: ${s.projectUrl}.`);
  parts.push(`License: ${s.license.name}, ${s.license.url}.`);
  if (s.license.where) parts.push(`Terms found in: ${s.license.where}.`);
  return parts.join(" ");
}

export function sourceBibtex(s: SourceCredit): string {
  const title = s.title ?? s.project;
  const note = `License: ${bib(s.license.name)}, \\url{${s.license.url}}${s.license.where ? `. Terms found in: ${bib(s.license.where)}` : ""}`;
  return [
    `@misc{${keyOf(`${s.project} ${s.title ?? s.license.name}`)},`,
    `  author = {{${bib(s.project)}}},`,
    `  title = {{${bib(title)}}},`,
    `  url = {${s.link ?? s.projectUrl}},`,
    `  note = {${note}}`,
    `}`,
  ].join("\n");
}

/** Merge source credits that share a project and license into one line with a count of manuscripts (pass one credit per manuscript). */
export function groupCredits(items: SourceCredit[]): SourceCredit[] {
  const by = new Map<string, SourceCredit>();
  for (const s of items) {
    const k = `${s.title ?? ""}\u0000${s.project}\u0000${s.projectUrl}\u0000${s.license.name}\u0000${s.license.url}\u0000${s.license.where}`;
    const cur = by.get(k);
    if (cur) cur.count = (cur.count ?? 0) + (s.count ?? 1);
    else by.set(k, { ...s, count: s.count ?? 1 });
  }
  return [...by.values()].sort((a, b) => (a.title ?? a.project).localeCompare(b.title ?? b.project) || a.project.localeCompare(b.project));
}

const escHtml = (s: unknown) =>
  String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

export interface CiteBoxData {
  heading: string;
  ours: OurCredit;
  sources: SourceCredit[];
  /** Heading for the source block. */
  sourcesHeading?: string;
  /** "short" is title, URL, and accessed date only, for an archive record. */
  oursStyle?: "full" | "short";
}

/** Inner markup of a cite box (both formats; the browser script toggles which one shows and copies it). */
export function citeBodyHtml(d: CiteBoxData, origin: string, accessedAt?: Date): string {
  const acc = accessedAt ? formatAccessed(accessedAt) : undefined;
  const style = d.oursStyle ?? "full";
  const block = (label: string, text: string, bibtex: string) => `
    <div class="cite-block">
      <div class="cite-block-head"><span class="cite-label">${escHtml(label)}</span><button type="button" class="copy-btn" data-cite-copy>Copy</button></div>
      <pre class="cite-pre" data-fmt="text">${escHtml(text)}</pre>
      <pre class="cite-pre" data-fmt="bibtex" hidden>${escHtml(bibtex)}</pre>
    </div>`;
  const oursLabel = style === "short" ? "Citation" : "How to credit Open Lexis™";
  return `
    <div class="cite-formats" role="group" aria-label="Citation format">
      <button type="button" class="cite-fmt active" data-cite-fmt="text" aria-pressed="true">Plain text</button>
      <button type="button" class="cite-fmt" data-cite-fmt="bibtex" aria-pressed="false">BibTeX</button>
    </div>
    ${block(oursLabel, ourText(d.ours, origin, acc, style), ourBibtex(d.ours, origin, acc, style))}`;
}

/** A whole cite box, for pages that render it in the browser. */
export function citeBoxHtml(d: CiteBoxData, origin: string, accessedAt?: Date): string {
  return `<details class="cite-box"><summary>${escHtml(d.heading)}</summary><div class="cite-body">${citeBodyHtml(d, origin, accessedAt)}</div></details>`;
}
