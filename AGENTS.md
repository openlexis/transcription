# Open Lexis Transcription: Agent & Model Guide

This repository contains primary ancient biblical manuscript archives (`archives/`), immutable specifications (`specifications/<ULID>/`, and older single files `specifications/<ULID>.yaml`), compiled critical-text transcripts (`transcripts/<spec-id>/<compilation-id>/`), and a static Astro viewer (`site/`).

Use this guide whenever asked to **implement a specification and produce a new compilation**.

---

## 1. Non-Negotiable Rules

1. **Strict allowlist:** Read **only** the specification you were assigned and the transcripts it lists. For a specification whose `sources` is a transcript list in `specifications/<SPEC_ID>.yaml`, that is this file and each transcript in `sources`, read at its recorded commit (`git show <commit>:<path>`), with book, language, date, license and archive details read from that transcript and its catalog at the same commit. For a specification folder, that is `specifications/<SPEC_ID>/specification.yaml`, `specifications/<SPEC_ID>/sources.json`, and each transcript in `sources.json` read the same way. For an older single-file specification whose `sources` names set ULIDs, it is the ULID set files (`archives/sets/<ULID>.json`) and catalogs (`archives/<archive>/index.json`) it references and the XML files those catalog entries name. Never roam `archives/` or ingest unreferenced files.
2. **Total exclusion of outside material:** Never consult or import printed/critical editions, translations, modern reconstructions, facsimiles, external scholarly commentary, or anything under `site/` (including UI-only word glosses in `site/src/data/`).
3. **Never fabricate metadata:** If a metadata field (e.g., provenance, scientific dating) is absent from the transcript's catalog (`archives/<archive>/index.json`) at its pinned commit (or, for an older single-file specification, from the working-tree catalog), record it explicitly as unknown and let it widen uncertainty rather than imputing it.
4. **Never modify existing specs, source sets, or previous compilations:** Always write your compilation to a **brand-new** directory `transcripts/<SPEC_ID>/<NEW_COMPILATION_ULID>/` using a freshly generated 26-character Crockford Base32 ULID.
5. **Own your modeling decisions:** You are free to design your own statistical model, alignment strategy, and disagreement taxonomy; do not blindly copy an earlier model's parameters if you believe a better approach furthers recovery of the original text. You may reuse deterministic I/O helpers (`scripts/sources.ts`, `scripts/lib/readers.ts`, `scripts/lib/tei.ts`) to parse input files without rewriting boilerplate.
6. **Honest attribution:** Record your exact provider, model family, model name, exact model ID, effort/reasoning tier, and harness in both `manifest.json` and `REPORT.md`.
7. **No em dashes:** Em dashes (Unicode `U+2014` or HTML entities such as `&mdash;` / `&#8212;`) are disallowed everywhere in the project, including documentation, website UI copy, code comments, scripts, new specifications, and new compilation outputs (`manifest.json`, `REPORT.md`, and TEI XML titles/notes). Use commas, colons, semicolons, parentheses, periods, or middle dots (`·`) instead.
8. **Specifications are frozen once published:** Once a specification is published (committed to the shared repository), it must never be changed. Any change needs a new specification with a new ULID.

---

## 2. Quick-Start Workflow

```bash
# 1. Inspect the specification and its permitted sources
bun run sources summary --spec <SPEC_ID>
bun run sources targets --spec <SPEC_ID>
bun run sources list --spec <SPEC_ID> --target Matt --json

# 2. Mint a fresh 26-char ULID for your compilation
bun -e 'import { generateUlid } from "./scripts/compile.ts"; console.log(generateUlid());'

# 3. Read the output contract the specification pins, and write fill-in templates of every output file
bun run contract show <SPEC_ID>
bun run contract skeleton <SPEC_ID> /tmp/skeleton

# 4. Run your compilation -> transcripts/<SPEC_ID>/<COMPILATION_ULID>/
#    Must produce: <BookId>.xml (one per target book), manifest.json, REPORT.md

# 5. Validate every output file against the contract
bun run check

# 6. Rebuild the static Astro site so your compilation appears in the viewer
bun run site
```

### Pinned specifications

Words used here:

