# Open Lexis Transcription — Agent & Model Guide

This repository contains primary ancient biblical manuscript transcriptions (`src/`), immutable specification files (`specifications/*.yaml`), compiled critical-text outputs (`outputs/<spec-id>/<compilation-id>/`), and a static Astro viewer (`site/`).

Use this guide whenever asked to **implement a specification and produce a new compilation**.

---

## 1. Non-Negotiable Rules

1. **Strict allowlist:** Read **only** the specification YAML you were assigned (`specifications/<SPEC_ID>.yaml`), the immutable ULID set files (`src/sets/<ULID>.json`) and institutional catalogs (`src/<institution>/index.json`) it references, and the XML files named by those catalog entries. Never roam `src/` or ingest unreferenced files.
2. **Total exclusion of outside material:** Never consult or import printed/critical editions, translations, modern reconstructions, facsimiles, external scholarly commentary, or anything under `site/` (including UI-only word glosses in `site/src/data/`).
3. **Never fabricate metadata:** If a metadata field (e.g., provenance, scientific dating) is absent from `src/<institution>/index.json`, record it explicitly as unknown and let it widen uncertainty rather than imputing it.
4. **Never modify existing specs, source sets, or previous compilations:** Always write your compilation to a **brand-new** directory `outputs/<SPEC_ID>/<NEW_COMPILATION_ULID>/` using a freshly generated 26-character Crockford Base32 ULID.
5. **Own your modeling decisions:** You are free to design your own statistical model, alignment strategy, and disagreement taxonomy—do not blindly copy an earlier model's parameters if you believe a better approach furthers recovery of the original text. You may reuse deterministic I/O helpers (`scripts/sources.ts`, `scripts/lib/readers.ts`, `scripts/lib/tei.ts`) to parse input files without rewriting boilerplate.
6. **Honest attribution:** Record your exact provider, model family, model name, exact model ID, effort/reasoning tier, and harness in both `manifest.json` and `REPORT.md`.

---

## 2. Quick-Start Workflow

```bash
# 1. Inspect the specification and its permitted sources
bun run sources summary --spec <SPEC_ID>
bun run sources targets --spec <SPEC_ID>
bun run sources list --spec <SPEC_ID> --target Matt --json

# 2. Mint a fresh 26-char ULID for your compilation
bun -e 'import { generateUlid } from "./scripts/compile.ts"; console.log(generateUlid());'

# 3. Run your compilation -> outputs/<SPEC_ID>/<COMPILATION_ULID>/
#    Must produce: <BookId>.xml (one per target book), manifest.json, REPORT.md

# 4. Validate every XML file, SHA-256 hash, manifest, and REPORT.md frontmatter
bun run check

# 5. Rebuild the static Astro site so your compilation appears in the viewer
bun run site
```

---

## 3. Required Output Contract

Every compilation lives in:
```text
outputs/<SPEC_ID>/<COMPILATION_ULID>/
├── manifest.json
├── REPORT.md
├── Gen.xml
├── Exod.xml
└── ... (one TEI P5 XML file per target book in the specification)
```

### A. TEI P5 XML (`<BookId>.xml`)

Must use namespace `xmlns="http://www.tei-c.org/ns/1.0"` and include `<SPEC_ID>` and `<COMPILATION_ULID>` in `<teiHeader>`.

Required structural elements parsed by `scripts/check.ts` and `site/src/lib/corpus.ts`:

- **`<listWit>`** inside `<sourceDesc>`: one `<witness xml:id="wit-<SIGLUM>">` per manuscript used in that book, containing:
  - `<abbr type="siglum">...</abbr>`
  - `<desc>...</desc>`
  - `<note type="dating">...</note>` (include `Range: <y1> to <y2>` when known)
  - `<note type="provenance">...</note>`
  - `<note type="scientific-analysis">...</note>`
  - `<note type="physical-scribal">...</note>`
  - `<note type="textual-agreement">...</note>` (include `Posterior reliability: <0..1>`, `prior mean: <0..1>`, `lines compared: <N>`, `agreement share: <0..1>`)
  - `<note type="source-files">...</note>`
- **`<div type="book" n="<BookId>">`** inside `<body>`: one `<ab n="<ch>:<line>">` per verse/line (or `<ab n="<ch>:<line>" type="uncovered">` when no witness covers that line).
- **Unanimous words:** `<w xml:id="w-...">word</w>` (add `xml:lang="arc"` for Biblical Aramaic), accompanied by a `<spanGrp type="word-coverage">` inside the `<ab>` containing `<span target="#w-1 #w-2 ...">` blocks with:
  - `<note type="attested">#wit-...</note>`
  - `<note type="lacuna">#wit-...</note>` (if any)
  - `<certainty locus="value" degree="0.999"/>` (`degree` in `[0, 1]`)
  - `<note type="uncertainty">90% interval: [0.995, 1.000]</note>`
