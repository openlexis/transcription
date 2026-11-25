# Open Lexis: Biblical Manuscript Transcriptions

Primary ancient manuscript transcriptions for the Old Testament (Biblical Hebrew and Biblical Aramaic) and New Testament (Koine Greek), paired with self-contained YAML specifications for recovering each book's original text.

## Repository Structure

- **[`specifications/`](specifications/)** — Self-contained specification YAML files (currently [`specifications/01M88AX3YW2HWVPGHTREFJS181.yaml`](specifications/01M88AX3YW2HWVPGHTREFJS181.yaml)). Each specification embeds its full rules, target `books`, provenance `institutions`, and explicit allowlist of `manuscripts` in a single file.
- **[`src/`](src/)** — The primary XML manuscript corpus, organized by source institution (`src/<institution>/`, 2,028 XML files across 14 institutions).
- **[`scripts/`](scripts/)** — Data import, compilation, and verification utilities (with shared libraries in `scripts/lib/`).
- **[`site/`](site/)** — Static Astro website that parses `specifications/*.yaml` to present specifications, corpus breakdowns, canonical books, provenance institutions, and a searchable manuscript inventory.

## Commands (Bun)

| Command | Description |
|---|---|
| `bun run site` | Build the static website into `site/www` |
| `cd site && bun run preview` | Preview the built website locally |
| `cd site && bun run dev` | Run the Astro dev server with live reload |

## Licenses

The ancient texts themselves are in the public domain. Each transcription retains the license stated by its source institution in the specification YAML (primarily CC BY 4.0, with CC BY-SA 4.0 for CNTR, CC BY-NC-SA 3.0 for the Codex Sinaiticus Project, unrestricted copying for UXLC, and CC BY-NC 4.0 for the Samaritan Pentateuch and Dead Sea Scrolls datasets).
