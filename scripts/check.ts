// Validator for TEI P5 XML compilation artifacts in transcripts/<specification-id>/<compilation-id>/.
//   bun run check
import { createHash } from "node:crypto";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { parseXml } from "./lib/tei";
import { loadSpecWithSources } from "./sources";

const t0 = performance.now();
const ROOT = new URL("..", import.meta.url).pathname;
const sha = (x: string | Buffer) => createHash("sha256").update(x).digest("hex");
const fails: string[] = [];

if (!existsSync(`${ROOT}transcripts`)) {
  console.error("FAILED: no transcripts/ directory found");
  process.exit(1);
}

let compilations = 0, booksChecked = 0, appsChecked = 0, certChecked = 0, witsChecked = 0;

for (const specId of readdirSync(`${ROOT}transcripts`).sort()) {
  const specPath = `${ROOT}specifications/${specId}.yaml`;
  if (!existsSync(specPath)) {
    fails.push(`transcripts/${specId}: no matching specifications/${specId}.yaml`);
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

const s = ((performance.now() - t0) / 1000).toFixed(2);
if (fails.length) {
  console.log(fails.slice(0, 50).join("\n"));
  console.log(`FAILED: ${fails.length} problems (${compilations} compilations, ${booksChecked} books, ${s} s)`);
  process.exit(1);
}
console.log(
  `OK: ${compilations} compilation(s), ${booksChecked} books, ${witsChecked} witness records, ${appsChecked} <app> elements, ${certChecked} <certainty> elements verified in ${s} s`,
);
