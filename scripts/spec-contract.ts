#!/usr/bin/env bun
/**
 * Writes the contract list into a specification YAML: every file of the output contract (contract/), one line each, with
 * its path and the git commit that holds it, at the end of `specifications/<ULID>.yaml`. The compiler, `bun run check` and
 * `bun run contract show|skeleton` read the contract at those commits, so later edits to contract/ do not change what the
 * specification requires.
 *
 * Usage:
 *   bun run spec:contract <SPEC_ULID>
 *   bun run spec:contract <SPEC_ULID> --replace
 *
 * Refuses if the specification already has a contract list, unless --replace is given, which replaces it. Every contract
 * file must be committed with no uncommitted changes.
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { contractPins, currentContractPins } from "./lib/contract";
import { setTopLevelBlock } from "./lib/spec";

const ROOT = new URL("..", import.meta.url).pathname;
const args = process.argv.slice(2).filter((a) => a !== "--replace");
const replace = process.argv.includes("--replace");
const specId = args[0];
if (!specId || !/^[0-9A-HJKMNP-TV-Z]{26}$/.test(specId) || args.length > 1) {
  console.error("Usage: bun run spec:contract <SPEC_ULID> [--replace]");
  process.exit(1);
}
const rel = `specifications/${specId}.yaml`;
if (!existsSync(`${ROOT}${rel}`)) throw new Error(`Write ${rel} first`);
const text = readFileSync(`${ROOT}${rel}`, "utf8");
const yaml = Bun.YAML.parse(text) as Record<string, unknown>;
if (yaml.id !== specId) throw new Error(`${rel} has id ${yaml.id}, expected ${specId}`);
if ((contractPins(yaml) || yaml.contract != null) && !replace) {
  throw new Error(`${rel} already has a contract list; pass --replace to replace it (a published specification should not be changed; make a new one with a new ULID instead)`);
}
const pins = currentContractPins();
const block = "contract:\n" + pins.map((p) => `  - {path: ${p.path}, commit: ${p.commit}}\n`).join("");
writeFileSync(`${ROOT}${rel}`, setTopLevelBlock(text, "contract", block));
console.log(`Wrote ${pins.length} contract files into ${rel}.`);
