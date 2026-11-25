# Open Lexis: compiled transcriptions

Each book of the Old Testament in Hebrew and Aramaic and of the New Testament in Greek, compiled only from ancient manuscripts in the language the book was written in, with the evidence for every word.

- **One specification, `SPECIFICATION.md`,** states the goal and what every output must contain. It has its own ULID and prescribes no statistical model: the output must use one, describe it, and name the model that made the judgments.
- **Each compilation is one output,** written in TEI P5 XML and filed under `outputs/<the specification's ULID>/<the compilation's ULID>/`. The record file in that folder gives both ULIDs, the model's name and version, the evidence for every reading, and the method that was used.
- **The manuscripts** are listed in `transcriptions/manuscripts.json`, which is part of the specification. Each transcription is a file in the folder `transcriptions/`, with no subfolders, named `{manuscript}.{holder}.xml` (or `{manuscript}.{holder}.{part}.xml` when one manuscript and holder give more than one file). Where the holder publishes TEI XML, or other XML, that file is stored as they published it. Where they publish no XML, the file is a TEI P5 document and the inventory says so. The books are listed in `transcriptions/books.json`.
- **No printed editions, modern reconstructions, translations or images are used.** A line no manuscript has is shown as missing.

## Commands (Bun)

| Command | What it does |
|---|---|
| `bun run import <folder>` | Reads the holders' downloaded files into `transcriptions/` |
| `bun run compile all` (or one book, `bun run compile Gen`) | Compiles every book into one output; the same inputs always give the same output |
| `bun run check` | Quick check of every output, about one second |
| `bun run site` | Builds the website in `site/www` |

## Website

https://openlexis-transcription.pages.dev

The [specification](https://openlexis-transcription.pages.dev/specification/) and the [list of manuscripts](https://openlexis-transcription.pages.dev/specification/manuscripts/) are on the site. Read any book by chapter and line. Tap a word or a line number: a panel opens under the line with the chance that each reading is original and its range, the manuscripts behind each reading, and every manuscript's own text of the line, lined up word by word.

## Licenses

The ancient texts are in the public domain. Each transcription keeps the license its holder states, as listed in `transcriptions/manuscripts.json`; most are CC BY 4.0, CNTR's files are CC BY-SA 4.0, the Codex Sinaiticus Project's are CC BY-NC-SA 3.0, UXLC states its Hebrew text may be copied without restriction, and the Samaritan Pentateuch and Dead Sea Scrolls data are CC BY-NC 4.0.
