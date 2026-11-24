# Open Lexis: compiled transcriptions

One compiled transcription per book, built only from ancient manuscripts in the original language, with every word cited.

- **No printed editions, recent reconstructions, translations or images are used.** A line that no manuscript covers is marked as not covered.
- **Each compilation is one folder** in `compilations/`, with one rule file, `RULES.md`. The rule file lists the files to read, gives the rules in numbered steps, and names the model that does the work. The output is saved in the same folder: `transcription.json`, `transcription.md`, `disagreements.json` and `stats.json`.
- **The inputs** are in `transcriptions/greek/`, one plain text file per manuscript transcription. `transcriptions/manuscripts.json` gives each manuscript's date, its holders, the license of each transcription, and links to page images held elsewhere.

## Commands (Bun)

| Command | What it does |
|---|---|
| `bun run import <folder>` | Reads the holders' downloaded files into `transcriptions/` |
| `bun scripts/rules.ts` | Writes each compilation's rule file with its list of inputs |
| `bun run compile all` (or `compilations/<name>`) | One deterministic pass per compilation, following its `RULES.md` |
| `bun run check` | Quick check of the output, about one second |
| `bun run site` | Builds the website in `site/www` |

## Website

https://openlexis-transcription.pages.dev

Read any compilation by chapter and line, and tap a word to see its manuscripts. Each compilation also has its own disagreements with filters, its statistics, its manuscripts and its rule file.

## Licenses

The ancient texts are in the public domain. Each transcription keeps the license its holder states, as listed in `transcriptions/manuscripts.json`; most are CC BY 4.0, CNTR's files are CC BY-SA 4.0, and the Codex Sinaiticus Project's are CC BY-NC-SA 3.0.
