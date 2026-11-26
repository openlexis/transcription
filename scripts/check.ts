// Validator for TEI P5 XML compilation artifacts in transcripts/<specification-id>/<compilation-id>/.
//   bun run check
import { createHash } from "node:crypto";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { parseXml } from "./lib/tei";
import { spawnSync } from "node:child_process";
import { isPinnedList, listSpecs, loadSpecWithSources, type FrozenSources, type PinnedTranscript } from "./sources";
import { readSpecLicense, type SpecLicense } from "./lib/spec";
import { checkShortTitles } from "./lib/titles";
import { contractPins, loadPinnedContract, validateCompilation, type Contract } from "./lib/contract";
import { checkRecords } from "./lib/records-check";

// bun run check                              every specification and every compilation in transcripts/
// bun run check --spec <ULID> --dir <folder> [--books Obad,Jonah]
//   one compilation folder (for example a trial compile) against that specification's pinned contract; --books limits the
//   target books required to those named, for a trial that compiled only some books
const argv = process.argv.slice(2);
const argOf = (k: string) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : undefined; };
const onlySpec = argOf("--spec"), onlyDir = argOf("--dir"), onlyBooks = argOf("--books")?.split(",").filter(Boolean);
if (!!onlySpec !== !!onlyDir) { console.error("Usage: bun run check [--spec <ULID> --dir <compilation folder>]"); process.exit(1); }

const t0 = performance.now();
const ROOT = new URL("..", import.meta.url).pathname;
const sha = (x: string | Buffer) => createHash("sha256").update(x).digest("hex");
const fails: string[] = [];
const specLicenses = new Map<string, SpecLicense>();
/** Specifications that pin a contract (contract/): their compilations are validated against it. Others keep the earlier checks below. */
const specContracts = new Map<string, { contract: Contract; path: string; text: string }>();

if (!existsSync(`${ROOT}transcripts`)) {
  console.error("FAILED: no transcripts/ directory found");
  process.exit(1);
}

// Pinned transcripts (in the specification YAML, or in a folder's sources.json) must exist at their recorded commits.
let specFolders = 0, pinnedSpecs = 0, pinnedChecked = 0;
const checkPins = (at: string, pins: PinnedTranscript[]) => {
  if (!pins.length) { fails.push(`${at}: no transcripts listed`); return; }
  const r = spawnSync("git", ["cat-file", "--batch-check"], { cwd: ROOT, input: pins.map((t) => `${t.commit}:${t.path}`).join("\n") + "\n", encoding: "utf8", maxBuffer: 1 << 28 });
  const lines = r.stdout.trim().split("\n");
  pins.forEach((t, i) => { if (!lines[i] || lines[i].endsWith("missing")) fails.push(`${at}: ${t.path} not found at commit ${t.commit}`); });
  pinnedChecked += pins.length;
};
for (const { id, path } of listSpecs()) {
  const at = path.slice(ROOT.length);
  let spec: { id: string; sources: unknown };
  try { spec = Bun.YAML.parse(readFileSync(path, "utf8")) as { id: string; sources: unknown }; } catch (e) { fails.push(`${at}: ${e}`); continue; }
  if (spec.id !== id) fails.push(`${at}: id ${spec.id} does not match ${id}`);
  try {
    specLicenses.set(id, readSpecLicense(spec as unknown as Record<string, unknown>, at));
  } catch (e) {
    fails.push(String(e));
  }
  const cPins = contractPins(spec as unknown as Record<string, unknown>);
  if (cPins) {
    checkPins(`${at} contract`, cPins);
    try {
      specContracts.set(id, { contract: loadPinnedContract(cPins, at), path, text: readFileSync(path, "utf8") });
    } catch (e) {
      fails.push(String(e instanceof Error ? e.message : e));
    }
  }
  const recordPins = (spec as unknown as { records?: unknown }).records;
  if (recordPins !== undefined) {
    if (isPinnedList(recordPins)) checkPins(`${at} records`, recordPins);
    else fails.push(`${at}: records must be a list of {path, commit}`);
  }
  if (isPinnedList(spec.sources)) {
    pinnedSpecs++;
    checkPins(at, spec.sources);
    continue;
  }
  if (!path.endsWith("/specification.yaml")) continue;
  specFolders++;
  const folder = `specifications/${id}`;
  const extra = readdirSync(`${ROOT}${folder}`).filter((f) => f !== "specification.yaml" && f !== "sources.json");
  if (extra.length) fails.push(`${folder}: unexpected files ${extra.join(", ")} (a specification folder holds specification.yaml and sources.json)`);
  if (!existsSync(`${ROOT}${folder}/sources.json`)) { fails.push(`${folder}: missing sources.json`); continue; }
  if (spec.sources !== "sources.json") fails.push(`${at}: sources must be "sources.json"`);
  const frozen = JSON.parse(readFileSync(`${ROOT}${folder}/sources.json`, "utf8")) as FrozenSources;
  if (frozen.specification !== id) fails.push(`${folder}/sources.json: specification ${frozen.specification} does not match its folder`);
  const pins = frozen.transcripts?.length
    ? frozen.transcripts
    : (frozen.manuscripts ?? []).flatMap((m) => m.files.flatMap((f) => f.transcripts));
  checkPins(`${folder}/sources.json`, pins);
}

