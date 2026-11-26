// Shared helpers for the archive records: archives/manuscripts/<id>.yaml (the physical manuscript and its reproductions)
// and archives/transcriptions/<archive>/<file stem>.yaml (one transcription file). See docs/archive-records.md.
import { readFileSync } from "node:fs";
import { parseXml } from "./tei";

export type Source = { path: string; locator: string; quote: string } | { url: string; accessed: string; quote: string; title?: string; citation?: string };
export type XNode = { t: string; a: Record<string, string>; c: (XNode | string)[] };

/** Archives whose catalog ids are Gregory-Aland numbers, and the prefix for the rest. */
const PREFIX: Record<string, string> = { "etcbc-dss": "dss", aleppo: "mt", uxlc: "mt", "dt-ucph-sp": "sp", "tal-florentin-sp": "sp" };
/** The manuscript record id for a catalog item: a scheme prefix and the catalog id in lower case letters and digits. */
export const manuscriptId = (archive: string, id: string) => `${PREFIX[archive] ?? "ga"}-${id.toLowerCase().replace(/[^a-z0-9]/g, "")}`;
/** The transcription record id and path for an archive XML file. */
export const transcriptionId = (path: string) => { const [, archive, file] = path.split("/"); return `${archive}/${file.replace(/\.xml$/, "")}`; };
export const transcriptionPath = (path: string) => `archives/transcriptions/${transcriptionId(path)}.yaml`;
export const manuscriptPath = (id: string) => `archives/manuscripts/${id}.yaml`;

/** Collapse runs of white space, so a quote matches however the file is wrapped. */
export const norm = (s: string) => s.replace(/\s+/g, " ").trim();

/** The teiHeader of an XML file, read from its start only (some transcriptions are tens of megabytes). */
export function readHeader(file: string): string {
  const buf = readFileSync(file);
  const head = buf.subarray(0, Math.min(buf.length, 4 << 20)).toString("utf8");
  const i = head.indexOf("</teiHeader>");
  if (i < 0) return "";
  const j = head.indexOf("<teiHeader");
  return head.slice(j, i + 12);
}

/** The header parsed into elements, with CDATA kept as text (HTML tags inside it removed). */
export function parseHeader(header: string): XNode {
  const cdata = header.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, (_, t: string) => t.replace(/<[^>]*>/g, " ").replace(/&/g, "&amp;").replace(/</g, "&lt;"));
  const root = parseXml(cdata) as unknown as XNode;
  return (root.c.find((n) => typeof n !== "string" && n.t === "teiHeader") as XNode) ?? root;
}

/** The text of an element: its text pieces joined by single spaces, white space collapsed. */
export const textOf = (n: XNode | string | undefined): string =>
  n === undefined ? "" : typeof n === "string" ? norm(n) : norm(n.c.map((x) => textOf(x)).join(" ")).replace(/ ([.,;:)\]])/g, "$1").replace(/([(\[]) /g, "$1");

/** Everything a quote from a header may match: the raw header and its text, white space collapsed. */
export const headerHaystacks = (header: string) => [norm(header.replace(/<!--[\s\S]*?-->/g, " ")), textOf(parseHeader(header))];

export const kids = (n: XNode | undefined, t?: string) => (n ? (n.c.filter((x) => typeof x !== "string" && (!t || x.t === t)) as XNode[]) : []);
export const kid = (n: XNode | undefined, t: string) => kids(n, t)[0];
export const findAll = (n: XNode | undefined, t: string): XNode[] =>
  n ? kids(n).flatMap((k) => (k.t === t ? [k, ...findAll(k, t)] : findAll(k, t))) : [];

/** Words that may not appear as a record value: a field no source states is left out instead. */
export const PLACEHOLDER = /^(unknown|n\/a|none|not stated|not known|unstated|tbd|-)$/i;
