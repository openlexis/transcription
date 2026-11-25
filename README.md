# Open Lexis: Biblical Manuscript Transcriptions

Primary ancient manuscript transcriptions for the Old Testament (Biblical Hebrew and Biblical Aramaic) and New Testament (Koine Greek), paired with compact YAML specifications, immutable ULID source sets, and per-institution JSON catalogs.

## Repository Structure

- **[`specifications/`](specifications/)** — Compact specification YAML files (currently [`specifications/01M88AX3YW2HWVPGHTREFJS181.yaml`](specifications/01M88AX3YW2HWVPGHTREFJS181.yaml), ~11 KB). Each specification defines its rules and a single `sources` list of immutable ULID set snapshots (and/or direct `<institution>:<id>` items).
- **[`src/sets/`](src/sets/)** — Immutable, content-hashed ULID snapshots (`src/sets/<ULID>.json`) for every book and institution. When new material is added to `src/`, running `bun run sets` mints a new ULID while preserving all previous snapshots untouched.
- **[`src/<institution>/`](src/)** — The primary XML manuscript corpus across 14 institutional directories, each with its own `index.json` catalog mapping source identifiers to metadata, licenses, and XML file paths.
- **[`scripts/`](scripts/)** — Source-set compiler (`scripts/sets.ts`), programmatic source resolver (`scripts/sources.ts`), import, compilation, and verification utilities.
- **[`site/`](site/)** — Static Astro website resolving `specifications/*.yaml`, `src/sets/*.json`, and `src/<institution>/index.json`.

## Commands (Bun)

| Command | Description |
|---|---|
| `bun run sets` | Compile/update immutable ULID source sets in `src/sets/` from `src/<institution>/index.json` |
| `bun run sources summary` | Show specification summary, pinned set count, and institution breakdown |
| `bun run sources targets` | List resolved target books with primary source counts and pinned ULIDs |
| `bun run sources list [--target Gen] [--institution intf] [--json]` | Filter permitted sources for a specification |
| `bun run sources get <id\|institution:id>` | Resolve full metadata and XML paths for one permitted source |
| `bun run site` | Build the static website into `site/www` |
| `cd site && bun run preview` | Preview the built website locally |

## Licenses

The ancient texts themselves are in the public domain. Each transcription retains the license stated by its source institution in `src/<institution>/index.json` (primarily CC BY 4.0, with CC BY-SA 4.0 for CNTR, CC BY-NC-SA 3.0 for the Codex Sinaiticus Project, unrestricted copying for UXLC, and CC BY-NC 4.0 for the Samaritan Pentateuch and Dead Sea Scrolls datasets).