let compilations = 0, booksChecked = 0, appsChecked = 0, certChecked = 0, witsChecked = 0, contractChecked = 0;

/** Validates one compilation folder against its specification's pinned contract. */
async function checkWithContract(specId: string, dir: string, at: string) {
  const c = specContracts.get(specId)!;
  const all = loadSpecWithSources(specId).targets;
  const targets = onlyBooks ? all.filter((t) => onlyBooks.includes(t.id)) : all;
  if (onlyBooks) for (const b of onlyBooks) if (!all.some((t) => t.id === b)) fails.push(`--books ${b}: not a target book of ${specId}`);
  const r = await validateCompilation(c.contract, { specId, specPath: c.path, specText: c.text, license: specLicenses.get(specId)!, targets, dir, at });
  fails.push(...r.fails);
  compilations++;
  contractChecked++;
  booksChecked += r.books;
}

if (onlyDir) {
  const dir = onlyDir.replace(/\/+$/, "");
  if (!specContracts.has(onlySpec!)) fails.push(`${onlySpec}: no such specification, or it has no contract list (only specifications with a contract can check a folder)`);
  else if (!existsSync(dir)) fails.push(`${dir}: no such folder`);
  else await checkWithContract(onlySpec!, dir, dir);
}

for (const specId of onlyDir ? [] : readdirSync(`${ROOT}transcripts`).sort()) {
  if (specContracts.has(specId)) {
    for (const compId of readdirSync(`${ROOT}transcripts/${specId}`).sort()) await checkWithContract(specId, `${ROOT}transcripts/${specId}/${compId}`, `transcripts/${specId}/${compId}`);
    continue;
  }

  if (!listSpecs().some((s) => s.id === specId)) {
    fails.push(`transcripts/${specId}: no matching specification in specifications/`);
    continue;
  }
  const { targets: specTargets } = loadSpecWithSources(specId);
  for (const compId of readdirSync(`${ROOT}transcripts/${specId}`).sort()) {
    const dir = `${ROOT}transcripts/${specId}/${compId}`, at = `transcripts/${specId}/${compId}`;
    const mfPath = `${dir}/manifest.json`;
    if (!existsSync(mfPath)) {
      fails.push(`${at}: missing manifest.json`);
      continue;
    }
    compilations++;
    const M = JSON.parse(readFileSync(mfPath, "utf8"));
    if (M.specification?.id !== specId) fails.push(`${at}: manifest specification.id mismatch`);
    if (M.compilation?.id !== compId) fails.push(`${at}: manifest compilation.id mismatch`);
    const license = specLicenses.get(specId);
    if (license) {
      const lic = M.specification?.license;
      if (!lic || lic.copyright !== license.copyright || lic.name !== license.name || lic.url !== license.url) {
        fails.push(`${at}: manifest specification.license does not match the specification`);
      }
    }
    if (!M.modelAttribution?.modelName) fails.push(`${at}: missing modelAttribution`);
    if (!M.method?.description) fails.push(`${at}: missing method description`);

    // Validate structured REPORT.md with YAML frontmatter
    const reportPath = `${dir}/REPORT.md`;
    if (!existsSync(reportPath)) {
      fails.push(`${at}: missing REPORT.md`);
    } else {
      const repRaw = readFileSync(reportPath, "utf8");
      const fmMatch = repRaw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/);
      if (!fmMatch) {
        fails.push(`${at}/REPORT.md: missing YAML frontmatter (--- ... ---)`);
      } else {
        try {
          const fm = Bun.YAML.parse(fmMatch[1]) as Record<string, any>;
          if (fm.specification_id !== specId) fails.push(`${at}/REPORT.md: frontmatter specification_id mismatch`);
          if (fm.compilation_id !== compId) fails.push(`${at}/REPORT.md: frontmatter compilation_id mismatch`);
          if (!fm.model_attribution?.model_name) fails.push(`${at}/REPORT.md: frontmatter missing model_attribution.model_name`);
          if (!fm.method_summary || typeof fm.method_summary !== "string") fails.push(`${at}/REPORT.md: frontmatter missing method_summary`);
          if (!Array.isArray(fm.disagreement_categories) || !fm.disagreement_categories.length) {
            fails.push(`${at}/REPORT.md: frontmatter missing non-empty disagreement_categories`);
          } else {
            for (const cat of fm.disagreement_categories) {
              if (!cat.id || !cat.label || !cat.description || typeof cat.count !== "number" || cat.count < 0) {
                fails.push(`${at}/REPORT.md: invalid disagreement_categories entry ${JSON.stringify(cat)}`);
              }
            }
          }
          const subcats = fm.disagreement_subcategories ?? fm.disagreement_severities;
          if (subcats !== undefined) {
            if (!Array.isArray(subcats) || !subcats.length) {
              fails.push(`${at}/REPORT.md: disagreement_subcategories must be a non-empty array`);
            } else {
              const scaleMin = typeof fm.disagreement_scale?.min === "number" ? fm.disagreement_scale.min : undefined;
              const scaleMax = typeof fm.disagreement_scale?.max === "number" ? fm.disagreement_scale.max : undefined;
              for (const sc of subcats) {
                if (!sc.id || !sc.label || typeof sc.level !== "number" || !sc.description) {
                  fails.push(`${at}/REPORT.md: invalid disagreement_subcategories entry ${JSON.stringify(sc)}`);
                }
                if (scaleMin !== undefined && scaleMax !== undefined && (sc.level < scaleMin || sc.level > scaleMax)) {
                  fails.push(`${at}/REPORT.md: subcategory ${sc.id} level ${sc.level} outside disagreement_scale [${scaleMin}, ${scaleMax}]`);
                }
              }
            }
          }
          if (!fmMatch[2].trim()) fails.push(`${at}/REPORT.md: empty Markdown body`);
        } catch (err) {
          fails.push(`${at}/REPORT.md: invalid YAML frontmatter (${err})`);
        }
      }
    }
    const listedIds = new Set((M.books ?? []).map((b: any) => b.id));
    for (const t of specTargets) {
      if (!listedIds.has(t.id)) fails.push(`${at}: missing target book ${t.id} in manifest`);
    }

    for (const b of M.books ?? []) {
      booksChecked++;
      const fPath = `${dir}/${b.file}`;
      if (!existsSync(fPath)) {
        fails.push(`${at}/${b.file}: file missing`);
        continue;
      }
      const xml = readFileSync(fPath, "utf8");
      if (sha(xml) !== b.sha256) fails.push(`${at}/${b.file}: SHA-256 mismatch vs manifest`);
      if (!xml.includes('xmlns="http://www.tei-c.org/ns/1.0"')) fails.push(`${at}/${b.file}: missing TEI P5 namespace`);
      if (!xml.includes(specId)) fails.push(`${at}/${b.file}: missing specification ID ${specId}`);
      if (!xml.includes(compId)) fails.push(`${at}/${b.file}: missing compilation ID ${compId}`);
      if (license) {
        if (!xml.includes(`<licence target="${license.url}">`) || !xml.includes(license.copyright) || !xml.includes(license.name)) {
          fails.push(`${at}/${b.file}: missing specification license in TEI availability/licence`);
        }
      }

      // Parse XML to verify well-formedness & structural invariants
      const root = parseXml(xml);
      const declaredWits = new Set<string>();
      let hasHeader = false, hasListWit = false;
      const walk = (n: any) => {
        if (typeof n === "string") return;
        if (n.t === "teiHeader") hasHeader = true;
        if (n.t === "listWit") hasListWit = true;
        if (n.t === "witness" && n.a.id) {
          declaredWits.add(`#${n.a.id}`);
          witsChecked++;
        }
        if (n.t === "app") {
          appsChecked++;
          const hasLem = n.c.some((c: any) => typeof c !== "string" && c.t === "lem");
          const rdgs = n.c.filter((c: any) => typeof c !== "string" && c.t === "rdg");
          if (!hasLem) fails.push(`${at}/${b.file}: <app ${n.a.id}> missing <lem>`);
          if (!rdgs.length) fails.push(`${at}/${b.file}: <app ${n.a.id}> missing <rdg>`);
          for (const r of rdgs) {
            if (r.a.wit) {
              for (const ref of r.a.wit.split(/\s+/).filter(Boolean)) {
                if (!declaredWits.has(ref)) fails.push(`${at}/${b.file}: undeclared witness ref ${ref} in <app ${n.a.id}>`);
              }
            }
          }
        }
        if (n.t === "certainty") {
          certChecked++;
          const d = Number(n.a.degree);
          if (Number.isNaN(d) || d < 0 || d > 1) fails.push(`${at}/${b.file}: invalid certainty degree ${n.a.degree}`);
        }
        for (const c of n.c) walk(c);
      };
      walk(root);
      if (!hasHeader) fails.push(`${at}/${b.file}: missing <teiHeader>`);
      if (!hasListWit || !declaredWits.size) fails.push(`${at}/${b.file}: missing or empty <listWit>`);
    }
  }
}

