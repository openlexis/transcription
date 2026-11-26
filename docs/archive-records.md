# Archive records

The archive holds transcriptions: text that a person or project typed out from a manuscript. A compilation reads only those
transcriptions. To read them well it also needs facts about where each one came from. The archive records hold those facts.

They keep three things apart, each with its own dates and details:

1. **The manuscript**: the physical object, such as a codex (a book of bound leaves), a scroll or a papyrus fragment.
2. **The reproduction** a transcription was made from: a set of photographs, digital images, multispectral images (images taken
   under different wavelengths of light), a microfilm, a printed facsimile (a photographic copy published as a book), a printed
   edition, or the manuscript itself.
3. **The transcription**: one file in `archives/<archive>/`.

For example, Codex Sinaiticus (GA 01) was written in the fourth century; the Codex Sinaiticus Project photographed it in 2006 to
2009; its transcription was made between 2002 and 2010. These are three different dates, and each is recorded where a source
states it.

## Where the files are

| File | What it holds |
|---|---|
| `archives/manuscripts/<id>.yaml` | One manuscript: names, catalog numbers, where it is held, dates, place of origin, history, reproductions |
| `archives/transcriptions/<archive>/<file>.yaml` | One transcription file: who made it, when, from what, how it was checked, what it is based on |
| `schema/manuscript.schema.json`, `schema/transcription.schema.json`, `schema/common.schema.json` | The JSON Schemas both kinds of file must match |

A manuscript id is a scheme and the catalog number in lower case: `ga-` for Gregory-Aland numbers of New Testament manuscripts
(`ga-01`, `ga-p46`, `ga-l299` for a lectionary), `dss-` for Dead Sea Scrolls, `mt-` for the Masoretic Hebrew codices (`mt-a`
Aleppo, `mt-l` Leningrad), `sp-` for the Samaritan Pentateuch. A transcription id is `<archive>/<file name without .xml>`, for
example `intf/01`.

## The one rule: every fact has a source

A field is filled only when a source states it. Otherwise it is left out. A record never says "unknown". Every value carries
`sources`, and every source gives the exact words (`quote`) and where they are:

- a file of this repository: `path` and `locator` (an XML path into the file's header, the part before the text), or
- a web page or paper: `url`, the date it was read (`accessed`), and for a paper its `citation`.

`bun run check` finds every repository quote in its file. Web quotes were copied from saved copies of the pages when the records
were written.

`generalPractice: true` marks a fact that describes how a project usually works (for example, that the INTF has two people
transcribe each manuscript independently), not something a source says about that one file.

## Manuscript record fields

| Field | Meaning |
|---|---|
| `names` | Names such as "Codex Sinaiticus", with the language code of the name |
| `identifiers` | Catalog numbers: `scheme` (GA for Gregory-Aland, Liste for the INTF number, TM for Trismegistos, LDAB, and others as the source names them) and `value` |
| `form`, `material`, `languages` | For example codex, parchment, Greek |
| `holdings` | Where the manuscript or a part of it is now: `repository`, `settlement` (city), `country`, `idno` (shelfmark), `leaves` (how many leaves are there, as stated) |
| `dates` | When it was written, as the source gives it: `text` in its words, and `when`, `notBefore`, `notAfter` as years when stated; `of` says what is dated (writing, material, binding, correction); `method` says how the date was reached; `statedBy` and `publication` say who gives it |
| `originPlaces` | Where it was written |
| `provenance` | Events in its history: `type` (discovery, sighting, acquisition, transfer, sale, donation, loan), `when`, `place`, `agents`, `description` |
| `reproductions` | Image sets and other copies, each with an `id` that transcription records point to: `kind`, `description`, `madeBy`, `when`, `device`, `lighting`, `coverage`, `owner`, `where` |

Dating methods are a `category` and a `name`:

| Category | Names |
|---|---|
| scientific | radiocarbon, dendrochronology (tree rings), thermoluminescence, materials-analysis, other-scientific |
| palaeographic | palaeography (the style of the handwriting), codicology (how the book is made), decoration-style |
| internal-evidence | colophon (a note by the copyist, often dated), dated-text, internal-reference, textual-content |
| external-evidence | external-record, archaeological-context, provenance-record |
| reported | catalogue (a date a catalog gives without saying how it was reached) |
| computational | machine-learned-handwriting, other-computational |

## Transcription record fields

| Field | Meaning |
|---|---|
| `manuscript`, `file` | The manuscript record and the transcription file |
| `title` | The file's own title |
| `people` | Everyone credited: `name`, `roles`, `statement` (the credit as written), and `books` when a source says which books that person did |
| `made` | When the transcription was made |
| `madeFrom` | What it was made from: `kind` (images, original, edition, microfilm, typescript, facsimile, no-images, other), and `reproduction`, the id of a reproduction in the manuscript record, where that can be told |
| `published`, `version`, `revisions` | When it was published, its version, and the changes the file lists |
| `method` | How it was checked (`practices`: independent-double-transcription, automatic-comparison, reconciliation, proofreading, verification-against-original, checked-against-images, compared-with-edition, compared-with-other-transcriptions, base-text-adaptation, conversion-to-xml), and the `guidelines`, `tools`, `encoding` and `conventions` it follows |
| `basedOn` | Another transcription or a dataset it was made from: `transcription` (a record id) or `name`, and `relation` (derived-from, reviewed-against, extended-from) |
| `baseText`, `scope`, `rights`, `generatedBy` | The printed text used as a starting point, what part of the manuscript it covers, its license, and the software that assembled the file when the file says so |

Roles are the Library of Congress relator codes (https://id.loc.gov/vocabulary/relators): `cre` creator, `trc` transcriber,
`pfr` proofreader, `rev` reviewer (here: who reconciled or revised), `edt` editor, `mrk` markup editor (who converted it to
XML), `fnd` funder, `spn` sponsor, `pbl` publisher, `pdr` project director, `pht` photographer, `ctb` contributor.

## How the records are written

`bun run archive:records` (scripts/records.ts) writes them from:

- the header of each transcription file (the archives whose headers this repository wrote itself, because the source publishes
  no XML, are skipped: cntr, etcbc-dss, aleppo, dt-ucph-sp, tal-florentin-sp);
- the INTF manuscript list in the evidence repository (`--evidence`, found next to this repository by default), for a catalog
  date of each New Testament manuscript;
- NTVMR manuscript metadata saved as one JSON file per manuscript (`--ntvmr <folder>`), for holdings and image sets;
- facts about whole archives in `scripts/records-upstream.ts`, from the projects' own pages and papers.

Entries whose sources are all web pages the script does not produce were added by hand, and the script keeps them when it runs
again. To add a fact by hand, add the entry with its `url`, `accessed` and exact `quote`.

A specification frozen with `bun run spec:freeze` lists the records of its transcripts and their manuscripts under `records:`,
each at a commit, like its transcripts.
