// TEI downloads, written into the built site at build time (server side).
// Each zip holds the published book file unchanged, plus <Book>.sources.xml: a small TEI file whose header gives the
// Open Lexis license and each source transcription's credit, license and link.
import { deflateRawSync } from "node:zlib";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { CompilationRecord, CompiledBookEntry, SpecFile } from "./corpus";
import { bookUrl, getSpecifications, shortUlid } from "./corpus";
import { SITE_ORIGIN, parseLicense } from "./cite";
import { witnessFiles, type UsedFile } from "./credits";

/** Cloudflare Pages serves files up to 25 MiB. */
const MAX_BYTES = 25 * 1024 * 1024;

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();
function crc32(buf: Buffer): number {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

interface ZipEntry {
  name: string;
  data: Buffer;
  crc: number;
  size: number;
}
const entryOf = (name: string, raw: Buffer): ZipEntry => ({ name, data: deflateRawSync(raw, { level: 6 }), crc: crc32(raw), size: raw.length });

function zip(entries: ZipEntry[], when: Date): Buffer {
  const dosTime = (when.getUTCHours() << 11) | (when.getUTCMinutes() << 5) | Math.floor(when.getUTCSeconds() / 2);
  const dosDate = ((when.getUTCFullYear() - 1980) << 9) | ((when.getUTCMonth() + 1) << 5) | when.getUTCDate();
  const locals: Buffer[] = [];
  const centrals: Buffer[] = [];
  let offset = 0;
  for (const e of entries) {
    const name = Buffer.from(e.name, "utf8");
    const lh = Buffer.alloc(30);
    lh.writeUInt32LE(0x04034b50, 0);
    lh.writeUInt16LE(20, 4);
    lh.writeUInt16LE(0x0800, 6); // UTF-8 names
    lh.writeUInt16LE(8, 8); // deflate
    lh.writeUInt16LE(dosTime, 10);
    lh.writeUInt16LE(dosDate, 12);
    lh.writeUInt32LE(e.crc, 14);
    lh.writeUInt32LE(e.data.length, 18);
    lh.writeUInt32LE(e.size, 22);
    lh.writeUInt16LE(name.length, 26);
    lh.writeUInt16LE(0, 28);
    const ch = Buffer.alloc(46);
    ch.writeUInt32LE(0x02014b50, 0);
    ch.writeUInt16LE(20, 4);
    ch.writeUInt16LE(20, 6);
    ch.writeUInt16LE(0x0800, 8);
    ch.writeUInt16LE(8, 10);
    ch.writeUInt16LE(dosTime, 12);
    ch.writeUInt16LE(dosDate, 14);
    ch.writeUInt32LE(e.crc, 16);
    ch.writeUInt32LE(e.data.length, 20);
    ch.writeUInt32LE(e.size, 24);
    ch.writeUInt16LE(name.length, 28);
    ch.writeUInt32LE(offset, 42);
    locals.push(lh, name, e.data);
    centrals.push(ch, name);
    offset += lh.length + name.length + e.data.length;
  }
  const central = Buffer.concat(centrals);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(entries.length, 8);
  end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(central.length, 12);
  end.writeUInt32LE(offset, 16);
  return Buffer.concat([...locals, central, end]);
}

const x = (s: unknown) =>
  String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const plain = (s: string) => s.replaceAll("Open Lexis™", "Open Lexis");

/** Witness sigla, xml:ids and source-files notes from a compiled book's header. */
function headerWitnesses(xml: string): { id: string; siglum: string; files: string }[] {
  const end = xml.indexOf("</listWit>");
  const head = end > 0 ? xml.slice(0, end) : "";
  const out: { id: string; siglum: string; files: string }[] = [];
  const re = /<witness xml:id="([^"]+)">([\s\S]*?)<\/witness>/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(head))) {
    out.push({
      id: m[1],
      siglum: m[2].match(/<abbr type="siglum">([\s\S]*?)<\/abbr>/)?.[1] ?? "",
      files: m[2].match(/<note type="source-files">([\s\S]*?)<\/note>/)?.[1] ?? "",
    });
  }
  return out;
}

