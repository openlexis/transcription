// Validator for TEI P5 XML compilation artifacts in outputs/<specification-id>/<compilation-id>/.
//   bun run check
import { createHash } from "node:crypto";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { parseXml } from "./lib/tei";

const t0 = performance.now();
const ROOT = new URL("..", import.meta.url).pathname;
const sha = (x: string | Buffer) => createHash("sha256").update(x).digest("hex");
const fails: string[] = [];

if (!existsSync(`${ROOT}outputs`)) {
  console.error("FAILED: no outputs/ directory found");
  process.exit(1);
}

let compilations = 0, booksChecked = 0, appsChecked = 0, certChecked = 0, witsChecked = 0;

for (const specId of readdirSync(`${ROOT}outputs`).sort()) {
  const specPath = `${ROOT}specifications/${specId}.yaml`;
  if (!existsSync(specPath)) {
    fails.push(`outputs/${specId}: no matching specifications/${specId}.yaml`);
    continue;
  }
  const spec = Bun.YAML.parse(readFileSync(specPath, "utf8")) as { id: string; targets: { id: string }[] };
  for (const compId of readdirSync(`${ROOT}outputs/${specId}`).sort()) {
    const dir = `${ROOT}outputs/${specId}/${compId}`, at = `outputs/${specId}/${compId}`;
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
    const listedIds = new Set((M.books ?? []).map((b: any) => b.id));
    for (const t of spec.targets) {
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
