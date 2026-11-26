// TEI downloads, written into the built site at build time (server side).
// Each file is a copy of the published book, with the page address, our license, and one credit per source
// project added to the header. The published files in transcripts/ are not changed.
//
// The copies are stored gzip-compressed because several books are larger than Cloudflare Pages' 25 MiB
// file limit (the largest are just over 50 MB). A _headers rule sets Content-Encoding: gzip so a browser
// receives ordinary XML at a .xml address.
import { gzipSync } from "node:zlib";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { CompilationRecord, CompiledBookEntry, SpecFile } from "./corpus";
import { bookUrl, getSpecifications, shortUlid } from "./corpus";
import { SITE_ORIGIN } from "./cite";
import { perManuscript, witnessFiles } from "./credits";

/** Cloudflare Pages serves files up to 25 MiB. */
const MAX_BYTES = 25 * 1024 * 1024;

const x = (s: unknown) =>
  String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** Witness sigla and source-files notes from a compiled book's header. */
function headerWitnesses(xml: string): { siglum: string; files: string }[] {
  const end = xml.indexOf("</listWit>");
  const head = end > 0 ? xml.slice(0, end) : "";
  const out: { siglum: string; files: string }[] = [];
  const re = /<witness xml:id="[^"]+">([\s\S]*?)<\/witness>/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(head))) {
    out.push({
      siglum: m[1].match(/<abbr type="siglum">([\s\S]*?)<\/abbr>/)?.[1] ?? "",
      files: m[1].match(/<note type="source-files">([\s\S]*?)<\/note>/)?.[1] ?? "",
    });
  }
  return out;
}

/** One bibl per source transcription used in this book, naming the institution, books, and manuscript. */
function sourceBibls(xml: string, spec: SpecFile | undefined): string {
  if (!spec) return "";
  const used = headerWitnesses(xml).flatMap((w) => witnessFiles(spec, w.siglum, w.files));
  return perManuscript(used)
    .map((c) => {
      const lic = c.license;
      const where = lic.where ? `\n              <p>Terms found in: ${x(lic.where)}.</p>` : "";
      return [
        `          <bibl>`,
        `            <title>${x(c.title)}</title>`,
        `            <ptr target="${x(c.link ?? c.projectUrl)}"/>`,
        `            <availability>`,
        `              <licence target="${x(lic.url)}">${x(lic.name)}</licence>${where}`,
        `            </availability>`,
        `          </bibl>`,
      ].join("\n");
    })
    .join("\n");
}

/** Add the page address and a compact list of source projects to the header of a published book. Our license is already there. */
function withCredits(xml: string, uri: string, bibls: string): string {
  const end = xml.indexOf("</teiHeader>");
  if (end < 0) throw new Error("compiled TEI has no teiHeader");
  let head = xml.slice(0, end);
  if (!head.includes('idno type="URI"')) {
    head = head.replace("</publicationStmt>", `        <idno type="URI">${x(uri)}</idno>\n      </publicationStmt>`);
  }
  if (bibls && !head.includes("<listBibl>")) {
    head = head.replace(
      "</sourceDesc>",
      `        <listBibl>\n          <head>Source transcriptions</head>\n${bibls}\n        </listBibl>\n      </sourceDesc>`,
    );
  }
  return head + xml.slice(end);
}

export interface Download {
  href: string;
  /** Uncompressed size of the TEI, which is what a browser saves. */
  bytes: number;
  name: string;
  label: string;
}

const written = new Map<string, Download | null>();

function writeDownload(rel: string, name: string, label: string, xml: string): Download | null {
  if (written.has(rel)) return written.get(rel)!;
  const raw = Buffer.from(xml, "utf8");
  const gz = gzipSync(raw, { level: 6 });
  let d: Download | null = null;
  if (gz.length <= MAX_BYTES) {
    mkdirSync(join(process.cwd(), "www", rel.split("/").slice(0, -1).join("/")), { recursive: true });
    writeFileSync(join(process.cwd(), "www", rel), gz);
    d = { href: `/${rel}`, bytes: raw.length, name, label };
  } else {
    console.warn(`[downloads] ${rel} is ${gz.length} bytes compressed, over the 25 MiB file limit; not published`);
  }
  written.set(rel, d);
  return d;
}

/** One book: a derived TEI copy with the page address, our license, and each source project's credit. */
export function bookDownload(c: CompilationRecord, b: CompiledBookEntry): Download | null {
  const short = shortUlid(c.compilationId);
  const name = `openlexis-${short}-${b.id}.xml`;
  const rel = `downloads/${short}/${name}`;
  if (written.has(rel)) return written.get(rel)!;
  const spec = getSpecifications().find((s) => s.id === c.specId);
  const published = readFileSync(`${c.dir}/${b.file}`, "utf8");
  const xml = withCredits(published, SITE_ORIGIN + bookUrl(c.compilationId, b.id), sourceBibls(published, spec));
  return writeDownload(rel, name, b.name, xml);
}

/** A download for each book of a transcription (there is no single-file download of every book). */
export function bookDownloads(c: CompilationRecord): Download[] {
  return c.manifest.books.map((b) => bookDownload(c, b)).filter((d): d is Download => !!d);
}
