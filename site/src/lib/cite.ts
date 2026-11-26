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

/** What Open Lexis changed when it converted a source that publishes no XML. Keyed by archive folder. */
const ADAPTED: Record<string, { changed: string; kept: string }> = {
  cntr: {
    changed: "The source publishes this transcription as plain text, not XML. Open Lexis™ placed that text in a TEI P5 file.",
    kept: "The text itself, which is the archive's plain text as published.",
  },
  aleppo: {
    changed:
      "The source publishes Text-Fabric data (tf/1.0), not XML. Open Lexis™ made a TEI P5 file for each book from that data. Lines on lost pages, which the edition fills in from related manuscripts, are marked as supplied and name that source. Words are the written words (ketiv), split at spaces and maqaf.",
    kept: "The words, as the data gives them.",
  },
  "dt-ucph-sp": {
    changed:
      "The source publishes Text-Fabric data (tf/7.5.0), not XML. Open Lexis™ made a TEI P5 file from the consonantal text of each word in that data, arranged by book, chapter and line.",
    kept: "The letters of each word, as the data gives them.",
  },
  "etcbc-dss": {
    changed:
      "The source publishes Text-Fabric data (tf/2.0.5), not XML. Open Lexis™ made a TEI P5 file from the Hebrew letters of each word in that data, arranged by book, chapter and line. A word with a letter that a modern editor reconstructed is left out and marked as a gap.",
    kept: "The letters of each word that is kept, as the data gives them.",
  },
  "tal-florentin-sp": {
    changed:
      "The source publishes JSON, not XML: the edition's Hebrew running text, which the CACCHT project extracted from the edition's PDF. Open Lexis™ made a TEI P5 file from it. Genesis 1:1 to 3:24, which the edition takes from other manuscripts, is marked as supplied and names the source. A few small gaps the edition filled without marking them cannot be marked.",
    kept: "The text, as the JSON gives it.",
  },
};

/** The "Adapted by Open Lexis" note for a converted source file, or null when the file is the source's own file, unchanged. */
export function adaptedNote(path: string, format: string): { changed: string; kept: string } | null {
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

/** One source's own credit, license and link. Grouped credits carry a count instead of a manuscript title. */
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

export function ourText(c: OurCredit, origin: string, accessed?: { long: string }): string {
  const ids = c.ids.map(([k, v], i) => `${i ? k.toLowerCase() : k} ${v}`).join(", ");
  return (
    `Open Lexis™. "${tm(c.title)}." ${ids}. ${tm(c.copyright)}. ${c.licenseName}, ${c.licenseUrl}. ${origin}${c.path}` +
    (accessed ? `. Accessed ${accessed.long}.` : ".")
  );
}

export function ourBibtex(c: OurCredit, origin: string, accessed?: { iso: string }): string {
  const lines = [
    `@misc{${c.key},`,
    `  author = {{Open Lexis}},`,
    `  title = {{${bib(c.title)}}},`,
    `  howpublished = {${bib(c.ids.map(([k, v], i) => `${i ? k.toLowerCase() : k} ${v}`).join(", "))}},`,
    yearOf(c.copyright) ? `  year = {${yearOf(c.copyright)}},` : "",
    `  url = {${origin}${c.path}},`,
    accessed ? `  urldate = {${accessed.iso}},` : "",
    `  note = {${bib(c.copyright)}. ${bib(c.licenseName)}, \\url{${c.licenseUrl}}}`,
    `}`,
  ];
  return lines.filter(Boolean).join("\n");
}

export function sourceText(s: SourceCredit): string {
  const parts = [`${s.project} (${s.projectUrl}).`];
  if (s.title) parts.push(`${s.title}.`);
  if (s.count) parts.push(`Transcriptions of ${s.count.toLocaleString("en-US")} ${s.count === 1 ? "manuscript" : "manuscripts"}.`);
  if (s.link && s.link !== s.projectUrl) parts.push(`Source: ${s.link}.`);
  parts.push(`License: ${s.license.name}, ${s.license.url}.`);
  if (s.license.where) parts.push(`Terms found in: ${s.license.where}.`);
  return parts.join(" ");
}

export function sourceBibtex(s: SourceCredit): string {
  const title = s.title ?? `Transcriptions of ${s.count ?? 0} ${s.count === 1 ? "manuscript" : "manuscripts"}`;
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
    const k = `${s.project}\u0000${s.projectUrl}\u0000${s.license.name}\u0000${s.license.url}\u0000${s.license.where}`;
    const cur = by.get(k);
    if (cur) cur.count = (cur.count ?? 0) + (s.count ?? 1);
    else by.set(k, { project: s.project, projectUrl: s.projectUrl, count: s.count ?? 1, license: s.license });
  }
  return [...by.values()].sort((a, b) => a.project.localeCompare(b.project) || a.license.name.localeCompare(b.license.name));
}

const escHtml = (s: unknown) =>
  String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

export interface CiteBoxData {
  heading: string;
  ours: OurCredit;
  sources: SourceCredit[];
  /** Heading for the source block. */
  sourcesHeading?: string;
}

/** Inner markup of a cite box (both formats; the browser script toggles which one shows and copies it). */
export function citeBodyHtml(d: CiteBoxData, origin: string, accessedAt?: Date): string {
  const acc = accessedAt ? formatAccessed(accessedAt) : undefined;
  const srcText = d.sources.map(sourceText).join("\n\n");
  const srcBib = d.sources.map(sourceBibtex).join("\n\n");
  const block = (label: string, text: string, bibtex: string) => `
    <div class="cite-block">
      <div class="cite-block-head"><span class="cite-label">${escHtml(label)}</span><button type="button" class="copy-btn" data-cite-copy>Copy</button></div>
      <pre class="cite-pre" data-fmt="text">${escHtml(text)}</pre>
      <pre class="cite-pre" data-fmt="bibtex" hidden>${escHtml(bibtex)}</pre>
    </div>`;
  return `
    <div class="cite-formats" role="group" aria-label="Citation format">
      <button type="button" class="cite-fmt active" data-cite-fmt="text" aria-pressed="true">Plain text</button>
      <button type="button" class="cite-fmt" data-cite-fmt="bibtex" aria-pressed="false">BibTeX</button>
    </div>
    ${block("How to credit Open Lexis™", ourText(d.ours, origin, acc), ourBibtex(d.ours, origin, acc))}
    ${
      d.sources.length
        ? block(d.sourcesHeading ?? "How to credit each source (its own credit, license and link)", srcText, srcBib)
        : ""
    }`;
}

/** A whole cite box, for pages that render it in the browser. */
export function citeBoxHtml(d: CiteBoxData, origin: string, accessedAt?: Date): string {
  return `<details class="cite-box"><summary>${escHtml(d.heading)}</summary><div class="cite-body">${citeBodyHtml(d, origin, accessedAt)}</div></details>`;
}