// Short titles: every specification and every transcription needs one, at most 40 characters (scripts/lib/titles.ts).
if (!onlyDir) {
  const specs = listSpecs().flatMap(({ id, path }) => {
    try { return [{ id, at: path.slice(ROOT.length), raw: Bun.YAML.parse(readFileSync(path, "utf8")) as Record<string, unknown> }]; } catch { return []; }
  });
  const comps = readdirSync(`${ROOT}transcripts`).sort().flatMap((specId) =>
    readdirSync(`${ROOT}transcripts/${specId}`).sort().flatMap((compId) => {
      const at = `transcripts/${specId}/${compId}`, mf = `${ROOT}${at}/manifest.json`;
      if (!existsSync(mf)) return [];
      try { return [{ at, shortTitle: JSON.parse(readFileSync(mf, "utf8")).compilation?.shortTitle }]; } catch { return []; }
    }),
  );
  fails.push(...checkShortTitles(ROOT, specs, comps));
}

// The archive records: one YAML file per manuscript and per transcription file (docs/archive-records.md).
const rec = onlyDir ? undefined : checkRecords(ROOT);
if (rec) fails.push(...rec.fails);

const s = ((performance.now() - t0) / 1000).toFixed(2);
if (fails.length) {
  console.log(fails.slice(0, 50).join("\n"));
  console.log(`FAILED: ${fails.length} problems (${compilations} compilations, ${booksChecked} books, ${s} s)`);
  process.exit(1);
}
console.log(
  `OK: ${pinnedSpecs} specification(s) with an embedded transcript list, ${specFolders} specification folder(s), ${pinnedChecked} pinned transcripts, ${compilations} compilation(s) (${contractChecked} against a pinned contract), ${booksChecked} books, ${witsChecked} witness records, ${appsChecked} <app> elements, ${certChecked} <certainty> elements${rec ? `, ${rec.manuscripts} manuscript and ${rec.transcriptions} transcription records (${rec.quotes} quotes found in their files)` : ""} verified in ${s} s`,
);
