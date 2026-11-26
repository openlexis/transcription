# Open Lexis: Biblical Manuscript Transcriptions

Primary ancient manuscript transcriptions for the Old Testament (Biblical Hebrew and Biblical Aramaic) and New Testament (Koine Greek), paired with compact YAML specifications, immutable ULID source sets, and per-institution JSON catalogs.

## Repository Structure

- **[`specifications/`](specifications/):** One folder per specification, `specifications/<ULID>/`, holding `specification.yaml` (the rules) and `sources.json` (the transcript list: every transcript the specification considers, with its repository path and the git commit that holds it), made by `bun run spec:freeze`. Book, language, date, license and archive details are read from the transcript and its catalog at that same commit, so later changes to `archives/` do not change a specification. Older specifications are single files (`specifications/<ULID>.yaml`) whose `sources` list names source sets in `archives/sets/`; they stay as committed and are still read that way.
- **[`archives/sets/`](archives/sets/):** Immutable, content-hashed ULID snapshots (`archives/sets/<ULID>.json`) for every book and institution. When new material is added to `archives/`, running `bun run sets` mints a new ULID while preserving all previous snapshots untouched.
- **[`archives/<institution>/`](archives/):** The primary XML manuscript corpus across institutional directories, each with its own `index.json` catalog mapping source identifiers to metadata, licenses, and XML file paths.
- **[`transcripts/`](transcripts/):** Compiled TEI P5 XML transcripts organized as `transcripts/<specification-id>/<compilation-id>/`, containing one TEI P5 XML file per target book (`<book-id>.xml`), `manifest.json`, and a structured Markdown compilation report (`REPORT.md`).
- **[`scripts/`](scripts/):** Source-set compiler (`scripts/sets.ts`), programmatic source resolver (`scripts/sources.ts`), per-archive import scripts (`scripts/archives/`), compilation, and verification utilities.
- **[`site/`](site/):** Static Astro website resolving specification folders (`specifications/<ULID>/`), older single-file specifications with `archives/sets/*.json` and `archives/<institution>/index.json`, and every compilation under `transcripts/<specification-id>/<compilation-id>/`.

## Commands (Bun)

| Command | Description |
|---|---|
| `bun run sets` | Compile/update immutable ULID source sets in `archives/sets/` from `archives/<institution>/index.json` |
| `bun run spec:freeze <ULID> (--from <spec-id> \| <set-ULID\|archive:id> ...)` | Write `specifications/<ULID>/sources.json`, the transcript list of a new specification folder, from a selection |
| `bun run sources summary` | Show specification summary, pinned set count, and institution breakdown |
| `bun run sources targets` | List resolved target books with primary source counts and pinned ULIDs |
| `bun run sources list [--target Gen] [--institution intf] [--json]` | Filter permitted sources for a specification |
| `bun run sources get <id\|institution:id>` | Resolve full metadata and XML paths for one permitted source |
| `bun run compile [spec-id] [all \| <book>]` | Compile target books (default: the newest specification, 01M8B2PF9KBPWSTCJCJ6S5NJCE) into `transcripts/<spec-id>/<ulid>/` (with `REPORT.md` & `manifest.json`) and rebuild the Astro site |
| `bun run check` | Validate specification folders (only `specification.yaml` and `sources.json`; every listed transcript exists at its commit) and all TEI P5 XML compilations, manifests, and `REPORT.md` frontmatter in `transcripts/` |
| `bun run site` / `bun run site:build` | Build the static website into `site/www` |
| `bun run site:dev` | Start the Astro development server with live reload |
| `bun run site:preview` | Preview the built website (`site/www`) locally |
| `bun run site:install` | Install Astro website dependencies in `site/` |

## Compilation Report (`REPORT.md`) Schema

Every compilation directory `transcripts/<specification-id>/<compilation-id>/` must include a `REPORT.md` with YAML frontmatter describing what was performed (disagreement categories are **not prescribed**; each model/compiler defines whatever categories best characterize the disagreements it observed), followed by a plain-language Markdown narrative:

```markdown
---
specification_id: 01M88AX3YW2HWVPGHTREFJS181
compilation_id: <26-char-ULID>
created_at: 2026-11-25T00:00:00.000Z
model_attribution:
  provider: <Lab / Provider>
  model_family: <Family>
  model_name: <Human-readable Name>
  model_id: <Exact Model ID>
  effort_level: <Effort / Reasoning Tier>
  harness: <Harness / Runtime>
method_summary: <1-2 sentence summary of the statistical model>
disagreement_scale:
  min: 1
  max: 5
  description: <Description of your chosen numeric severity scale>
disagreement_categories:
  - id: <category-slug>
    label: <Human-readable Label>
    description: <What this category covers>
    count: 1234
disagreement_subcategories:
  - id: <subcategory-slug>
    label: <Human-readable Subcategory Label>
    level: 1
    level_label: <Display badge e.g. Minor (1/5)>
    description: <What this subcategory covers>
    local_confidence_effect: <Effect on local word/witness confidence>
    corpus_authenticity_effect: <Effect on overall witness/corpus authenticity>
    count: 567
authenticity_signal: <Optional summary of what observed error patterns imply about authenticity>
evidence_usage:
  dating: <How dating was used>
  provenance: <How provenance was handled / unknown>
  scientific_analysis: <How scientific dating was handled / unknown>
  physical_and_scribal: <How scribal corrections and physical damage were handled>
  textual_agreement: <How agreement was modeled>
totals:
  books: 66
  lines: 31195
  words: 444338
  variant_places: 34634
---

# Compilation Report
...
```

After producing a compilation, run `bun run check && bun run site` to verify all outputs and update `site/www`.

## Licenses

The ancient texts themselves are in the public domain. Each transcription retains the license stated by its source institution in `archives/<institution>/index.json` (primarily CC BY 4.0, with CC BY-SA 4.0 for CNTR, CC BY-NC-SA 3.0 for the Codex Sinaiticus Project, unrestricted copying for UXLC, and CC BY-NC 4.0 for the Samaritan Pentateuch and Dead Sea Scrolls datasets).
