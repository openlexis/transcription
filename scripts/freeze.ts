#!/usr/bin/env bun
/**
 * Writes `specifications/<ULID>/sources.json` for a folder specification: every transcript the specification will consider,
 * each with an identifier, its repository path, and the git commit that holds it, plus the catalog details the compiler and
 * site use (books, dates, languages, licenses, source links). After this, the specification needs nothing outside its folder
 * except the transcripts, which are read at their recorded commits (`git show <commit>:<path>`), so later changes to
 * `archives/` do not change what the specification means.
 *
 * Usage:
 *   bun run spec:freeze <SPEC_ULID> --from <older-spec-id>     (use the selection an older specification states)
 *   bun run spec:freeze <SPEC_ULID> <set-ULID | archive:id> ... (state the selection directly)
 *
 * `specifications/<SPEC_ULID>/specification.yaml` must already exist with `sources: sources.json`. Every selected transcript
 * must be committed with no uncommitted changes. A `sources.json` that is already committed is never overwritten.
 */
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { findSpecPath, folderSpecFile, type FrozenSources, isFolderSpec, resolveSelection } from "./sources";

const ROOT = new URL("..", import.meta.url).pathname;
const git = (...args: string[]) => {
  const r = spawnSync("git", args, { cwd: ROOT, encoding: "utf8", maxBuffer: 1 << 30 });
  if (r.status !== 0) throw new Error(`git ${args.join(" ")}: ${r.stderr}`);
  return r.stdout;
};

const args = process.argv.slice(2);
const specId = args[0];
if (!specId || !/^[0-9A-HJKMNP-TV-Z]{26}$/.test(specId)) {
  console.error("Usage: bun run spec:freeze <SPEC_ULID> (--from <older-spec-id> | <set-ULID|archive:id> ...)");
  process.exit(1);
}
const yamlPath = folderSpecFile(specId);
if (!existsSync(yamlPath)) throw new Error(`Write specifications/${specId}/specification.yaml first`);
const yaml = Bun.YAML.parse(readFileSync(yamlPath, "utf8")) as { id: string; sources: unknown };
if (yaml.id !== specId) throw new Error(`specification.yaml has id ${yaml.id}, expected ${specId}`);
if (yaml.sources !== "sources.json") throw new Error(`specification.yaml must say "sources: sources.json"`);
const outRel = `specifications/${specId}/sources.json`;
if (git("ls-files", outRel).trim()) throw new Error(`${outRel} is already committed; a published specification never changes`);

let selection: string[];
const fromIdx = args.indexOf("--from");
if (fromIdx >= 0) {
  const fromPath = findSpecPath(args[fromIdx + 1]);
  if (isFolderSpec(fromPath)) {
    selection = (JSON.parse(readFileSync(fromPath.replace(/specification\.yaml$/, "sources.json"), "utf8")) as FrozenSources).selection;
  } else {
    const s = (Bun.YAML.parse(readFileSync(fromPath, "utf8")) as { sources: string[] }).sources;
    if (!Array.isArray(s)) throw new Error("--from needs a specification whose sources are a list");
    selection = s;
  }
} else selection = args.slice(1);
if (!selection.length) throw new Error("No selection given");

const { targets, sources } = resolveSelection(selection);

// The commit that holds each transcript: the last commit that changed it.
const paths = new Set(sources.flatMap((s) => s.files.flatMap((f) => f.paths)));
const dirty = git("status", "--porcelain", "--", ...new Set([...paths].map((p) => p.split("/").slice(0, 2).join("/"))))
  .split("\n").filter(Boolean).map((l) => l.slice(3).replace(/^.* -> /, ""));
const dirtyHit = dirty.filter((p) => paths.has(p));
if (dirtyHit.length) throw new Error(`Commit these transcripts first: ${dirtyHit.slice(0, 5).join(", ")}${dirtyHit.length > 5 ? " ..." : ""}`);
const commitOf = new Map<string, string>();
let cur = "";
for (const line of git("log", "--format=%x00%H", "--name-only", "HEAD", "--", "archives").split("\n")) {
  if (line.startsWith("\0")) cur = line.slice(1);
  else if (line && paths.has(line) && !commitOf.has(line)) commitOf.set(line, cur);
}
const missing = [...paths].filter((p) => !commitOf.has(p));
if (missing.length) throw new Error(`Not committed: ${missing.slice(0, 5).join(", ")}`);

const archives: FrozenSources["archives"] = {};
const frozen: FrozenSources = {
  specification: specId,
  description:
    "Every transcript this specification considers. Read each one at its commit (git show <commit>:<path>); the details here are copied from the archive catalogs when the specification was made.",
  createdAt: new Date().toISOString(),
  selection,
  books: targets.map(({ setId: _setId, ...b }) => b),
  archives,
  manuscripts: sources.map(({ files, ...m }) => ({
    ...m,
    files: files.map(({ paths: ps, provenance, transcripts: _t, ...f }) => {
      archives[provenance.id] = provenance;
      return {
        archive: provenance.id,
        ...f,
        transcripts: ps.map((p) => ({
          id: `${provenance.id}:${p.replace(`archives/${provenance.id}/`, "").replace(/\.xml$/, "")}`,
          path: p,
          commit: commitOf.get(p)!,
        })),
      };
    }),
  })),
};
frozen.archives = Object.fromEntries(Object.entries(archives).sort());
writeFileSync(`${ROOT}${outRel}`, JSON.stringify(frozen, null, 2) + "\n");
const n = frozen.manuscripts.reduce((a, m) => a + m.files.reduce((b, f) => b + f.transcripts.length, 0), 0);
console.log(`Wrote ${outRel}: ${frozen.books.length} books, ${frozen.manuscripts.length} manuscripts, ${n} transcripts.`);
