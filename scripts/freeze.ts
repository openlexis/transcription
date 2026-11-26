#!/usr/bin/env bun
/**
 * Writes the transcript list into a specification YAML: every transcript the specification will consider, one line per
 * transcript, each with its repository path and the git commit that holds it, at the end of `specifications/<ULID>.yaml`.
 * Book, language, date, license and archive details are not copied there; the compiler and site read them from the
 * transcript and its catalog at that same commit (`git show <commit>:<path>`), so later changes to `archives/` do not
 * change what the specification means.
 *
 * Usage:
 *   bun run spec:freeze <SPEC_ULID> --from <older-spec-id>     (use the selection an older specification states)
 *   bun run spec:freeze <SPEC_ULID> <set-ULID | archive:id> ... (state the selection directly)
 *   bun run spec:freeze <SPEC_ULID> --replace --from <older-spec-id>
 *
 * `specifications/<SPEC_ULID>.yaml` (or a folder specification) must already exist. If `sources` already lists
 * transcripts (or any other populated sources list), the command refuses unless `--replace` is given, which replaces
 * that list.
 *
 * Every selected transcript must be committed with no uncommitted changes.
 *
 * It also writes a `records:` list after it: the archive record of each transcript (archives/transcriptions/...yaml) and of
 * its manuscript (archives/manuscripts/<id>.yaml), each with the commit that holds it, so what the specification knows about
 * a manuscript and its transcriptions (docs/archive-records.md) is fixed as well. These records must be committed too.
 */
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { findSpecPath, folderSpecFile, isFolderSpec, isPinnedList, resolveSelection } from "./sources";
import { setTopLevelBlock } from "./lib/spec";
import { manuscriptPath, transcriptionPath } from "./lib/records";

const ROOT = new URL("..", import.meta.url).pathname;
const git = (...args: string[]) => {
  const r = spawnSync("git", args, { cwd: ROOT, encoding: "utf8", maxBuffer: 1 << 30 });
  if (r.status !== 0) throw new Error(`git ${args.join(" ")}: ${r.stderr}`);
  return r.stdout;
};

const args = process.argv.slice(2).filter((a) => a !== "--replace");
const replace = process.argv.includes("--replace");
const specId = args[0];
if (!specId || !/^[0-9A-HJKMNP-TV-Z]{26}$/.test(specId)) {
  console.error("Usage: bun run spec:freeze <SPEC_ULID> [--replace] (--from <older-spec-id> | <set-ULID|archive:id> ...)");
  process.exit(1);
}
const yamlPath = existsSync(`${ROOT}specifications/${specId}.yaml`)
  ? `${ROOT}specifications/${specId}.yaml`
  : folderSpecFile(specId);
if (!existsSync(yamlPath)) throw new Error(`Write specifications/${specId}.yaml first`);
const yamlText = readFileSync(yamlPath, "utf8");
const yaml = Bun.YAML.parse(yamlText) as { id: string; sources: unknown };
if (yaml.id !== specId) throw new Error(`${yamlPath.slice(ROOT.length)} has id ${yaml.id}, expected ${specId}`);
const populated =
  (Array.isArray(yaml.sources) && yaml.sources.length > 0) ||
  (yaml.sources != null && yaml.sources !== "sources.json" && typeof yaml.sources === "object" && !Array.isArray(yaml.sources) && Object.keys(yaml.sources as object).length > 0);
if (populated && !replace) {
  throw new Error(
    `${yamlPath.slice(ROOT.length)} already has a sources list; pass --replace to replace it (a published specification should not be changed; make a new one with a new ULID instead)`
  );
}

let selection: string[];
const fromIdx = args.indexOf("--from");
if (fromIdx >= 0) {
  const fromPath = findSpecPath(args[fromIdx + 1]);
  const from = Bun.YAML.parse(readFileSync(fromPath, "utf8")) as { sources: unknown };
  if (isPinnedList(from.sources)) {
    throw new Error("--from a specification whose sources are already a transcript list is not a selection; use a single-file specification that lists set ULIDs, or pass set ULIDs");
  }
  if (isFolderSpec(fromPath)) {
    const prev = JSON.parse(readFileSync(fromPath.replace(/specification\.yaml$/, "sources.json"), "utf8")) as { selection?: string[] };
    if (!prev.selection?.length) throw new Error("--from a folder specification needs one whose sources.json still records a selection; use a single-file specification or pass set ULIDs");
    selection = prev.selection;
  } else {
    const s = from.sources;
    if (!Array.isArray(s) || !s.every((x) => typeof x === "string")) throw new Error("--from needs a specification whose sources are a list of set ULIDs or archive:id items");
    selection = s as string[];
  }
} else selection = args.slice(1);
if (!selection.length) throw new Error("No selection given");

const { sources } = resolveSelection(selection);

const paths = new Set(sources.flatMap((s) => s.files.flatMap((f) => f.paths)));
// the archive records of the selected transcripts and of their manuscripts
const recordPaths = new Set<string>();
for (const p of paths) {
  const t = transcriptionPath(p);
  if (!existsSync(`${ROOT}${t}`)) throw new Error(`No archive record ${t}: run bun scripts/records.ts and commit it`);
  recordPaths.add(t);
  const m = manuscriptPath((Bun.YAML.parse(readFileSync(`${ROOT}${t}`, "utf8")) as { manuscript: string }).manuscript);
  if (existsSync(`${ROOT}${m}`)) recordPaths.add(m);
}
const all = new Set([...paths, ...recordPaths]);
const dirty = git("status", "--porcelain", "--", "archives")
  .split("\n").filter(Boolean).map((l) => l.slice(3).replace(/^.* -> /, ""));
const dirtyHit = dirty.filter((p) => all.has(p) || [...all].some((a) => a.startsWith(p.endsWith("/") ? p : `${p}/`)));
if (dirtyHit.length) throw new Error(`Commit these transcripts and records first: ${dirtyHit.slice(0, 5).join(", ")}${dirtyHit.length > 5 ? " ..." : ""}`);
const commitOf = new Map<string, string>();
let cur = "";
for (const line of git("log", "--format=%x00%H", "--name-only", "HEAD", "--", "archives").split("\n")) {
  if (line.startsWith("\0")) cur = line.slice(1);
  else if (line && all.has(line) && !commitOf.has(line)) commitOf.set(line, cur);
}
const missing = [...all].filter((p) => !commitOf.has(p));
if (missing.length) throw new Error(`Not committed: ${missing.slice(0, 5).join(", ")}`);

const transcripts = [...paths].sort().map((path) => ({ path, commit: commitOf.get(path)! }));
const records = [...recordPaths].sort().map((path) => ({ path, commit: commitOf.get(path)! }));
const list =
  "sources:\n" +
  transcripts.map((t) => `  - {path: ${t.path}, commit: ${t.commit}}\n`).join("");
const recordList = "records:\n" + records.map((t) => `  - {path: ${t.path}, commit: ${t.commit}}\n`).join("");
writeFileSync(yamlPath, setTopLevelBlock(setTopLevelBlock(yamlText, "records", ""), "sources", list) + recordList);
console.log(`Wrote ${transcripts.length} transcripts and ${records.length} archive records into ${yamlPath.slice(ROOT.length)}.`);
