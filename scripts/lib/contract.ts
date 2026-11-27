// The output contract (contract/): what a compilation must contain, the schema each file must satisfy, and the checks across
// files that no schema language can express. A specification pins the contract files by git commit in its `contract` list,
// so later edits to contract/ do not change what a published specification requires. `bun run check` validates every
// compilation of such a specification against its pinned contract; `bun run contract show|skeleton` print it for a model.
import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { spawnSync } from "node:child_process";
import Ajv2020 from "ajv/dist/2020";
import addFormats from "ajv-formats";
import { validateXML } from "xmllint-wasm";
import { parseXml } from "./tei";
import { gitShow } from "../sources";
import type { SpecLicense } from "./spec";

const ROOT = new URL("../..", import.meta.url).pathname;
const sha = (x: string | Buffer) => createHash("sha256").update(x).digest("hex");

/** The files every contract has. */
export const CONTRACT_FILES = ["contract.json", "manifest.schema.json", "report.schema.json", "tei-shape.rng", "tei_all.rng"] as const;
export type ContractFile = (typeof CONTRACT_FILES)[number];
export type ContractPin = { path: string; commit: string };
export type CrossCheck = { id: string; rule: string };
export type ContractInfo = {
  description: string;
  files: { file: string; schema: string | string[]; standard: string; part?: string; each?: string }[];
  teiAll: { file: string; standard: string; version: string; sha256: string; source: string };
  crossChecks: CrossCheck[];
};
export type Contract = {
  /** Where each file came from, for messages: "contract/x @ abc1234" or "contract/x (working tree)". */
  origin: Record<ContractFile, string>;
  text: Record<ContractFile, string>;
  info: ContractInfo;
};

/** A specification's `contract` list, or undefined when it has none (specifications made before the contract existed). */
export function contractPins(spec: Record<string, unknown>): ContractPin[] | undefined {
  const c = spec.contract;
  if (!Array.isArray(c) || !c.length) return undefined;
  return c as ContractPin[];
}

function finish(text: Record<ContractFile, string>, origin: Record<ContractFile, string>): Contract {
  const info = JSON.parse(text["contract.json"]) as ContractInfo;
  const got = sha(text["tei_all.rng"]);
  if (got !== info.teiAll.sha256) throw new Error(`${origin["tei_all.rng"]}: SHA-256 ${got} does not match ${info.teiAll.sha256} recorded in contract.json`);
  const known = new Set(Object.keys(CROSS_CHECKS));
  const unknown = info.crossChecks.filter((c) => !known.has(c.id)).map((c) => c.id);
  if (unknown.length) throw new Error(`${origin["contract.json"]}: cross-checks ${unknown.join(", ")} are not implemented in scripts/lib/contract.ts`);
  return { text, origin, info };
}

