# Open Lexis: compiled transcriptions

Each book of the Old Testament in Hebrew and Aramaic and of the New Testament in Greek, compiled only from ancient manuscripts in the language the book was written in, with the evidence for every word.

- **One specification, `SPECIFICATION.md`,** states the goal and what every output must contain. It prescribes no method and names no model or program.
- **The compiler chooses its own method** and writes it into its output. This repository's compiler is `scripts/compile.ts`; its method, including the statistical model that estimates how likely each reading is to be original and with what uncertainty, is described in `scripts/METHOD.md`.
- **Each compilation is one output artifact,** filed by the specification's hash and the compiler's name: `outputs/<first 12 characters of the specification's SHA-256>/<compiler>/`. It holds `compilation.json` (the specification's hash, the compiler's record of itself, the full method text, and each book with its hash) and `books/<book>.json` (the text, every manuscript's reading, the estimates and their ranges). This compiler names its outputs `compile-<commit>`, with `-modified-<hash>` added when its code differs from that commit.
- **The inputs are data, not rules:** `transcriptions/books.json` lists the books and the folders each section reads; `transcriptions/manuscripts.json` lists each manuscript with the facts its holder records (its date range and how it was dated, its holders, the license and the holder's own file for each transcription, and links to page images held elsewhere); `transcriptions/greek/` and `transcriptions/hebrew/` hold one plain text file per manuscript transcription, made from the holders' files.
- **No printed editions, modern reconstructions, translations or images are used.** A line no manuscript has is shown as missing.

## Commands (Bun)

| Command | What it does |
|---|---|
| `bun run import <folder>` | Reads the holders' downloaded files into `transcriptions/` |
| `bun run compile all` (or one book, `bun run compile Gen`) | Compiles every book into one output artifact; the same inputs and code always give the same output |
| `bun run check` | Quick check of every output, about one second |
| `bun run site` | Builds the website in `site/www` |

## Website

https://openlexis-transcription.pages.dev

Read any book by chapter and line. Tap a word or a line number: a panel opens under the line with the chance that each reading is original and its range, the manuscripts behind each reading with their dates and reliability, and every manuscript's own text of the line, lined up word by word. The site reads every output in `outputs/` and shows each one with its own method.

## Licenses

The ancient texts are in the public domain. Each transcription keeps the license its holder states, as listed in `transcriptions/manuscripts.json`; most are CC BY 4.0, CNTR's files are CC BY-SA 4.0, the Codex Sinaiticus Project's are CC BY-NC-SA 3.0, UXLC states its Hebrew text may be copied without restriction, and the Samaritan Pentateuch and Dead Sea Scrolls data are CC BY-NC 4.0.
