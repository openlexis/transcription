# Open Lexis: Biblical Manuscript Transcriptions

Primary ancient manuscript transcriptions for the Old Testament (Biblical Hebrew and Biblical Aramaic) and New Testament (Koine Greek), paired with compact YAML specifications, immutable ULID source sets, and per-institution JSON catalogs.

## Repository Structure

- **[`specifications/`](specifications/):** Compact specification YAML files (currently [`specifications/01M88AX3YW2HWVPGHTREFJS181.yaml`](specifications/01M88AX3YW2HWVPGHTREFJS181.yaml), ~11 KB). Each specification defines its rules and a single `sources` list of immutable ULID set snapshots (and/or direct `<institution>:<id>` items).
- **[`src/sets/`](src/sets/):** Immutable, content-hashed ULID snapshots (`src/sets/<ULID>.json`) for every book and institution. When new material is added to `src/`, running `bun run sets` mints a new ULID while preserving all previous snapshots untouched.
- **[`src/<institution>/`](src/):** The primary XML manuscript corpus across 14 institutional directories, each with its own `index.json` catalog mapping source identifiers to metadata, licenses, and XML file paths.
- **[`outputs/`](outputs/):** Compiled TEI P5 XML outputs organized as `outputs/<specification-id>/<compilation-id>/`, containing one TEI P5 XML file per target book (`<book-id>.xml`), `manifest.json`, and a structured Markdown compilation report (`REPORT.md`).
- **[`scripts/`](scripts/):** Source-set compiler (`scripts/sets.ts`), programmatic source resolver (`scripts/sources.ts`), import, compilation, and verification utilities.
- **[`site/`](site/):** Static Astro website resolving `specifications/*.yaml`, `src/sets/*.json`, `src/<institution>/index.json`, and every compilation under `outputs/<specification-id>/<compilation-id>/`.

## Commands (Bun)

| Command | Description |
|---|---|
| `bun run sets` | Compile/update immutable ULID source sets in `src/sets/` from `src/<institution>/index.json` |
| `bun run sources summary` | Show specification summary, pinned set count, and institution breakdown |
| `bun run sources targets` | List resolved target books with primary source counts and pinned ULIDs |
| `bun run sources list [--target Gen] [--institution intf] [--json]` | Filter permitted sources for a specification |
| `bun run sources get <id\|institution:id>` | Resolve full metadata and XML paths for one permitted source |
| `bun run compile [spec-id] [all \| <book>]` | Compile target books into `outputs/<spec-id>/<ulid>/` (with `REPORT.md` & `manifest.json`) and rebuild the Astro site |
| `bun run check` | Validate all TEI P5 XML compilations, manifests, and `REPORT.md` frontmatter in `outputs/` |
| `bun run site` / `bun run site:build` | Build the static website into `site/www` |
| `bun run site:dev` | Start the Astro development server with live reload |
| `bun run site:preview` | Preview the built website (`site/www`) locally |
| `bun run site:install` | Install Astro website dependencies in `site/` |

## Compilation Report (`REPORT.md`) Schema

Every compilation directory `outputs/<specification-id>/<compilation-id>/` must include a `REPORT.md` with YAML frontmatter describing what was performed (disagreement categories are **not prescribed**; each model/compiler defines whatever categories best characterize the disagreements it observed), followed by a plain-language Markdown narrative:

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

The ancient texts themselves are in the public domain. Each transcription retains the license stated by its source institution in `src/<institution>/index.json` (primarily CC BY 4.0, with CC BY-SA 4.0 for CNTR, CC BY-NC-SA 3.0 for the Codex Sinaiticus Project, unrestricted copying for UXLC, and CC BY-NC 4.0 for the Samaritan Pentateuch and Dead Sea Scrolls datasets).