/** The contract a specification pins, read at its recorded commits. */
export function loadPinnedContract(pins: ContractPin[], at: string): Contract {
  const text = {} as Record<ContractFile, string>, origin = {} as Record<ContractFile, string>;
  for (const p of pins) {
    const name = p.path.replace(/^contract\//, "") as ContractFile;
    if (!CONTRACT_FILES.includes(name) || !p.path.startsWith("contract/")) throw new Error(`${at}: contract lists ${p.path}, which is not a contract file`);
    text[name] = gitShow(p.commit, p.path);
    origin[name] = `${p.path} @ ${p.commit.slice(0, 7)}`;
  }
  const missing = CONTRACT_FILES.filter((f) => !(f in text));
  if (missing.length) throw new Error(`${at}: contract list is missing ${missing.map((f) => `contract/${f}`).join(", ")}`);
  return finish(text, origin);
}

/** The contract as it is in the working tree (for `contract show` with no specification). */
export function loadWorkingContract(): Contract {
  const text = {} as Record<ContractFile, string>, origin = {} as Record<ContractFile, string>;
  for (const f of CONTRACT_FILES) {
    text[f] = readFileSync(`${ROOT}contract/${f}`, "utf8");
    origin[f] = `contract/${f} (working tree)`;
  }
  return finish(text, origin);
}

/** The path and last commit of every contract file; refuses if any has uncommitted changes. Used by `bun run spec:contract`. */
export function currentContractPins(): ContractPin[] {
  const git = (...a: string[]) => {
    const r = spawnSync("git", a, { cwd: ROOT, encoding: "utf8" });
    if (r.status !== 0) throw new Error(`git ${a.join(" ")}: ${r.stderr}`);
    return r.stdout.trim();
  };
  const dirty = git("status", "--porcelain", "--", "contract");
  if (dirty) throw new Error(`Commit the contract files first:\n${dirty}`);
  return CONTRACT_FILES.map((f) => {
    const path = `contract/${f}`;
    const commit = git("log", "-1", "--format=%H", "--", path);
    if (!commit) throw new Error(`${path} is not committed`);
    return { path, commit };
  });
}

// ---------- JSON Schema ----------
const ajvCache = new Map<string, (x: unknown) => string[]>();
/** Drop shortTitle from a manifest schema so already-pinned contracts stay valid after those fields were removed. */
function manifestSchemaWithoutShortTitle(schemaText: string): string {
  try {
    const schema = JSON.parse(schemaText);
    const comp = schema?.properties?.compilation;
    if (Array.isArray(comp?.required)) comp.required = comp.required.filter((k: string) => k !== "shortTitle");
    if (comp?.properties?.shortTitle) delete comp.properties.shortTitle;
    return JSON.stringify(schema);
  } catch {
    return schemaText;
  }
}

function jsonValidator(schemaText: string, origin: string) {
  const hit = ajvCache.get(schemaText);
  if (hit) return hit;
  const ajv = new Ajv2020({ allErrors: true, strict: true });
  addFormats(ajv);
  const v = ajv.compile(JSON.parse(schemaText));
  const fn = (x: unknown) => {
    if (v(x)) return [];
    return (v.errors ?? []).map((e) => {
      const path = e.instancePath.split("/").slice(1).map((s) => (/^\d+$/.test(s) ? `[${s}]` : `.${s}`)).join("").replace(/^\./, "");
      const at = (p: string) => (path ? `${path}.${p}` : p);
      if (e.keyword === "required") return `${at((e.params as any).missingProperty)} is required (${origin})`;
      if (e.keyword === "additionalProperties") return `${at((e.params as any).additionalProperty)} is not part of the contract (${origin})`;
      return `${path || "(top level)"} ${e.message} (${origin})`;
    });
  };
  ajvCache.set(schemaText, fn);
  return fn;
}

// ---------- RELAX NG ----------
/** Validates XML files against one RELAX NG schema, in batches so memory stays bounded. Returns messages per file. */
async function relaxNg(files: { name: string; text: string }[], schema: string, origin: string): Promise<string[]> {
  const out: string[] = [];
  let batch: { fileName: string; contents: string }[] = [], size = 0;
  const run = async () => {
    if (!batch.length) return;
    const r = await validateXML({ xml: batch, schema: [schema], extension: "relaxng", initialMemoryPages: 4096, maxMemoryPages: 65536 } as any);
    const perFile = new Map<string, number>();
    for (const e of r.errors ?? []) {
      const f = e.loc?.fileName ?? "?";
      const n = (perFile.get(f) ?? 0) + 1;
      perFile.set(f, n);
      if (n <= 5) out.push(`${f}${e.loc?.lineNumber ? `:${e.loc.lineNumber}` : ""}: ${e.message.replace(/^.*Relax-NG validity error : /, "").trim()} (${origin})`);
    }
    batch = []; size = 0;
  };
  for (const f of files) {
    if (size + f.text.length > 48e6) await run();
    batch.push({ fileName: f.name, contents: f.text });
    size += f.text.length;
  }
  await run();
  return out;
}

// ---------- Cross-checks ----------
type Node = { t: string; a: Record<string, string>; c: (Node | string)[] };
const textOf = (n: Node | string): string => (typeof n === "string" ? n : n.c.map(textOf).join(""));
const walk = (n: Node | string, f: (n: Node) => void) => { if (typeof n === "string") return; f(n); for (const c of n.c) walk(c, f); };
const first = (n: Node, t: string, pred: (x: Node) => boolean = () => true) => { let hit: Node | undefined; walk(n, (x) => { if (!hit && x.t === t && pred(x)) hit = x; }); return hit; };
const ptrs = (s: string | undefined) => (s ?? "").split(/\s+/).filter(Boolean);

export type CompilationInput = {
  specId: string;
  specPath: string;
  specText: string;
  license: SpecLicense;
  targets: { id: string }[];
  dir: string;
  at: string;
};
type Ctx = CompilationInput & {
  compId: string;
  manifest: any;
  report: any;
  reportBody: string;
  reportRaw: string;
  manifestRaw: string;
  books: { name: string; text: string; root?: Node }[];
};

const STATEMENT = (id: string) => `This compilation was produced under Open Lexis Transcription Specification ${id}.`;

/** Each cross-check named in contract.json, by id. Each returns problems as plain messages. */
const CROSS_CHECKS: Record<string, (c: Ctx) => string[]> = {
  "ids-match": (c) => {
    const f: string[] = [];
    if (c.manifest.specification?.id !== c.specId) f.push(`manifest.json specification.id is ${c.manifest.specification?.id}, not ${c.specId}`);
    if (c.manifest.compilation?.id !== c.compId) f.push(`manifest.json compilation.id is ${c.manifest.compilation?.id}, not the folder name ${c.compId}`);
    if (c.report.specification_id !== c.specId) f.push(`REPORT.md specification_id is ${c.report.specification_id}, not ${c.specId}`);
    if (c.report.compilation_id !== c.compId) f.push(`REPORT.md compilation_id is ${c.report.compilation_id}, not ${c.compId}`);
    for (const b of c.books) {
      if (!b.root) continue;
      const s = first(b.root, "idno", (x) => x.a.type === "specification-id"), k = first(b.root, "idno", (x) => x.a.type === "compilation-id");
      if (!s || textOf(s).trim() !== c.specId) f.push(`${b.name}: idno specification-id is not ${c.specId}`);
      if (!k || textOf(k).trim() !== c.compId) f.push(`${b.name}: idno compilation-id is not ${c.compId}`);
    }
    return f;
  },
  statement: (c) => {
    const f: string[] = [], want = STATEMENT(c.specId);
    if (c.manifest.specification?.statement !== want) f.push(`manifest.json specification.statement must be exactly "${want}"`);
    for (const b of c.books) {
      if (!b.root) continue;
      const ed = first(b.root, "editionStmt");
      if (!ed || textOf(ed).trim() !== want) f.push(`${b.name}: editionStmt must say exactly "${want}"`);
    }
    return f;
  },
  "specification-file": (c) => {
    const f: string[] = [];
    const rel = c.specPath.slice(ROOT.length);
    if (c.manifest.specification?.file !== rel) f.push(`manifest.json specification.file is ${c.manifest.specification?.file}, not ${rel}`);
    if (c.manifest.specification?.sha256 !== sha(c.specText)) f.push(`manifest.json specification.sha256 does not match ${rel}`);
    return f;
  },
  "license-match": (c) => {
    const f: string[] = [], L = c.license, m = c.manifest.specification?.license;
    if (!m || m.copyright !== L.copyright || m.name !== L.name || m.url !== L.url) f.push("manifest.json specification.license does not match the specification's license");
    const want = `${L.copyright}. Licensed under ${L.name}.`;
    for (const b of c.books) {
      if (!b.root) continue;
      const lic = first(b.root, "licence");
      if (!lic || lic.a.target !== L.url || textOf(lic).trim() !== want) f.push(`${b.name}: licence must have target="${L.url}" and say "${want}"`);
    }
    return f;
  },
  "books-complete": (c) => {
    const f: string[] = [], listed = (c.manifest.books ?? []) as any[];
    const want = new Set(c.targets.map((t) => t.id)), have = new Set(listed.map((b) => b.id));
    for (const t of want) if (!have.has(t)) f.push(`manifest.json books is missing target book ${t}`);
    for (const b of listed) {
      if (!want.has(b.id)) f.push(`manifest.json books lists ${b.id}, which is not a target book of the specification`);
      const file = c.books.find((x) => x.name === b.file);
      if (!file) { f.push(`${b.file}: file missing`); continue; }
      if (sha(file.text) !== b.sha256) f.push(`${b.file}: SHA-256 does not match manifest.json`);
      if (Buffer.byteLength(file.text, "utf8") !== b.bytes) f.push(`${b.file}: size does not match manifest.json bytes`);
    }
    const xmls = readdirSync(c.dir).filter((x) => x.endsWith(".xml"));
    for (const x of xmls) if (!listed.some((b) => b.file === x)) f.push(`${x}: not listed in manifest.json books`);
    return f;
  },
  "totals-match": (c) => {
    const f: string[] = [], B = (c.manifest.books ?? []) as any[], T = c.manifest.totals ?? {}, R = c.report.totals ?? {};
    const sum = (k: (b: any) => number) => B.reduce((s, b) => s + (k(b) ?? 0), 0);
    const want = { books: B.length, lines: sum((b) => b.stats?.lines), words: sum((b) => b.stats?.words), variantPlaces: sum((b) => b.stats?.places), totalBytes: sum((b) => b.bytes) };
    for (const [k, v] of Object.entries(want)) if (T[k] !== v) f.push(`manifest.json totals.${k} is ${T[k]}, but the books add up to ${v}`);
    const pairs: [string, string][] = [["books", "books"], ["lines", "lines"], ["words", "words"], ["variant_places", "variantPlaces"]];
    for (const [r, m] of pairs) if (R[r] !== T[m]) f.push(`REPORT.md totals.${r} is ${R[r]}, but manifest.json totals.${m} is ${T[m]}`);
    return f;
  },
  "attribution-match": (c) => {
    const f: string[] = [], M = c.manifest.modelAttribution ?? {}, R = c.report.model_attribution ?? {};
    const pairs: [string, string][] = [["provider", "provider"], ["modelFamily", "model_family"], ["modelName", "model_name"], ["modelId", "model_id"], ["effortLevel", "effort_level"], ["harness", "harness"]];
    for (const [m, r] of pairs) if (M[m] !== R[r]) f.push(`REPORT.md model_attribution.${r} is ${R[r] === undefined ? "missing" : `"${R[r]}"`}, but manifest.json modelAttribution.${m} is ${M[m] === undefined ? "missing" : `"${M[m]}"`}`);
    const created = c.report.created_at instanceof Date ? c.report.created_at.toISOString() : String(c.report.created_at);
    if (c.manifest.compilation?.createdAt !== created) f.push(`REPORT.md created_at is ${created}, but manifest.json compilation.createdAt is ${c.manifest.compilation?.createdAt}`);
    return f;
  },
  "references-resolve": (c) => {
    const f: string[] = [];
    for (const b of c.books) {
      if (!b.root) continue;
      const ids = new Set<string>(), wits = new Set<string>();
      walk(b.root, (n) => { if (n.a.id) ids.add(n.a.id); if (n.t === "witness" && n.a.id) wits.add(n.a.id); });
      const bad = new Map<string, number>();
      const need = (p: string, set: Set<string>, what: string) => {
        if (!p.startsWith("#") || !set.has(p.slice(1))) { const k = `${what} ${p}`; bad.set(k, (bad.get(k) ?? 0) + 1); }
      };
      walk(b.root, (n) => {
        for (const p of ptrs(n.a.wit)) need(p, wits, "wit points at no witness:");
        for (const p of ptrs(n.a.corresp)) need(p, wits, "corresp points at no witness:");
        for (const p of ptrs(n.a.target)) if (n.t !== "licence") need(p, ids, "target points at no xml:id:");
        if (n.t === "note" && (n.a.type === "attested" || n.a.type === "lacuna") && n.c.length) for (const p of ptrs(textOf(n))) need(p, wits, `${n.a.type} note points at no witness:`);
      });
      for (const [k, n] of [...bad].slice(0, 5)) f.push(`${b.name}: ${k}${n > 1 ? ` (${n} times)` : ""}`);
      if (bad.size > 5) f.push(`${b.name}: ${bad.size - 5} more unresolved pointers`);
    }
    return f;
  },
  "severity-scale": (c) => {
    const f: string[] = [], S = c.report.disagreement_scale ?? {}, subs = (c.report.disagreement_subcategories ?? []) as any[];
    if (!(S.max > S.min)) { f.push(`REPORT.md disagreement_scale max (${S.max}) must be greater than min (${S.min})`); return f; }
    for (const s of subs) if (!(s.level >= S.min && s.level <= S.max)) f.push(`REPORT.md subcategory ${s.id} level ${s.level} is outside disagreement_scale ${S.min} to ${S.max}`);
    const ids = new Set(subs.map((s) => s.id));
    for (const b of c.books) {
      if (!b.root) continue;
      const bad = new Map<string, number>();
      walk(b.root, (n) => {
        if (n.t !== "note" || n.a.type !== "severity") return;
        const lvl = Number(n.a.n);
        if (!Number.isInteger(lvl) || lvl < S.min || lvl > S.max) bad.set(`severity n="${n.a.n}" is outside ${S.min} to ${S.max}`, (bad.get(`severity n="${n.a.n}" is outside ${S.min} to ${S.max}`) ?? 0) + 1);
        if (!ids.has(n.a.subtype)) bad.set(`severity subtype "${n.a.subtype}" is not a disagreement_subcategories id in REPORT.md`, (bad.get(`severity subtype "${n.a.subtype}" is not a disagreement_subcategories id in REPORT.md`) ?? 0) + 1);
      });
      for (const [k, n] of bad) f.push(`${b.name}: ${k}${n > 1 ? ` (${n} times)` : ""}`);
    }
    return f;
  },
  "no-em-dash": (c) => {
    const f: string[] = [];
    const files: [string, string][] = [["manifest.json", c.manifestRaw], ["REPORT.md", c.reportRaw], ...c.books.map((b) => [b.name, b.text] as [string, string])];
    for (const [name, text] of files) {
      const i = text.indexOf("\u2014");
      if (i >= 0) f.push(`${name}:${text.slice(0, i).split("\n").length}: contains an em dash (U+2014)`);
    }
    return f;
  },
};

/** Validates one compilation folder against a contract. Returns every problem, each prefixed with the folder. */
export async function validateCompilation(contract: Contract, input: CompilationInput): Promise<{ fails: string[]; books: number }> {
  const { dir, at } = input;
  const fails: string[] = [];
  const say = (m: string) => fails.push(`${at}/${m}`);
  const compId = dir.replace(/\/+$/, "").split("/").pop()!;
  const read = (f: string) => (existsSync(`${dir}/${f}`) ? readFileSync(`${dir}/${f}`, "utf8") : undefined);

  const manifestRaw = read("manifest.json");
  let manifest: any = {};
  if (manifestRaw === undefined) say("manifest.json: missing");
  else {
    try { manifest = JSON.parse(manifestRaw); } catch (e) { say(`manifest.json: not valid JSON (${e})`); }
    for (const m of jsonValidator(manifestSchemaWithoutShortTitle(contract.text["manifest.schema.json"]), contract.origin["manifest.schema.json"])(manifest)) say(`manifest.json: ${m}`);
  }

  const reportRaw = read("REPORT.md");
  let report: any = {}, reportBody = "";
  if (reportRaw === undefined) say("REPORT.md: missing");
  else {
    const m = reportRaw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/);
    if (!m) say("REPORT.md: must start with YAML front matter between two --- lines");
    else {
      try { report = Bun.YAML.parse(m[1]) ?? {}; } catch (e) { say(`REPORT.md: front matter is not valid YAML (${e})`); }
      reportBody = m[2];
      // YAML may read an unquoted date and time as a date; the contract compares it as text.
      const asJson = JSON.parse(JSON.stringify(report));
      for (const e of jsonValidator(contract.text["report.schema.json"], contract.origin["report.schema.json"])(asJson)) say(`REPORT.md front matter: ${e}`);
      if (!reportBody.trim()) say("REPORT.md: the Markdown report after the front matter is empty");
    }
  }

  const books = readdirSync(dir).filter((f) => f.endsWith(".xml")).sort().map((name) => ({ name, text: readFileSync(`${dir}/${name}`, "utf8") as string, root: undefined as Node | undefined }));
  for (const [schema, file] of [["tei_all.rng", "official TEI P5 " + contract.info.teiAll.version], ["tei-shape.rng", "Open Lexis shape"]] as const) {
    for (const m of await relaxNg(books, contract.text[schema], `${contract.origin[schema]}, ${file}`)) say(m);
  }
  for (const b of books) b.root = parseXml(b.text) as Node;

  const ctx: Ctx = { ...input, compId, manifest, report, reportBody, reportRaw: reportRaw ?? "", manifestRaw: manifestRaw ?? "", books };
  for (const { id } of contract.info.crossChecks) {
    for (const m of CROSS_CHECKS[id](ctx)) fails.push(`${at}: ${m} (contract rule ${id})`);
  }
  return { fails, books: books.length };
}