- **Specification file:** `specifications/<ULID>.yaml`, a single file holding the rules and, at the end, the transcript list.
- **Transcript list:** the `sources` field at the end of that file. Each transcript is one line, `{path: ..., commit: ...}`. Book, language, date, license and archive details are read from the transcript and its catalog (`archives/<archive>/index.json`) at that same commit.
- **Pinned transcript:** a transcript (and its catalog) read as they are in the recorded commit (`git show <commit>:<path>`), so later edits, moves or deletions under `archives/` do not change what a specification uses.
- **License:** every specification file must include a required `license` field. `bun run check` fails if it is missing.

```yaml
license:
  copyright: Copyright 2026 Open Lexis
  name: CC BY-NC 4.0
  url: https://creativecommons.org/licenses/by-nc/4.0/
```

Where a compilation records this license is set by the output contract (section 3).

A specification file needs nothing else in the repository except the transcripts and their catalogs, which are read at their commits. Older folder specifications (`specifications/<ULID>/specification.yaml` and `sources.json`) and older single-file specifications whose `sources` name set ULIDs stay as committed and are still read those ways. To make a new specification:

```bash
# 1. Mint a ULID and write specifications/<ULID>.yaml (rules only; `sources` may be empty or `sources: sources.json`)
bun -e 'import { ulid } from "./scripts/sets.ts"; console.log(ulid());'

# 2. Write the transcript list at the end of that file from a selection (an older specification's set ULIDs, or set ULIDs and <archive>:<id> items).
#    Every selected transcript must be committed first. If `sources` already lists transcripts, the command refuses unless you pass --replace, which replaces that list.
bun run spec:freeze <ULID> --from <OLDER_SPEC_ID>
bun run spec:freeze <ULID> --replace --from <OLDER_SPEC_ID>

# 3. Write the contract list at the end of that file: every file in contract/, one line each, with the git commit that holds it.
#    The contract files must be committed first. If the file already has a contract list, the command refuses unless you pass --replace.
bun run spec:contract <ULID>
bun run spec:contract <ULID> --replace

# 4. Check it, then commit the file
bun run check
```

`bun run check` confirms every listed transcript and contract file exists at its recorded commit. Folder specifications are still checked the earlier way (only those two files, IDs match).

---

## 3. Required Output Contract

The output contract is defined only in machine-readable files in [`contract/`](contract/), written in open standards, and nowhere else:

| File | What it defines | Standard |
|---|---|---|
| `contract/contract.json` | The files a compilation holds, the official TEI schema's version and SHA-256, and the named checks across files | JSON |
| `contract/manifest.schema.json` | `manifest.json` | JSON Schema 2020-12 (the common standard for describing the shape of JSON data) |
| `contract/report.schema.json` | The YAML front matter at the top of `REPORT.md` | JSON Schema 2020-12 |
| `contract/tei_all.rng` | Valid TEI P5 (official schema, unchanged) | RELAX NG (a standard schema language for XML) |
| `contract/tei-shape.rng` | The Open Lexis layout of each `<BookId>.xml` | RELAX NG |

A specification pins these files by git commit in its `contract` list (written by `bun run spec:contract`), so later edits to `contract/` never change what a published specification requires. Read the rules for your specification, in plain language, from the pinned files:

```bash
bun run contract show <SPEC_ID>                    # every rule, field by field and element by element
bun run contract skeleton <SPEC_ID> <folder>       # fill-in templates: manifest.json, REPORT.md, book.template.xml
bun run check --spec <SPEC_ID> --dir <folder>      # validate one compilation folder (add --books Obad for a partial trial)
```

`bun run check` validates every compilation of a specification that has a contract list against that pinned contract: both JSON Schemas, both RELAX NG schemas, and each named check in `contract.json`. Every failure names the file, the line where there is one, and the contract file or rule it breaks.

Specifications without a contract list (made before the contract existed) keep the earlier built-in checks in `scripts/check.ts`; the output format they refer to is described in this file as it was when they were published (see its history with `git log -p -- AGENTS.md`).

---

## 4. Verification Checklist

Before finishing, run:

```bash
bun run check && bun run site
```

Both commands must exit `0` with zero warnings or missing books.
