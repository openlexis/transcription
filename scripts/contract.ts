#!/usr/bin/env bun
/**
 * Prints the output contract a model must follow, from the contract files a specification pins (contract/ at the commits in
 * its `contract` list), so nobody has to retype the rules by hand.
 *
 *   bun run contract show [<SPEC_ULID>]              the rules in plain language (no ULID: the contract in the working tree)
 *   bun run contract skeleton <SPEC_ULID> <folder>   fill-in templates: manifest.json, REPORT.md and book.template.xml
 *
 * `bun run check` validates compilations against the same pinned files.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { contractPins, loadPinnedContract, loadWorkingContract, type Contract } from "./lib/contract";
import { readSpecLicense } from "./lib/spec";
import { parseXml } from "./lib/tei";
import { findSpecPath, loadSpecWithSources } from "./sources";

const ROOT = new URL("..", import.meta.url).pathname;
type Node = { t: string; a: Record<string, string>; c: (Node | string)[] };
const kids = (n: Node) => n.c.filter((c): c is Node => typeof c !== "string");
const docOf = (n: Node) => { const d = kids(n).find((k) => k.t === "documentation"); return d ? d.c.join("").replace(/\s+/g, " ").trim() : ""; };

function loadForSpec(specId: string) {
  const specPath = findSpecPath(specId);
  const specText = readFileSync(specPath, "utf8");
  const spec = Bun.YAML.parse(specText) as Record<string, unknown>;
  const at = specPath.slice(ROOT.length);
  const pins = contractPins(spec);
  if (!pins) throw new Error(`${at} has no contract list; it was made before the contract existed (run bun run spec:contract on a new specification)`);
  return { specPath, specText, spec, at, contract: loadPinnedContract(pins, at) };
}

// ---------- JSON Schema to plain language ----------
function resolve(root: any, s: any): any {
  if (s?.$ref) {
    const target = s.$ref.replace(/^#\//, "").split("/").reduce((o: any, k: string) => o[k], root);
    const { $ref, ...rest } = s;
    return { ...resolve(root, target), ...rest, description: rest.description ?? target.description };
  }
  return s;
}
function kind(s: any): string {
  if (s.const !== undefined) return `exactly ${JSON.stringify(s.const)}`;
  if (s.enum) return `one of ${s.enum.map((v: unknown) => JSON.stringify(v)).join(", ")}`;
  if (s.format === "date-time") return "date and time (ISO 8601)";
  if (s.format === "uri") return "web address";
  if (s.type === "string" && s.pattern) return `text matching ${s.pattern}`;
  if (s.type === "string") return s.minLength ? "text, not empty" : "text";
  if (s.type === "integer") return `whole number${s.minimum !== undefined ? ` ≥ ${s.minimum}` : ""}`;
  if (s.type === "number") return `number${s.minimum !== undefined && s.maximum !== undefined ? ` from ${s.minimum} to ${s.maximum}` : s.minimum !== undefined ? ` ≥ ${s.minimum}` : ""}`;
  if (s.type === "array") return `list${s.minItems ? `, at least ${s.minItems}` : ""}`;
  if (s.type === "object") return s.additionalProperties && typeof s.additionalProperties === "object" ? "map of names to values" : "object";
  return "value";
}
function jsonRules(root: any, s: any, path: string, required: boolean, out: string[]) {
  s = resolve(root, s);
  if (path) out.push(`- \`${path}\` (${required ? "required" : "optional"}; ${kind(s)})${s.description ? `: ${s.description}` : ""}`);
  if (s.type === "object" && s.properties) {
    const req = new Set<string>(s.required ?? []);
    for (const [k, v] of Object.entries(s.properties)) jsonRules(root, v, path ? `${path}.${k}` : k, req.has(k), out);
    if (s.additionalProperties === false && path === "") out.push("- Nothing else is allowed at any level; every name not listed here is an error.");
  }
  if (s.type === "array" && s.items) {
    const it = resolve(root, s.items);
    if (it.type === "object") jsonRules(root, it, `${path}[]`, true, out);
  }
  return out;
}

// ---------- RELAX NG to plain language ----------
function grammar(rng: string) {
  const root = parseXml(rng) as Node;
  const g = kids(root).find((k) => k.t === "grammar")!;
  const defs = new Map<string, Node>();
  for (const d of kids(g)) if (d.t === "define") defs.set(d.a.name, d);
  const start = kids(g).find((k) => k.t === "start")!;
  return { defs, start };
}
const FRIENDLY: Record<string, string> = {
  ulid: "a 26-character ULID",
  pointer: "a #pointer to an xml:id",
  pointers: "one or more #pointers to xml:ids, separated by spaces",
  nonEmpty: "text, not empty",
};
function valueDesc(n: Node, defs: Map<string, Node>): string {
  const parts: string[] = [];
  for (const k of kids(n)) {
    if (k.t === "documentation") continue;
    if (k.t === "value") parts.push(JSON.stringify(k.c.join("")));
    else if (k.t === "text") parts.push("text");
    else if (k.t === "ref") parts.push(FRIENDLY[k.a.name] ?? valueDesc(defs.get(k.a.name)!, defs));
    else if (k.t === "choice") parts.push(valueDesc(k, defs).split(", ").join(" or "));
    else if (k.t === "data") {
      const p = Object.fromEntries(kids(k).filter((x) => x.t === "param").map((x) => [x.a.name, x.c.join("")]));
      const t = k.a.type;
      if (t === "decimal" && p.minInclusive !== undefined) parts.push(`decimal from ${p.minInclusive} to ${p.maxInclusive}`);
      else if (p.pattern) parts.push(`${t === "ID" ? "unique id" : "text"} matching ${p.pattern}`);
      else if (t === "ID") parts.push("unique id");
      else if (t === "dateTime") parts.push("ISO 8601 date and time");
      else if (t === "anyURI") parts.push("web address");
      else if (t === "string" && p.minLength) parts.push("text, not empty");
      else parts.push(t === "token" ? "a word" : t);
    }
  }
  return parts.join(", ");
}
type Occ = string;
function rngRules(contract: Contract): string[] {
  const { defs, start } = grammar(contract.text["tei-shape.rng"]);
  const out: string[] = [];
  const label = (el: Node) => {
    const type = kids(el).find((k) => k.t === "attribute" && k.a.name === "type");
    const v = type && kids(type).find((k) => k.t === "value");
    return v ? `${el.a.name}[type="${v.c.join("")}"]` : el.a.name;
  };
  const describeElement = (el: Node, path: string, occ: Occ, depth: number) => {
    const p = path ? `${path} > ${label(el)}` : label(el);
    const attrs: string[] = [];
    const children: [Node, Occ][] = [];
    let content = "";
    const scan = (n: Node, o: Occ, inChoice: boolean) => {
      for (const k of kids(n)) {
        if (k.t === "documentation") continue;
        if (k.t === "attribute") {
          const isType = k.a.name === "type" && kids(k).some((x) => x.t === "value");
          if (!isType || inChoice) attrs.push(`${k.a.name}${o === "optional" ? " (optional)" : ""} = ${valueDesc(k, defs)}${docOf(k) ? ` (${docOf(k)})` : ""}`);
        } else if (k.t === "element") children.push([k, inChoice ? "one choice" : o]);
        else if (k.t === "ref") {
          const d = defs.get(k.a.name)!;
          const top = kids(d).find((x) => x.t !== "documentation")!;
          if (top.t === "element") children.push([top, inChoice ? "one choice" : o]);
          else if (top.t === "data") content = FRIENDLY[k.a.name] ?? valueDesc(d, defs);
          else scan(d, o, inChoice);
        } else if (k.t === "optional") scan(k, "optional", inChoice);
        else if (k.t === "zeroOrMore") scan(k, "any number", inChoice);
        else if (k.t === "oneOrMore") scan(k, "one or more", inChoice);
        else if (k.t === "choice") {
          const docs = kids(k).filter((x) => x.t === "group" && docOf(x)).map(docOf);
          for (const d of docs) attrs.push(`alternative: ${d}`);
          scan(k, o, true);
        } else if (k.t === "group" || k.t === "interleave") scan(k, o, inChoice);
        else if (k.t === "mixed") { content = content || "text"; scan(k, o, inChoice); }
        else if (k.t === "text") content = content || "text";
        else if (k.t === "data") content = valueDesc({ t: "x", a: {}, c: [k] }, defs);
      }
    };
    scan(el, "required", false);
    const doc = docOf(el);
    out.push(`${"  ".repeat(depth)}- \`<${label(el)}>\` (${occ})${doc ? `: ${doc}` : ""}`);
    for (const a of attrs) out.push(`${"  ".repeat(depth + 1)}- ${a.startsWith("alternative:") ? a : `@${a}`}`);
    if (content) out.push(`${"  ".repeat(depth + 1)}- content: ${content}`);
    for (const [c, o] of children) describeElement(c, p, o, depth + 1);
  };
  describeElement(kids(start).find((k) => k.t === "element")!, "", "required", 0);
  return out;
}

function show(contract: Contract, specId?: string) {
  const I = contract.info;
  const lines: string[] = [];
  lines.push(`# Output contract${specId ? ` for specification ${specId}` : " (working tree, not pinned by any specification)"}`, "");
  lines.push(I.description, "");
  lines.push("Files read:", ...Object.values(contract.origin).map((o) => `- ${o}`), "");
  lines.push("A compilation folder `transcripts/<specification ULID>/<compilation ULID>/` holds exactly:");
  for (const f of I.files) lines.push(`- \`${f.file}\`${f.each ? ` (${f.each})` : ""}: ${[f.schema].flat().join(" and ")} (${f.standard})${f.part ? `; ${f.part}` : ""}`);
  lines.push("", "## manifest.json", "");
  const ms = JSON.parse(contract.text["manifest.schema.json"]);
  lines.push(ms.description, "", ...jsonRules(ms, ms, "", true, []));
  lines.push("", "## REPORT.md front matter", "");
  const rs = JSON.parse(contract.text["report.schema.json"]);
  lines.push(rs.description, "", ...jsonRules(rs, rs, "", true, []));
  lines.push("", "## Book files (TEI XML)", "");
  lines.push(`Each book file must be valid ${I.teiAll.standard} ${I.teiAll.version} (tei_all.rng, SHA-256 ${I.teiAll.sha256}) and have this shape (tei-shape.rng), in this order:`, "");
  lines.push(...rngRules(contract));
  lines.push("", "## Checks across files", "");
  for (const c of I.crossChecks) lines.push(`- **${c.id}**: ${c.rule}`);
  lines.push("", "Validate a compilation with `bun run check` (all of transcripts/) or `bun run check --spec <ULID> --dir <folder>`.");
  console.log(lines.join("\n"));
}

// ---------- Skeleton ----------
function jsonSkeleton(root: any, s: any): any {
  s = resolve(root, s);
  if (s.const !== undefined) return s.const;
  if (s.enum) return s.enum[0];
  if (s.type === "object" && s.properties) {
    const o: Record<string, unknown> = {};
    for (const k of s.required ?? []) o[k] = jsonSkeleton(root, s.properties[k]);
    return o;
  }
  if (s.type === "object") return {};
  if (s.type === "array") return s.items ? [jsonSkeleton(root, s.items)] : [];
  if (s.type === "integer" || s.type === "number") return 0;
  return `{${(s.description ?? kind(s)).replace(/\s+/g, " ")}}`;
}
function teiSkeleton(contract: Contract): string {
  const { defs, start } = grammar(contract.text["tei-shape.rng"]);
  const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/"/g, "&quot;");
  const build = (n: Node, depth: number, repeated: boolean): { attrs: string[]; body: string[]; text: string } => {
    const r = { attrs: [] as string[], body: [] as string[], text: "" };
    const add = (x: { attrs: string[]; body: string[]; text: string }) => { r.attrs.push(...x.attrs); r.body.push(...x.body); r.text ||= x.text; };
    for (const k of kids(n)) {
      if (k.t === "documentation") continue;
      if (k.t === "element") r.body.push(renderEl(k, depth));
      else if (k.t === "attribute") r.attrs.push(`${k.a.name}="${esc(kids(k).some((x) => x.t === "value") ? kids(k).find((x) => x.t === "value")!.c.join("") : `{${valueDesc(k, defs)}}`)}"`);
      else if (k.t === "ref") {
        const d = defs.get(k.a.name)!, top = kids(d).find((x) => x.t !== "documentation")!;
        if (top.t === "data") r.text ||= `{${FRIENDLY[k.a.name] ?? valueDesc(d, defs)}}`;
        else add(build(d, depth, repeated));
      } else if (k.t === "choice") {
        const alts = kids(k).filter((x) => x.t !== "documentation");
        if (alts.every((x) => x.t === "value")) r.text ||= `{${alts.map((x) => x.c.join("")).join(" or ")}}`;
        else for (const alt of repeated ? alts : [alts[alts.length - 1]]) add(build({ t: "group", a: {}, c: [alt] }, depth, false));
      } else if (k.t === "oneOrMore" || k.t === "zeroOrMore") add(build(k, depth, true));
      else if (k.t === "optional" || k.t === "group" || k.t === "interleave") add(build(k, depth, repeated));
      else if (k.t === "mixed") { r.text ||= "{text}"; add(build(k, depth, repeated)); }
      else if (k.t === "text") r.text ||= "{text}";
      else if (k.t === "data") r.text ||= `{${valueDesc({ t: "x", a: {}, c: [k] }, defs)}}`;
    }
    return r;
  };
  const renderEl = (el: Node, depth: number): string => {
    const pad = "  ".repeat(depth);
    const { attrs, body, text } = build(el, depth + 1, false);
    const open = `${el.a.name}${attrs.length ? " " + attrs.join(" ") : ""}`;
    if (!body.length && !text) return `${pad}<${open}/>`;
    if (!body.length) return `${pad}<${open}>${esc(text)}</${el.a.name}>`;
    return `${pad}<${open}>${text ? esc(text) : ""}\n${body.join("\n")}\n${pad}</${el.a.name}>`;
  };
  const top = kids(start).find((k) => k.t === "element")!;
  return `<?xml version="1.0" encoding="UTF-8"?>\n` + renderEl(top, 0).replace("<TEI", '<TEI xmlns="http://www.tei-c.org/ns/1.0"') + "\n";
}

function skeleton(specId: string, folder: string) {
  const { specPath, specText, spec, at, contract } = loadForSpec(specId);
  const license = readSpecLicense(spec, at);
  const { targets } = loadSpecWithSources(specId);
  const ms = JSON.parse(contract.text["manifest.schema.json"]), rs = JSON.parse(contract.text["report.schema.json"]);
  const manifest = jsonSkeleton(ms, ms);
  manifest.specification = {
    id: specId,
    file: specPath.slice(ROOT.length),
    sha256: createHash("sha256").update(specText).digest("hex"),
    statement: `This compilation was produced under Open Lexis Transcription Specification ${specId}.`,
    license,
  };
  const bookTpl = manifest.books[0];
  manifest.books = targets.map((t) => ({ ...bookTpl, id: t.id, name: t.name, section: t.section, number: t.number, language: t.language, file: `${t.id}.xml` }));
  const report = jsonSkeleton(rs, rs);
  report.specification_id = specId;
  if (!existsSync(folder)) mkdirSync(folder, { recursive: true });
  writeFileSync(`${folder}/manifest.json`, JSON.stringify(manifest, null, 2) + "\n");
  writeFileSync(`${folder}/REPORT.md`, `---\n${Bun.YAML.stringify(report, null, 2).trimEnd()}\n---\n\n# Compilation Report\n\n{A plain-language Markdown report of what was performed.}\n`);
  writeFileSync(`${folder}/book.template.xml`, teiSkeleton(contract));
  console.log(`Wrote manifest.json, REPORT.md and book.template.xml (one file per target book, ${targets.length} here, named <book id>.xml) to ${folder}. Replace every {placeholder}; then run bun run check --spec ${specId} --dir <compilation folder>.`);
}

const [cmd, ...rest] = process.argv.slice(2);
if (cmd === "show" && rest.length <= 1) {
  if (rest[0]) show(loadForSpec(rest[0]).contract, rest[0]);
  else show(loadWorkingContract());
} else if (cmd === "skeleton" && rest.length === 2) skeleton(rest[0], rest[1]);
else {
  console.error("Usage:\n  bun run contract show [<SPEC_ULID>]\n  bun run contract skeleton <SPEC_ULID> <folder>");
  process.exit(1);
}
