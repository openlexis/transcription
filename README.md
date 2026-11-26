# Open Lexis: Biblical Manuscript Transcriptions

Primary ancient manuscript transcriptions for the Old Testament (Biblical Hebrew and Biblical Aramaic) and New Testament (Koine Greek), paired with compact YAML specifications, immutable ULID source sets, and per-institution JSON catalogs.

## Repository Structure

- **[`specifications/`](specifications/):** Each new specification is one file, `specifications/<ULID>.yaml`, holding the rules and, at the end, the transcript list (every transcript the specification considers, one line each, with its repository path and the git commit that holds it), written by `bun run spec:freeze`, and the contract list (every file of the output contract in [`contract/`](contract/), with the git commit that holds it), written by `bun run spec:contract`. Every specification must include a required `license` field (`copyright`, `name`, and `url`); `bun run check` fails if it is missing. Every specification must also include a required `shortTitle` of at most 40 characters, which the site uses in links and lists. Book, language, date, license and archive details are read from the transcript and its catalog at that same commit, so later changes to `archives/` do not change a specification. Older folder specifications (`specifications/<ULID>/` with `sources.json`) and older single-file specifications whose `sources` list names source sets in `archives/sets/` stay as committed and are still read those ways.
- **[`archives/sets/`](archives/sets/):** Immutable, content-hashed ULID snapshots (`archives/sets/<ULID>.json`) for every book and institution. When new material is added to `archives/`, running `bun run sets` mints a new ULID while preserving all previous snapshots untouched.
- **[`archives/<institution>/`](archives/):** The primary XML manuscript corpus across institutional directories, each with its own `index.json` catalog mapping source identifiers to metadata, licenses, and XML file paths.
- **[`transcripts/`](transcripts/):** Compiled TEI P5 XML transcripts organized as `transcripts/<specification-id>/<compilation-id>/`, containing one TEI P5 XML file per target book (`<book-id>.xml`), `manifest.json`, and a structured Markdown compilation report (`REPORT.md`).
- **[`scripts/`](scripts/):** Source-set compiler (`scripts/sets.ts`), programmatic source resolver (`scripts/sources.ts`), per-archive import scripts (`scripts/archives/`), compilation, and verification utilities.
- **[`site/`](site/):** Static Astro website resolving specification folders (`specifications/<ULID>/`), older single-file specifications with `archives/sets/*.json` and `archives/<institution>/index.json`, and every compilation under `transcripts/<specification-id>/<compilation-id>/`.

## Commands (Bun)

| Command | Description |
|---|---|
| `bun run sets` | Compile/update immutable ULID source sets in `archives/sets/` from `archives/<institution>/index.json` |
| `bun run spec:freeze <ULID> [--replace] (--from <spec-id> \| <set-ULID\|archive:id> ...)` | Write the transcript list at the end of `specifications/<ULID>.yaml` from a selection; `--replace` replaces a list that is already there |
| `bun run spec:contract <ULID> [--replace]` | Write the contract list (each file in `contract/` and the commit that holds it) at the end of `specifications/<ULID>.yaml`; `--replace` replaces a list that is already there |
| `bun run contract show [<ULID>]` | Print the output contract a specification pins, in plain language (with no ULID, the contract in the working tree) |
| `bun run contract skeleton <ULID> <folder>` | Write fill-in templates of `manifest.json`, `REPORT.md` and a book's TEI file for that specification |
| `bun run sources summary` | Show specification summary, pinned set count, and institution breakdown |
| `bun run sources targets` | List resolved target books with primary source counts and pinned ULIDs |
| `bun run sources list [--target Gen] [--institution intf] [--json]` | Filter permitted sources for a specification |
| `bun run sources get <id\|institution:id>` | Resolve full metadata and XML paths for one permitted source |
| `bun run compile [spec-id] [all \| <book>]` | Compile target books (default: the newest specification, 01M8B40TZ4W7PX1RHJWY11ZNW0) into `transcripts/<spec-id>/<ulid>/` (with `REPORT.md` & `manifest.json`) and rebuild the Astro site |
| `bun run check [--spec <ULID> --dir <folder> [--books Obad]]` | Validate pinned transcripts and contract files, and every compilation in `transcripts/` (or one folder): against its specification's pinned contract when it has one, otherwise with the earlier built-in checks |
| `bun run site` / `bun run site:build` | Build the static website into `site/www` |
| `bun run site:dev` | Start the Astro development server with live reload |
| `bun run site:preview` | Preview the built website (`site/www`) locally |
| `bun run site:install` | Install Astro website dependencies in `site/` |

## Output Contract

Every compilation directory `transcripts/<specification-id>/<compilation-id>/` holds one TEI P5 XML file per target book (`<book-id>.xml`), `manifest.json`, and `REPORT.md` (YAML front matter, then a plain-language Markdown report). Their exact format is defined only in [`contract/`](contract/): JSON Schema 2020-12 for `manifest.json` and the `REPORT.md` front matter, the official TEI P5 RELAX NG schema plus `contract/tei-shape.rng` for the book files, and the named checks across files in `contract/contract.json`. Disagreement categories, subcategories and the severity scale are not prescribed; each model defines its own, and the contract fixes only their structure. Run `bun run contract show <ULID>` to read the contract a specification pins.

After producing a compilation, run `bun run check && bun run site` to verify all outputs and update `site/www`.

## Licenses

Each specification is released under the license declared in its required `license` field. The current specifications use:

```yaml
license:
  copyright: Copyright 2026 Open Lexis
  name: CC BY-NC 4.0
  url: https://creativecommons.org/licenses/by-nc/4.0/
```

That is Creative Commons Attribution-NonCommercial 4.0 International. Compilations record this license in each book's TEI `<licence>` element and in `manifest.json`.

The ancient texts themselves are in the public domain. Each source transcription retains the license stated by its source institution in `archives/<institution>/index.json` (primarily CC BY 4.0, with CC BY-SA 4.0 for CNTR, CC BY-NC-SA 3.0 for the Codex Sinaiticus Project, unrestricted copying for UXLC, and CC BY-NC 4.0 for the Samaritan Pentateuch and Dead Sea Scrolls datasets).