/** The sources file: a TEI document whose header gives our license and each source's credit, license and link. */
function sourcesTei(c: CompilationRecord, b: CompiledBookEntry, spec: SpecFile | undefined, xml: string): string {
  const wits = headerWitnesses(xml);
  const bibls: string[] = [];
  for (const w of wits) {
    const used: UsedFile[] = spec ? witnessFiles(spec, w.siglum, w.files) : [];
    for (const u of used) {
      const lic = parseLicense(u.file.license, u.file.sourceUrl);
      const name = u.item.name && u.item.name !== u.item.id ? u.item.name : u.item.id;
      bibls.push(
        [
          `          <bibl corresp="${x(b.file)}#${x(w.id)}">`,
          `            <title>${x(name)}</title>`,
          `            <idno type="siglum">${x(u.item.id)}</idno>`,
          `            <publisher>${x(u.file.provenance.name)}</publisher>`,
          `            <ptr type="project" target="${x(u.file.provenance.url)}"/>`,
          `            <ptr type="source" target="${x(u.file.sourceUrl)}"/>`,
          `            <ptr type="copy" target="https://github.com/openlexis/transcription/blob/main/${u.path.split("/").map(encodeURIComponent).join("/")}"/>`,
          `            <availability>`,
          `              <licence target="${x(lic.url)}">${x(lic.name)}</licence>`,
          lic.where ? `              <p>Terms found in: ${x(lic.where)}.</p>` : "",
          `            </availability>`,
          `          </bibl>`,
        ]
          .filter(Boolean)
          .join("\n"),
      );
    }
  }
  const L = spec?.license;
  return `<?xml version="1.0" encoding="UTF-8"?>
<TEI xmlns="http://www.tei-c.org/ns/1.0">
  <teiHeader>
    <fileDesc>
      <titleStmt>
        <title>Sources for ${x(b.name)} (${x(b.id)}), transcription ${x(c.compilationId)}</title>
      </titleStmt>
      <publicationStmt>
        <publisher>Open Lexis</publisher>
        <idno type="specification-id">${x(c.specId)}</idno>
        <idno type="compilation-id">${x(c.compilationId)}</idno>
        <idno type="URI">${x(SITE_ORIGIN + bookUrl(c.compilationId, b.id))}</idno>
        <availability>
          ${L ? `<licence target="${x(L.url)}">${x(plain(L.copyright))}. Licensed under ${x(L.name)}.</licence>` : ""}
          <p>Each source transcription keeps the license stated by its source, listed below.</p>
        </availability>
      </publicationStmt>
      <sourceDesc>
        <listBibl>
          <head>Source transcriptions used for ${x(b.name)}</head>
${bibls.join("\n")}
        </listBibl>
      </sourceDesc>
    </fileDesc>
  </teiHeader>
  <text>
    <body>
      <p>This file lists the credit, license and link for each source transcription used in ${x(b.file)}. The compiled text is in ${x(b.file)}, unchanged from the published transcription.</p>
    </body>
  </text>
</TEI>
`;
}

export interface Download {
  href: string;
  bytes: number;
  name: string;
}

const bookEntryCache = new Map<string, ZipEntry[]>();
function bookEntries(c: CompilationRecord, b: CompiledBookEntry): ZipEntry[] {
  const key = `${c.compilationId}/${b.id}`;
  let e = bookEntryCache.get(key);
  if (!e) {
    const raw = readFileSync(`${c.dir}/${b.file}`);
    const spec = getSpecifications().find((s) => s.id === c.specId);
    const sources = sourcesTei(c, b, spec, raw.toString("utf8"));
    e = [entryOf(b.file, raw), entryOf(b.file.replace(/\.xml$/, ".sources.xml"), Buffer.from(sources, "utf8"))];
    bookEntryCache.set(key, e);
  }
  return e;
}

const written = new Map<string, Download | null>();
function write(c: CompilationRecord, name: string, build: () => Buffer): Download | null {
  const short = shortUlid(c.compilationId);
  const rel = `downloads/${short}/${name}`;
  if (written.has(rel)) return written.get(rel)!;
  const buf = build();
  let d: Download | null = null;
  if (buf.length <= MAX_BYTES) {
    mkdirSync(join(process.cwd(), "www", "downloads", short), { recursive: true });
    writeFileSync(join(process.cwd(), "www", rel), buf);
    d = { href: `/${rel}`, bytes: buf.length, name };
  } else {
    console.warn(`[downloads] ${rel} is ${buf.length} bytes, over the 25 MiB file limit; not published`);
  }
  written.set(rel, d);
  return d;
}

const when = (c: CompilationRecord) => new Date(c.manifest.compilation.createdAt || Date.now());

/** One book: the published TEI file, unchanged, and its sources file. */
export function bookDownload(c: CompilationRecord, b: CompiledBookEntry): Download | null {
  const short = shortUlid(c.compilationId);
  return write(c, `openlexis-${short}-${b.id}-tei.zip`, () => zip(bookEntries(c, b), when(c)));
}

/** Every book of a transcription, each with its sources file, in one zip (when it fits the file size limit). */
export function compilationDownload(c: CompilationRecord): Download | null {
  const short = shortUlid(c.compilationId);
  const folder = `openlexis-${short}`;
  return write(c, `openlexis-${short}-tei.zip`, () =>
    zip(
      c.manifest.books.flatMap((b) => bookEntries(c, b).map((e) => ({ ...e, name: `${folder}/${e.name}` }))),
      when(c),
    ),
  );
}