- **Points of disagreement:** `<app xml:id="app-...">` containing:
  - `<lem wit="#wit-...">` wrapping `<w>` tokens for the selected reading (empty `<lem/>` if omission is selected).
  - `<rdg xml:id="rdg-..." wit="#wit-..." type="selected|variant">`: reading text plus:
    - `<certainty target="#rdg-..." locus="value" degree="0.741"/>`
    - `<note type="uncertainty">90% interval: [0.304, 0.884]</note>`
    - For `type="variant"` readings:
      - `<note type="difference">...</note>` (mechanical edit description, e.g. `substitution`, `omission`, `addition / insertion`, `word-order / transposition`)
      - `<note type="severity" n="<level>" subtype="<subcategory-id>">...</note>` where `n` is an integer within your `disagreement_scale` (`min..max`) representing **substantive impact on meaning/authorial intent**, and `subtype` matches an `id` declared in `REPORT.md`.
  - `<rdg type="lacuna" wit="#wit-..."><gap reason="lost"/></rdg>` (if any witnesses are lacunose at this point).
  - `<rdg xml:id="rdg-...-unseen" type="unseen">` with `<certainty>` and `<note type="uncertainty">` for the probability that the original wording is unattested in surviving witnesses.

### B. `manifest.json`

```json
{
  "specification": {
    "id": "<SPEC_ID>",
    "file": "specifications/<SPEC_ID>.yaml",
    "sha256": "<sha256 of spec YAML>",
    "statement": "This compilation was produced under Open Lexis Transcription Specification <SPEC_ID>."
  },
  "compilation": {
    "id": "<COMPILATION_ULID>",
    "title": "<Short human-relatable title for this compilation>",
    "subtitle": "<Short subtitle summarizing model/approach>",
    "summary": "<1-2 sentence plain-language summary of this compilation>",
    "author": "Open Lexis",
    "createdAt": "2026-11-25T00:00:00.000Z",
    "outputDirectory": "outputs/<SPEC_ID>/<COMPILATION_ULID>/",
    "outputFormat": "TEI P5 XML",
    "reportFile": "REPORT.md"
  },
  "modelAttribution": {
    "provider": "<Lab / Provider>",
    "modelFamily": "<Model Family>",
    "modelName": "<Human-readable Model Name>",
    "modelId": "<Exact Model ID>",
    "effortLevel": "<Effort / Reasoning Tier>",
    "harness": "<Harness / Runtime>",
    "role": "<What the model designed and decided>"
  },
  "method": {
    "summary": "<1-2 sentence summary>",
    "description": "<Detailed method description>",
    "steps": [{ "title": "...", "body": "..." }],
    "scenarios": [{ "scenario": "...", "treatment": "..." }],
    "differenceCategories": [{ "label": "...", "meaning": "..." }],
    "unknownsAndLimitations": ["..."]
  },
  "totals": {
    "books": 66,
    "lines": 31195,
    "words": 444338,
    "variantPlaces": 34634,
    "totalBytes": 231479074
  },
  "books": [
    {
      "id": "Gen",
      "name": "Genesis",
      "section": "Old Testament",
      "number": 1,
      "language": "Hebrew and Aramaic",
      "file": "Gen.xml",
      "format": "TEI P5 XML",
      "sha256": "<sha256 of Gen.xml>",
      "bytes": 3383025,
      "stats": {
        "manuscripts": 27,
        "early": 25,
        "lines": 1533,
        "uncoveredLines": 0,
        "words": 20612,
        "places": 812,
        "meanPlaceConfidence": 0.961,
        "meanWordConfidence": 0.994,
        "meanManuscriptsPerLine": 4.2
      }
    }
  ]
}
```

### C. `REPORT.md`

Must begin with valid YAML frontmatter (`--- ... ---`) followed by a plain-language Markdown report:

```yaml
---
specification_id: <SPEC_ID>
compilation_id: <COMPILATION_ULID>
created_at: 2026-11-25T00:00:00.000Z
model_attribution:
  provider: <Lab / Provider>
  model_family: <Family>
  model_name: <Human-readable Name>
  model_id: <Exact Model ID>
  effort_level: <Effort / Reasoning Tier>
  harness: <Harness / Runtime>
method_summary: <1-2 sentence summary>
disagreement_scale:
  min: 1
  max: 5
  description: <Meaning of your chosen substantive severity scale>
disagreement_categories:
  - id: <category-slug>
    label: <Human-readable Label>
    description: <What mechanical edit type this covers>
    count: 1234
disagreement_subcategories:
  - id: <subcategory-slug>
    label: <Human-readable Label>
    level: 1
    level_label: <e.g. Minor (1/5)>
    description: <What this covers>
    local_confidence_effect: <Effect on local reading confidence>
    corpus_authenticity_effect: <Effect on overall witness/corpus authenticity>
    count: 567
authenticity_signal: <Summary of what observed error patterns imply about authenticity>
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
```

---

## 4. Verification Checklist

Before finishing, run:

```bash
bun run check && bun run site
```

Both commands must exit `0` with zero warnings or missing books.
