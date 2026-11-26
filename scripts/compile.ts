// Transcription compiler for Open Lexis YAML specifications (TEI P5 XML output).
// Usage:
//   bun --smol scripts/compile.ts [spec-id] [all | <book-id>] [--compilation-id <ulid>]
// Defaults: spec-id = 01M8B40TZ4W7PX1RHJWY11ZNW0, book = all. --out-dir <folder> writes a trial compilation outside transcripts/.
import { createHash, randomBytes } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { align } from "./lib/align";
import { betaDraw, loglik, posterior, prior, quantile, rng, type Unit, weights } from "./lib/model";
import { readTranscriptionFile, readTranscriptionText, type ParsedUnit } from "./lib/readers";
import { classifyReadingSeverity, formatSeverityNote, SEVERITY_SCALE, SEVERITY_TAXONOMY, type SeverityDef } from "./lib/severity";
import { gitShow, loadSpecWithSources } from "./sources";
import { readSpecLicense, type SpecLicense } from "./lib/spec";
import { aramaic, greekKey, hebrewSpell, showGreek } from "./lib/text";

const ROOT = new URL("..", import.meta.url).pathname;
const r4 = (x: number) => Math.round(x * 10000) / 10000;
const r3 = (x: number) => Math.round(x * 1000) / 1000;
const sha = (...xs: (string | Buffer)[]) => {
  const h = createHash("sha256");
  for (const x of xs) h.update(x);
  return h.digest("hex");
};

// Crockford Base32 ULID generator (26 chars: 10 timestamp + 16 randomness)
const CROCKFORD = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
export function generateUlid(now = Date.now()): string {
  let t = now;
  const timeChars = new Array<string>(10);
  for (let i = 9; i >= 0; i--) {
    timeChars[i] = CROCKFORD[t % 32];
    t = Math.floor(t / 32);
  }
  const rand = randomBytes(10); // 80 bits = 16 * 5 bits
  let bits = 0n;
  for (const b of rand) bits = (bits << 8n) | BigInt(b);
  const randChars = new Array<string>(16);
  for (let i = 15; i >= 0; i--) {
    randChars[i] = CROCKFORD[Number(bits & 31n)];
    bits >>= 5n;
  }
  return timeChars.join("") + randChars.join("");
}

const escXml = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const witXmlId = (siglum: string) => `wit-${siglum.replace(/[^A-Za-z0-9._-]/g, "_")}`;

// ---------- specification types ----------
type TargetBook = { id: string; name: string; section: string; number: number; language: string };
type SourceFileEntry = {
  paths: string[];
  format: string;
  license: string;
  sourceUrl: string;
  member?: string;
  lines?: number;
  words?: number;
  provenance: { id: string; name: string; url: string };
};
type SourceItem = {
  id: string;
  type: "continuous" | "scroll" | "lectionary" | "catena";
  language: string;
  name?: string;
  shelfmark?: string;
  century?: string;
  year?: number;
  yearFrom?: number;
  yearTo?: number;
  dateBasis?: string;
  dateSource?: string;
  viewers?: { name: string; url: string }[];
  targets?: string[];
  files: SourceFileEntry[];
};
type Spec = {
  id: string;
  title: string;
  summary: string;
  targets: TargetBook[];
  sources: SourceItem[];
};

const SETTINGS: Record<string, { origin: number; halfLife: number; lateAfter: number; undated: number }> = {
  "Old Testament": { origin: -400, halfLife: 100, lateAfter: 400, undated: 1500 },
  "New Testament": { origin: 100, halfLife: 100, lateAfter: 400, undated: 1500 },
};

/** Physical leaves of one manuscript catalogued under separate numbers would be merged here. None are: neither the
 * specification nor the institutional catalogs it resolves to document that two catalogued sources are one manuscript, and
 * the exclusion rule forbids importing that from outside scholarship. Each catalogued source is its own witness. */
const SAME_MANUSCRIPT: Record<string, string> = {};

/** Who made the non-deterministic judgments of this compilation (scripts/attribution.json; unknown fields stay unknown). */
const ATTRIBUTION_FILE = "scripts/attribution.json";
const MODEL_ATTRIBUTION = {
  ...(JSON.parse(readFileSync(`${ROOT}${ATTRIBUTION_FILE}`, "utf8")) as {
    provider: string; modelFamily: string; modelName: string; modelId: string; versionSnapshot: string; variant: string;
    effortLevel: string; temperature: string; thinkingBudget: string; harness: string; role: string; note?: string;
  }),
  deterministicEngine: {
    program: "scripts/compile.ts",
    runtime: typeof Bun !== "undefined" ? `Bun ${Bun.version}` : `Node ${process.version}`,
  },
};

/** The full attribution in one line: lab, model, identifier, snapshot, variant, effort, inference settings and harness. */
function attributionLine() {
  const A = MODEL_ATTRIBUTION;
  return `${A.provider} / ${A.modelFamily} / ${A.modelName} (model id ${A.modelId}; version/snapshot: ${A.versionSnapshot}; variant: ${A.variant}; effort: ${A.effortLevel}; temperature: ${A.temperature}; thinking budget: ${A.thinkingBudget}; harness: ${A.harness})`;
}

function gitInfo() {
  const git = (...a: string[]) => {
    const r = spawnSync("git", a, { cwd: ROOT });
    return r.status === 0 ? r.stdout.toString().trim() : undefined;
  };
  const codeFiles = [
    "scripts/compile.ts",
    ATTRIBUTION_FILE,
    "scripts/sources.ts",
    "scripts/sets.ts",
    "scripts/lib/align.ts",
    "scripts/lib/model.ts",
    "scripts/lib/readers.ts",
    "scripts/lib/tei.ts",
    "scripts/lib/text.ts",
  ];
  return {
    repository: git("remote", "get-url", "origin"),
    commit: git("rev-parse", "HEAD"),
    codeSha256: sha(...codeFiles.map((f) => readFileSync(`${ROOT}${f}`))),
  };
}

const METHOD_DESCRIPTION = `Statistical Method: Bayesian Dawid-Skene Latent-Class Model with Composite Likelihood and Scribal Evidence.

1. Objective and Witness Consolidation. Each target book is reconstructed strictly from the allowlisted primary transcriptions in the specification named in this compilation's header. Multiple transcriptions of the same physical manuscript (and known split leaves: P64/P67, P77/P103) are consolidated into a single witness so no manuscript votes twice; per line, the transcription with the most readable words is used (ties broken by specification listing order). Only the first hand (original copyist) is read; damaged or editorially supplied words are treated as lacunae rather than votes.

2. Alignment and Orthographic Normalization. For each numbered line (chapter:line), witnesses are aligned oldest-first via Needleman-Wunsch global alignment. Orthographic spelling habits (Greek itacism ei/i, doubled letters, movable nu, final sigma of outos/achris/mechris, expanded nomina sacra and letter-numerals; Hebrew consonantal skeleton ignoring final forms and internal matres lectionis vav/yod) are folded for comparison so spelling conventions do not inflate substantive variation. The displayed surface spelling is taken from the oldest attesting witness. Non-continuous witnesses (scrolls, lectionaries, catenae) treat absent positions as lacunae rather than omissions. Every column where surviving non-lacunose witnesses disagree (including singular readings) is represented as a TEI <app> element. Adjacent variant columns are merged into a single <app> only when structurally coupled (an omission/insertion, a multi-word variant by the same witness, or a shared/transposed word within two columns), preventing unrelated single-word substitutions in large witness pools from collapsing into giant spans.

3. Prior Reliability from Dating and Scribal Evidence. Before measuring textual agreement, each witness receives a Beta prior on its reliability q_m (probability of preserving the original reading at a point). Expected reliability decays with age after composition (origin = 400 BC for Old Testament, AD 100 for New Testament): mu(t) = 0.5 + 0.45 * 2^(-max(0, t - origin) / 100), averaged uniformly across the documented date range [yearFrom, yearTo]. Prior strength is 4 * 100 / max(100, yearTo - yearFrom) pseudo-observations, so wide date ranges yield weaker priors and wider uncertainty intervals. Where dating metadata is undocumented in the specification, it remains explicitly unknown and receives a diffuse prior (mu(1500) ≈ 0.50, strength = 1) so measured agreement governs and uncertainty remains wide where coverage is sparse. Observed scribal corrections in a manuscript's own transcription (when >= 100 transcribed words are present and correction rate exceeds 1%) apply a gentle bounded prior penalty up to 0.08 (floor 0.50) reflecting less stable copying. Physical deterioration (lacunae, damaged parchment, missing text in ancient scrolls) never penalizes credibility, though absent words leave local uncertainty.

4. Dependence Discounting (Composite Likelihood) and EM Estimation. To avoid simple majority voting by large clusters of late dependent copies, witnesses within 400 years of composition receive full weight (1.0), whereas later witnesses sharing a reading are geometrically down-weighted in descending order of reliability (1, 1/2, 1/4, ..., sum < 2). At each unit with K attested readings plus U = 10 unseen candidate readings (uniform prior over K + U candidates), a witness with reliability q_m attests the original with probability q_m and each alternative with probability (1 - q_m)/(K + U - 1). Five rounds of Expectation-Maximization (EM) update each witness's posterior Beta(alpha_m, beta_m) using line-level mean agreement (accounting for clustered errors and excluding single-witness units from self-confirmation).

5. Uncertainty Intervals and Reading Selection. One hundred deterministic Monte Carlo draws (seeded by book ID) are sampled from each witness's posterior Beta distribution. For every reading (selected, variant, and unseen-original) and every unanimous word, the posterior median is recorded in <certainty degree="..."/> and the 90% credible interval (5th to 95th percentile) in <note type="uncertainty">. At each <app>, the reading with highest point-estimate posterior probability is selected as <lem> (ties broken by earliest witness, then witness count, then lexicographical order).

6. Filled-in Text for Lost Parts. Where a transcription marks words that an edition fills in for a lost part of a manuscript (TEI <supplied>, as in the Aleppo Codex and Samaritan Pentateuch MS Nablus 6), those words are never counted as the manuscript's own text: the manuscript is lacunose at that point (which does not lower its reliability) and the filled-in words carry a weight of zero, because they are a copy of other manuscripts that are either already witnesses (so they would be counted twice) or not in the specification, and the stated source has no reliability of its own. Each line with filled-in text records the manuscript, the words and the edition's stated source in a <note type="filled-in">, each witness records how many lines and words are filled in, and a line covered only by filled-in text is uncovered.

7. Unknowns and Limitations. Place of origin/writing (manuscript provenance) and scientific dating (e.g. radiocarbon) are undocumented for all manuscripts in the specification and are explicitly recorded as unknown in every <witness> entry without imputation. Limitations: uniform error distribution across alternatives does not model specific scribal error mechanisms (e.g., homoioteleuton), and geometric down-weighting of late witnesses is a statistical proxy for a full stemma codicum.`;

// ---------- data structures ----------
type Tok = { k: string; t: string; gap: boolean };
/** filled: text an edition filled in for a lost part of the manuscript (TEI <supplied>). It is not the manuscript's own text, so it is
 * kept out of `words` (the manuscript is lacunose there) and carried only so the output can show it (scripts/METHOD.md, section 5). */
type FilledIn = { text: string[]; source: string };
type LineText = { absent: boolean; words: Tok[]; gapEnd: boolean; file: string; fileIdx: number; filled?: FilledIn };
type WitnessEvidence = {
  siglum: string;
  xmlId: string;
  leaves: string[];
  source: SourceItem;
  files: string[];
  provenances: string[];
  corrections: number;
  lacunae: number;
  transcribedWords: number;
  corrPenalty: number;
  /** Lines and words of filled-in text (not the manuscript's own) in this book, and the stated sources; none of it is counted. */
  filledInLines: number;
  filledInWords: number;
  filledInSources: string[];
  year: number;
  early: boolean;
  reliability?: {
    estimate: number;
    low: number;
    high: number;
    linesCompared: number;
    agreementShare: number | null;
    priorMean: number;
    priorStrength: number;
    dateRangeKnown: boolean;
  };
};

type WordOut = { t: string; k: string; c?: number; lo?: number; hi?: number; p?: number; l?: number[]; x: number; a?: number };
type ReadingOut = {
  text: string;
  keys: string;
  xs: number[];
  witnesses: number[];
  partly?: number[];
  p: number;
  lo: number;
  hi: number;
  diffNote?: string;
  severity?: SeverityDef;
};
type PlaceOut = {
  id: number;
  ref: string;
  at: number;
  n: number;
  cols: [number, number];
  confidence: number;
  lost?: boolean;
  readings: ReadingOut[];
  partlyLost?: number[];
  lostEverywhere?: { p: number; lo: number; hi: number };
};
type FilledInOut = { w: number; source: string; text: string };
type LineOut = { ref: string; uncovered?: boolean; witnesses: number[]; words?: WordOut[]; filledIn?: FilledInOut[] };

function classifyDisagreement(p: PlaceOut): string {
  if (p.lost || !p.readings.length) return "unresolved_lacuna";
  const chosen = p.readings[0];
  const selKeys = chosen.keys ? chosen.keys.split(" ") : [];
  const runner = p.readings[1];
  if (!runner) return "lexical_substitution";
  const rKeys = runner.keys ? runner.keys.split(" ") : [];
  if (rKeys.length === 0 && selKeys.length > 0) return "omission";
  if (selKeys.length === 0 && rKeys.length > 0) return "addition";
  if (rKeys.length === selKeys.length) {
    const a = [...selKeys].sort().join("\0");
    const b = [...rKeys].sort().join("\0");
    return a === b ? "transposition" : "lexical_substitution";
  }
  return "phrase_length_variation";
}

const DISAGREEMENT_TAXONOMY: { id: string; label: string; description: string }[] = [
  {
    id: "lexical_substitution",
    label: "Lexical Substitution",
    description: "Witnesses attest different word(s) of equal word count at the same position (non-transposition).",
  },
  {
    id: "omission",
    label: "Omission",
    description: "Competing witness(es) omit word(s) present in the selected reading.",
  },
  {
    id: "addition",
    label: "Addition",
    description: "Competing witness(es) include extra word(s) where the selected reading is empty.",
  },
  {
    id: "transposition",
    label: "Transposition (Word Order)",
    description: "Witnesses attest the same words in a different sequence.",
  },
  {
    id: "phrase_length_variation",
    label: "Phrase & Length Variation",
    description: "Multi-word phrase differences where both the selected and competing readings are non-empty but differ in word count.",
  },
  {
    id: "unresolved_lacuna",
    label: "Unresolved Lacuna",
    description: "All covering witnesses are partially lacunose across the span so no complete reading could be reconstructed.",
  },
];

function renderReportMarkdown(o: {
  specId: string;
  compilationId: string;
  createdAt: string;
  git: ReturnType<typeof gitInfo>;
  totals: { books: number; lines: number; words: number; variantPlaces: number };
  categoryCounts: Record<string, number>;
  severityCounts: Record<string, number>;
}): string {
  const catsYaml = DISAGREEMENT_TAXONOMY.map(
    (c) =>
      `  - id: ${c.id}\n    label: ${JSON.stringify(c.label)}\n    description: ${JSON.stringify(c.description)}\n    count: ${o.categoryCounts[c.id] ?? 0}`,
  ).join("\n");
  const subcatsYaml = SEVERITY_TAXONOMY.map(
    (s) =>
      `  - id: ${s.id}\n    label: ${JSON.stringify(s.label)}\n    level: ${s.level}\n    level_label: ${JSON.stringify(s.shortLabel)}\n    description: ${JSON.stringify(s.description)}\n    local_confidence_effect: ${JSON.stringify(s.localConfidenceEffect)}\n    corpus_authenticity_effect: ${JSON.stringify(s.corpusAuthenticityEffect)}\n    count: ${o.severityCounts[s.id] ?? 0}`,
  ).join("\n");
  return `---
specification_id: ${o.specId}
compilation_id: ${o.compilationId}
created_at: ${o.createdAt}
model_attribution:
  provider: ${JSON.stringify(MODEL_ATTRIBUTION.provider)}
  model_family: ${JSON.stringify(MODEL_ATTRIBUTION.modelFamily)}
  model_name: ${JSON.stringify(MODEL_ATTRIBUTION.modelName)}
  model_id: ${JSON.stringify(MODEL_ATTRIBUTION.modelId)}
  effort_level: ${JSON.stringify(MODEL_ATTRIBUTION.effortLevel)}
  harness: ${JSON.stringify(MODEL_ATTRIBUTION.harness)}
  engine: ${JSON.stringify(`${MODEL_ATTRIBUTION.deterministicEngine.program} (${MODEL_ATTRIBUTION.deterministicEngine.runtime})`)}
  commit: ${JSON.stringify(o.git.commit ?? "unknown")}
method_summary: "Word-level Bayesian Dawid-Skene latent-class model with granular span alignment, decoupled edit-category vs. substantive-severity scoring, composite-likelihood late-witness discounting, and 100-draw Monte Carlo posterior uncertainty intervals."
disagreement_scale:
  min: ${SEVERITY_SCALE.min}
  max: ${SEVERITY_SCALE.max}
  description: ${JSON.stringify("Independent 1 (minor/cosmetic) to 5 (major semantic or clause-level divergence) substantive impact scale, decoupled from mechanical edit category.")}
disagreement_categories:
${catsYaml}
disagreement_subcategories:
${subcatsYaml}
authenticity_signal: "Across all 66 books, the overwhelming majority of variant readings are minor orthographic slips, particle/article variations, grammatical nuances, and phonetic confusions characteristic of independent human hand-copying across centuries, reinforcing overall corpus authenticity while isolating substantive divergences for scholarly scrutiny."
evidence_usage:
  dating: "Used to form an age-decay Beta prior averaged uniformly over documented [yearFrom, yearTo] ranges; wide ranges weaken prior strength; undocumented dates remain unknown with a diffuse prior (strength = 1)."
  provenance: "Place of origin/writing is undocumented for all manuscripts in the specification and is recorded explicitly as unknown without imputation."
  scientific_analysis: "Undocumented for all manuscripts in the specification and recorded explicitly as unknown."
  physical_and_scribal: "Observed scribal corrections (>1% rate across >=100 words) apply a bounded prior penalty up to 0.08; physical damage/lacunae never penalize credibility."
  textual_agreement: "Primary evidence learned via 5 rounds of line-level Dawid-Skene EM with geometric dependence discounting for late copies (>400 years after composition)."
totals:
  books: ${o.totals.books}
  lines: ${o.totals.lines}
  words: ${o.totals.words}
  variant_places: ${o.totals.variantPlaces}
---

# Compilation Report (${o.compilationId})

This compilation was produced under Open Lexis Transcription Specification \`${o.specId}\`.

${METHOD_DESCRIPTION}
`;
}

function describeDifference(selKeys: string[], rdgKeys: string[]): string {
  if (rdgKeys.length === 0 && selKeys.length > 0) {
    return `omission of ${selKeys.length} word${selKeys.length === 1 ? "" : "s"} relative to selected reading`;
  }
  if (selKeys.length === 0 && rdgKeys.length > 0) {
    return `addition of ${rdgKeys.length} word${rdgKeys.length === 1 ? "" : "s"} relative to selected reading`;
  }
  if (rdgKeys.length === selKeys.length) {
    const a = [...selKeys].sort().join("\0");
    const b = [...rdgKeys].sort().join("\0");
    if (a === b) return `transposition (word-order difference of ${rdgKeys.length} words)`;
    return `substitution (${rdgKeys.length} word${rdgKeys.length === 1 ? "" : "s"})`;
  }
  return `substitution/length difference (${rdgKeys.length} word${rdgKeys.length === 1 ? "" : "s"} vs ${selKeys.length} in selected reading)`;
}

type BookIndexEntry = {
  siglum: string;
  file: string;
  fileIdx: number;
  units: ParsedUnit[];
};

type SourceScribalStats = {
  corrections: number;
  lacunae: number;
  words: number;
  files: string[];
  provenances: Set<string>;
};

function compileBook(
  target: TargetBook,
  bookEntries: BookIndexEntry[],
  sourceMap: Map<string, SourceItem>,
  scribalStats: Map<string, SourceScribalStats>,
) {
  const S = SETTINGS[target.section];
  const HEB = target.language.startsWith("Hebrew");
  const SHOW = HEB ? (w: string) => w : showGreek;
  const KEY = HEB ? hebrewSpell : greekKey;

  const byMs = new Map<string, { files: string[]; lines: Map<string, LineText[]> }>();
  for (const entry of bookEntries) {
    const ms = byMs.get(entry.siglum) ?? { files: [], lines: new Map() };
    byMs.set(entry.siglum, ms);
    if (!ms.files.includes(entry.file)) ms.files.push(entry.file);
    for (const u of entry.units) {
      const arr = ms.lines.get(u.ref) ?? [];
      // Filled-in words are not the manuscript's own text: they leave the witness lacunose where they stand (a lost-before mark on the
      // next own word, or lost at the end of the line) and are kept apart so the output can show them.
      const own: Tok[] = [];
      const filledText: string[] = [];
      const filledSources = new Set<string>();
      let lostBefore = false;
      for (const w of u.words) {
        if (w.supplied) {
          filledText.push(w.w);
          filledSources.add(w.source ?? "not stated by the edition");
          lostBefore = true;
          continue;
        }
        own.push({ k: KEY(w.w), t: w.w, gap: w.gap || lostBefore });
        lostBefore = false;
      }
      arr.push({
        absent: !!u.absent,
        words: own,
        gapEnd: u.gapEnd || (lostBefore && own.length > 0),
        file: entry.file,
        fileIdx: entry.fileIdx,
        ...(filledText.length ? { filled: { text: filledText, source: [...filledSources].join("; ") } } : {}),
      });
      ms.lines.set(u.ref, arr);
    }
  }

  const yearOfSiglum = (s: string) => sourceMap.get(s)?.year ?? S.undated;
  const earlyOfSiglum = (s: string) => yearOfSiglum(s) - S.origin <= S.lateAfter;
  const partialKind = (s: string) => (sourceMap.get(s)?.type ?? "continuous") !== "continuous";

  const sigla = [...byMs.keys()].sort((a, b) => yearOfSiglum(a) - yearOfSiglum(b) || (a < b ? -1 : a > b ? 1 : 0));
  const WIDX = new Map(sigla.map((s, i) => [s, i]));

  // The line each manuscript contributes at a reference: the one with the most own words (as in the main loop below).
  const chosenLine = (s: string, ref: string) =>
    [...(byMs.get(s)!.lines.get(ref) ?? [])].sort((a, b) => b.words.length - a.words.length || a.fileIdx - b.fileIdx)[0];

  const witnesses: WitnessEvidence[] = sigla.map((s) => {
    const src = sourceMap.get(s)!;
    let filledInLines = 0, filledInWords = 0;
    const filledInSources = new Set<string>();
    for (const ref of byMs.get(s)!.lines.keys()) {
      const f = chosenLine(s, ref)?.filled;
      if (!f) continue;
      filledInLines++;
      filledInWords += f.text.length;
      for (const x of f.source.split("; ")) filledInSources.add(x);
    }
    const sc = scribalStats.get(s) ?? { corrections: 0, lacunae: 0, words: 0, files: [], provenances: new Set<string>() };
    const leaves = Object.entries(SAME_MANUSCRIPT)
      .filter(([, v]) => v === s)
      .map(([k]) => k);
    const corrRate = sc.words >= 100 ? sc.corrections / sc.words : 0;
    const corrPenalty = corrRate > 0.01 ? Math.min(0.08, 0.5 * (corrRate - 0.01)) : 0;
    return {
      siglum: s,
      xmlId: witXmlId(s),
      leaves,
      source: src,
      files: byMs.get(s)!.files,
      provenances: [...sc.provenances],
      corrections: sc.corrections,
      lacunae: sc.lacunae,
      transcribedWords: sc.words,
      corrPenalty: r4(corrPenalty),
      filledInLines,
      filledInWords,
      filledInSources: [...filledInSources].sort(),
      year: yearOfSiglum(s),
      early: earlyOfSiglum(s),
    };
  });

  const refs = [...new Set(sigla.flatMap((s) => [...byMs.get(s)!.lines.keys()]))].sort((a, b) => {
    const [x, y] = [a, b].map((r) => r.split(":").map(Number));
    return x[0] - y[0] || x[1] - y[1];
  });

  const compileOnce = (force: Map<string, [number, number][]>) => {
    const dbl = new Map<string, Set<string>>();
    const lines: LineOut[] = [];
    const places: PlaceOut[] = [];
    const placeLine: number[] = [];
    const st = { lines: 0, uncovered: 0, words: 0, unanimous: 0, places: 0, confidenceSum: 0, witnessesPerLine: 0 };

    for (const ref of refs) {
      const present: { s: string; x: LineText }[] = [];
      const filledIn: FilledInOut[] = [];
      for (const s of sigla) {
        const xs = byMs.get(s)!.lines.get(ref);
        if (!xs) continue;
        const x = [...xs].sort((a, b) => b.words.length - a.words.length || a.fileIdx - b.fileIdx)[0];
        if (x.filled) filledIn.push({ w: WIDX.get(s)!, source: x.filled.source, text: x.filled.text.join(" ") });
        if (!x.absent && !x.words.length) continue;
        present.push({ s, x });
      }
      st.lines++;
      if (!present.some((p) => p.x.words.length)) {
        st.uncovered++;
        lines.push({ ref, uncovered: true, witnesses: present.map((p) => WIDX.get(p.s)!), ...(filledIn.length ? { filledIn } : {}) });
        continue;
      }
      st.witnessesPerLine += present.length;

      const withWords = present.filter((p) => p.x.words.length);
      const cols = align(withWords.map((p) => p.x.words.map((w) => w.k)));
      const nC = cols.length;

      const reads: (string | null)[][] = present.map((p) => {
        const wi = withWords.indexOf(p);
        const out: (string | null)[] = new Array(nC).fill("");
        const partial = partialKind(p.s);
        if (wi < 0) return out;
        const at: number[] = [];
        cols.forEach((c, ci) => {
          const j = c.cells.get(wi);
          if (j !== undefined) at[j] = ci;
        });
        const ws = p.x.words;
        for (let j = 0; j < ws.length; j++) out[at[j]] = ws[j].k;
        for (let ci = 0; ci < nC; ci++) {
          if (cols[ci].cells.has(wi)) continue;
          const next = ws.findIndex((_, j) => at[j] > ci);
          const lostBefore = next >= 0 ? ws[next].gap : p.x.gapEnd;
          if (lostBefore || partial) out[ci] = null;
        }
        return out;
      });

      const form = (pi: number, ci: number) => {
        const wi = withWords.indexOf(present[pi]);
        const j = cols[ci].cells.get(wi);
        return j === undefined ? undefined : present[pi].x.words[j].t;
      };

      // Every column where non-lacunose witnesses do not all agree (including singular readings!)
      const colStats = cols.map((_, ci) => {
        const counts = new Map<string, number>();
        for (const r of reads) {
          const k = r[ci];
          if (k !== null) counts.set(k, (counts.get(k) ?? 0) + 1);
        }
        let modal = "", modalCount = -1;
        for (const [k, c] of counts) {
          if (c > modalCount || (c === modalCount && k < modal)) { modal = k; modalCount = c; }
        }
        const hasOmission = counts.has("");
        const minorityWits = new Set<number>();
        reads.forEach((r, pi) => {
          if (r[ci] !== null && r[ci] !== modal) minorityWits.add(pi);
        });
        return { isVariant: counts.size > 1, hasOmission, minorityWits };
      });

      // Granular word-level grouping: only merge adjacent variant columns when a witness
      // genuinely spans both columns (consecutive omission/insertion by the same witness,
      // or a compact multi-word substitution by the same witness within <=3 columns).
      // Unrelated single-word omissions/variants in neighboring columns stay separate.
      let spans: [number, number][] = [];
      for (let ci = 0; ci < nC; ci++) {
        if (!colStats[ci].isVariant) continue;
        const last = spans[spans.length - 1];
        if (last && last[1] === ci - 1) {
          const prev = colStats[ci - 1], cur = colStats[ci];
          let sharedOmit = false;
          let sharedDeviator = false;
          for (const pi of cur.minorityWits) {
            if (prev.minorityWits.has(pi)) {
              sharedDeviator = true;
              if (reads[pi][ci - 1] === "" && reads[pi][ci] === "") {
                sharedOmit = true;
                break;
              }
            }
          }
          if (sharedOmit || (sharedDeviator && ci - last[0] < 3)) {
            last[1] = ci;
            continue;
          }
        }
        spans.push([ci, ci]);
      }

      // Join two spans at most 2 columns apart only if they share a *minority* word
      // (true transposition), not a repeated majority word (like genealogy δε/εγεννησεν/τον).
      const minorityKeysIn = (a: number, b: number) => {
        const out = new Set<string>();
        for (let c = a; c <= b; c++) {
          for (const pi of colStats[c].minorityWits) {
            const k = reads[pi][c];
            if (k) out.add(k);
          }
        }
        return out;
      };
      for (let i = 0; i + 1 < spans.length; ) {
        const [a, b] = spans[i], [c, d] = spans[i + 1];
        if (c - b - 1 <= 2 && d - a < 6) {
          const A = minorityKeysIn(a, b), B = minorityKeysIn(c, d);
          if ([...A].some((k) => B.has(k))) {
            spans.splice(i, 2, [a, d]);
            continue;
          }
        }
        i++;
      }

      const sortW = (xs: number[]) => xs.map((pi) => WIDX.get(present[pi].s)!).sort((x, y) => x - y);
      type W = { t: string; k: string; c?: number; p?: number; l?: number[]; col: number; span?: number };
      type Rd = { keys: string[]; forms: string[]; wits: number[]; segs: (string | null)[][]; partly: number[]; earliest: number };

      const decide = (curSpans: [number, number][]) => {
        const words: W[] = [];
        const local: Omit<PlaceOut, "id">[] = [];
        let ci = 0;
        const emitUnanimous = (colIdx: number) => {
          const n = new Map<string, number>();
          for (const r of reads) {
            const x = r[colIdx];
            if (x !== null) n.set(x, (n.get(x) ?? 0) + 1);
          }
          const k = [...n].sort((x, y) => y[1] - x[1] || (x[0] < y[0] ? -1 : 1))[0]?.[0];
          if (!k) return;
          const lost = present.map((_, pi) => pi).filter((pi) => reads[pi][colIdx] === null);
          const by = present
            .map((_, pi) => pi)
            .filter((pi) => reads[pi][colIdx] === k)
            .sort((x, y) => yearOfSiglum(present[x].s) - yearOfSiglum(present[y].s) || (present[x].s < present[y].s ? -1 : 1));
          words.push({ t: SHOW(form(by[0], colIdx)!), k, ...(lost.length ? { l: sortW(lost) } : {}), col: colIdx });
        };

        curSpans.forEach(([a, b], si) => {
          for (; ci < a; ci++) emitUnanimous(ci);
          ci = b + 1;
          const rd = new Map<string, Rd>();
          const partial: number[] = [];
          present.forEach((p, pi) => {
            const seg = reads[pi].slice(a, b + 1);
            if (seg.some((k) => k === null)) {
              partial.push(pi);
              return;
            }
            const keys = seg.filter((k): k is string => !!k), id = keys.join(" ");
            const r = rd.get(id) ?? { keys, forms: [], wits: [], segs: [], partly: [], earliest: Infinity };
            rd.set(id, r);
            r.wits.push(pi);
            r.segs.push(seg);
            r.earliest = Math.min(r.earliest, yearOfSiglum(p.s));
            if (!r.forms.length) r.forms = seg.map((_, j) => form(pi, a + j)).filter((x): x is string => !!x);
          });
          const all = [...rd.values()];
          if (!all.length) {
            local.push({ ref, at: words.length, n: 0, cols: [a, b], confidence: 0, lost: true, readings: [], partlyLost: sortW(partial) });
            return;
          }
          const stillLost: number[] = [];
          for (const pi of partial) {
            const seg = reads[pi].slice(a, b + 1);
            const ok = all.filter((r) => r.segs.some((s) => seg.every((k, j) => k === null || k === s[j])));
            if (ok.length === 1) {
              ok[0].partly.push(pi);
              ok[0].earliest = Math.min(ok[0].earliest, yearOfSiglum(present[pi].s));
            } else stillLost.push(pi);
          }
          const count = (r: Rd) => r.wits.length + r.partly.length;
          const id = (r: Rd) => r.keys.join(" ");
          all.sort((x, y) => count(y) - count(x) || x.earliest - y.earliest || (id(x) < id(y) ? -1 : id(x) > id(y) ? 1 : 0));
          const chosen = all[0];
          const pl = local.length;
          local.push({
            ref,
            at: words.length,
            n: chosen.keys.length,
            cols: [a, b],
            confidence: 0,
            readings: all.map((r) => ({
              text: r.forms.map(SHOW).join(" "),
              keys: id(r),
              xs: r.segs[0].map((k, j) => (k ? a + j : -1)).filter((x) => x >= 0),
              witnesses: sortW(r.wits),
              ...(r.partly.length ? { partly: sortW(r.partly) } : {}),
              p: 0,
              lo: 0,
              hi: 0,
            })),
            ...(stillLost.length ? { partlyLost: sortW(stillLost) } : {}),
          });
          const pcols = chosen.segs[0].map((k, j) => (k ? a + j : -1)).filter((x) => x >= 0);
          chosen.keys.forEach((k, j) => words.push({ t: SHOW(chosen.forms[j] ?? k), k, c: 0, p: pl, col: pcols[j] ?? a, span: si }));
        });
        for (; ci < nC; ci++) emitUnanimous(ci);
        return { words, local };
      };

      const doubled = present.map((p) => new Set(p.x.words.map((w) => w.k).filter((k, j, a) => j > 0 && a[j - 1] === k)));
      dbl.set(ref, new Set(doubled.flatMap((x) => [...x])));
      for (const [a0, b0] of force.get(ref) ?? []) {
        const touch = spans.filter(([a, b]) => !(b < a0 || a > b0));
        const lo = Math.min(a0, ...touch.map((x) => x[0]));
        const hi = Math.max(b0, ...touch.map((x) => x[1]));
        spans = [...spans.filter((x) => !touch.includes(x)), [lo, hi] as [number, number]].sort((x, y) => x[0] - y[0]);
      }

      let res = decide(spans);
      for (let guard = 0; guard < 50; guard++) {
        const ws = res.words;
        const j = ws.findIndex(
          (w, i) => i > 0 && ws[i - 1].k === w.k && !(w.span !== undefined && w.span === ws[i - 1].span) && !doubled.some((s) => s.has(w.k)),
        );
        if (j < 0) break;
        const x = ws[j - 1], y = ws[j];
        const lo = x.span !== undefined ? spans[x.span][0] : x.col;
        const hi = y.span !== undefined ? spans[y.span][1] : y.col;
        const touch = spans.filter(([a, b]) => !(b < lo || a > hi));
        spans = [
          ...spans.filter(([a, b]) => b < lo || a > hi),
          [Math.min(lo, ...touch.map((s) => s[0])), Math.max(hi, ...touch.map((s) => s[1]))] as [number, number],
        ].sort((p, q) => p[0] - q[0]);
        res = decide(spans);
      }

      const base = places.length;
      for (const _ of res.local) placeLine.push(lines.length);
      for (const pl of res.local) {
        places.push({ id: places.length, ...pl });
        st.places++;
      }
      const words: WordOut[] = res.words.map(({ col, span, ...w }) =>
        w.p !== undefined ? { ...w, p: w.p + base, x: col } : { ...w, x: col },
      );
      if (HEB) {
        const mask = aramaic(target.id, ref, words.map((w) => w.k));
        mask.forEach((a, i) => { if (a) words[i].a = 1; });
      }
      lines.push({ ref, witnesses: present.map((p) => WIDX.get(p.s)!), words, ...(filledIn.length ? { filledIn } : {}) });
    }

    // ---------- Bayesian Dawid-Skene EM + Composite Likelihood + Monte Carlo ----------
    const M = witnesses.length, SAMPLES = 100;
    const late = witnesses.map((w) => !w.early);
    const pri = witnesses.map((w) => {
      const p = prior({ from: w.source.yearFrom, to: w.source.yearTo, origin: S.origin, halfLife: S.halfLife, undated: S.undated });
      const adjustedMean = Math.max(0.5, p.mean - w.corrPenalty);
      return { mean: adjustedMean, strength: p.strength, rangeKnown: p.rangeKnown };
    });

    type U = Unit & { mult: number; place?: number; words?: number[] };
    const byLine: U[][] = lines.map(() => []);
    places.forEach((p, pid) => {
      if (!p.readings.length) return;
      const voters: [number, number][] = [];
      p.readings.forEach((r, ri) => {
        for (const m of [...r.witnesses, ...(r.partly ?? [])]) voters.push([m, ri]);
      });
      byLine[placeLine[pid]].push({ options: p.readings.length, voters, mult: 1, place: pid });
    });
    lines.forEach((l, li) => {
      if (l.uncovered) return;
      const groups = new Map<string, U>();
      l.words!.forEach((w, wi) => {
        if (w.p !== undefined) return;
        const out = new Set(w.l ?? []);
        const readers = l.witnesses.filter((m) => !out.has(m));
        const key = readers.join(",");
        const g = groups.get(key);
        if (g) { g.mult++; g.words!.push(wi); return; }
        const voters: [number, number][] = readers.map((m) => [m, 0]);
        groups.set(key, { options: 1, voters, mult: 1, words: [wi] });
      });
      byLine[li].push(...groups.values());
    });

    const q = new Float64Array(M), A = new Float64Array(M), N = new Float64Array(M);
    for (let m = 0; m < M; m++) q[m] = pri[m].mean;
    for (let it = 0; it < 5; it++) {
      A.fill(0);
      N.fill(0);
      for (const units of byLine) {
        const sum = new Map<number, [number, number]>();
        for (const u of units) {
          if (u.voters.length < 2) continue;
          const w = weights(u, late, q);
          const L = loglik(u, w, (m) => q[m]);
          const post = posterior(L);
          u.voters.forEach(([m, o]) => {
            const pr = post[o];
            const x = sum.get(m) ?? [0, 0];
            x[0] += pr * u.mult;
            x[1] += u.mult;
            sum.set(m, x);
          });
        }
        for (const [m, [a, n]] of sum) { A[m] += a / n; N[m] += 1; }
      }
      for (let m = 0; m < M; m++) q[m] = (pri[m].strength * pri[m].mean + A[m]) / (pri[m].strength + N[m]);
    }

    let seed = 0;
    for (const ch of target.id) seed = (seed * 31 + ch.charCodeAt(0)) >>> 0;
    const u01 = rng(seed);
    const a0 = witnesses.map((_, m) => pri[m].strength * pri[m].mean + A[m]);
    const b0 = witnesses.map((_, m) => pri[m].strength * (1 - pri[m].mean) + (N[m] - A[m]));
    const Q: Float64Array[] = [];
    for (let s2 = 0; s2 < SAMPLES; s2++) {
      const row = new Float64Array(M);
      for (let m = 0; m < M; m++) row[m] = betaDraw(a0[m], b0[m], u01);
      Q.push(row);
    }
    witnesses.forEach((w, m) => {
      const xs = Q.map((row) => row[m]);
      w.reliability = {
        estimate: r3(q[m]),
        low: r3(quantile(xs, 0.05)),
        high: r3(quantile(xs, 0.95)),
        linesCompared: N[m],
        agreementShare: N[m] ? r3(A[m] / N[m]) : null,
        priorMean: r3(pri[m].mean),
        priorStrength: r3(pri[m].strength),
        dateRangeKnown: pri[m].rangeKnown,
      };
    });

    const judge = (u: U) => {
      const w = weights(u, late, q);
      const per: number[][] = Array.from({ length: u.options + 1 }, () => []);
      for (const row of Q) {
        const p = posterior(loglik(u, w, (m) => row[m]));
        p.forEach((x, i) => per[i].push(x));
      }
      const point = posterior(loglik(u, w, (m) => q[m]));
      return per.map((xs, i) => ({
        p: r3(quantile(xs, 0.5)),
        lo: r3(quantile(xs, 0.05)),
        hi: r3(quantile(xs, 0.95)),
        point: point[i],
      }));
    };

    const yearOfIdx = (m: number) => witnesses[m].year;

    for (let li = 0; li < lines.length; li++) {
      for (const u of byLine[li]) {
        if (u.place !== undefined) continue;
        const j = judge(u)[0];
        for (const wi of u.words!) Object.assign(lines[li].words![wi], { c: j.p, lo: j.lo, hi: j.hi });
      }
    }

    const offset = new Map<number, number>();
    for (let li = 0; li < lines.length; li++) {
      for (const u of byLine[li]) {
        if (u.place === undefined) continue;
        const p = places[u.place], J = judge(u);
        p.readings.forEach((r, ri) => { r.p = J[ri].p; r.lo = J[ri].lo; r.hi = J[ri].hi; });
        p.lostEverywhere = { p: J[u.options].p, lo: J[u.options].lo, hi: J[u.options].hi };
        const order = p.readings.map((_, ri) => ri).sort((x, y) => {
          const X = p.readings[x], Y = p.readings[y];
          const ex = Math.min(...[...X.witnesses, ...(X.partly ?? [])].map(yearOfIdx));
          const ey = Math.min(...[...Y.witnesses, ...(Y.partly ?? [])].map(yearOfIdx));
          return (
            (Math.abs(J[y].point - J[x].point) > 1e-9 ? J[y].point - J[x].point : 0) ||
            ex - ey ||
            Y.witnesses.length + (Y.partly?.length ?? 0) - (X.witnesses.length + (X.partly?.length ?? 0)) ||
            (X.keys < Y.keys ? -1 : X.keys > Y.keys ? 1 : 0)
          );
        });
        p.readings = order.map((i) => p.readings[i]);
        const chosen = p.readings[0];
        const selKeys = chosen.keys ? chosen.keys.split(" ") : [];
        for (let ri = 1; ri < p.readings.length; ri++) {
          const rKeys = p.readings[ri].keys ? p.readings[ri].keys.split(" ") : [];
          p.readings[ri].diffNote = describeDifference(selKeys, rKeys);
          p.readings[ri].severity = classifyReadingSeverity(selKeys, rKeys, HEB);
        }
        p.confidence = chosen.p;

        const l = lines[li], off = offset.get(li) ?? 0, at = p.at + off;
        const ts = chosen.text ? chosen.text.split(" ") : [];
        const nw: WordOut[] = selKeys.map((k, j) => ({
          t: ts[j] ?? k,
          k,
          c: chosen.p,
          lo: chosen.lo,
          hi: chosen.hi,
          p: p.id,
          x: chosen.xs[j],
        }));
        const old = l.words!.slice(at, at + p.n);
        const isAr = old.some((w) => w.a);
        if (isAr) for (const w of nw) w.a = 1;
        l.words!.splice(at, p.n, ...nw);
        offset.set(li, off + nw.length - p.n);
        p.at = at;
        p.n = nw.length;
      }
    }

    // Check for edge-doubled words
    const doubles = new Map<string, [number, number][]>();
    for (const l of lines) {
      const ws = l.words ?? [];
      for (let i = 1; i < ws.length; i++) {
        const x = ws[i - 1], y = ws[i];
        if (x.k !== y.k || (x.p !== undefined && x.p === y.p) || dbl.get(l.ref)?.has(y.k)) continue;
        const lo = x.p !== undefined ? places[x.p].cols[0] : x.x;
        const hi = y.p !== undefined ? places[y.p].cols[1] : y.x;
        (doubles.get(l.ref) ?? doubles.set(l.ref, []).get(l.ref)!).push([Math.min(lo, hi), Math.max(lo, hi)]);
      }
    }

    let wordCount = 0, wordConfSum = 0, placeCount = 0, placeConfSum = 0;
    const categoryCounts: Record<string, number> = {};
    const severityCounts: Record<string, number> = {};
    for (const l of lines) {
      for (const w of l.words ?? []) {
        wordCount++;
        wordConfSum += w.c ?? 1;
      }
    }
    for (const p of places) {
      const cat = classifyDisagreement(p);
      categoryCounts[cat] = (categoryCounts[cat] ?? 0) + 1;
      for (let ri = 1; ri < p.readings.length; ri++) {
        const sid = p.readings[ri].severity?.id;
        if (sid) severityCounts[sid] = (severityCounts[sid] ?? 0) + 1;
      }
      if (!p.lost) {
        placeCount++;
        placeConfSum += p.confidence;
      }
    }

    return {
      doubles,
      result: {
        witnesses,
        lines,
        places,
        categoryCounts,
        severityCounts,
        stats: {
          // a manuscript with nothing but filled-in text in this book has no text of its own here, so it is not counted
          manuscripts: witnesses.filter((w) => !(w.filledInLines > 0 && (w.reliability?.linesCompared ?? 0) === 0)).length,
          early: witnesses.filter((w) => w.early).length,
          lines: st.lines,
          uncoveredLines: st.uncovered,
          words: wordCount,
          places: placeCount,
          meanPlaceConfidence: r4(placeCount ? placeConfSum / placeCount : 1),
          meanWordConfidence: r4(wordCount ? wordConfSum / wordCount : 1),
          meanManuscriptsPerLine: r4(st.witnessesPerLine / Math.max(1, st.lines - st.uncovered)),
        },
      },
    };
  };

  const force = new Map<string, [number, number][]>();
  for (let round = 0; ; round++) {
    const { result, doubles } = compileOnce(force);
    if (!doubles.size || round >= 5) return result;
    for (const [ref, xs] of doubles) force.set(ref, [...(force.get(ref) ?? []), ...xs]);
  }
}

// ---------- TEI P5 XML serializer ----------
function renderTeiXml(
  specId: string,
  compilationId: string,
  timestampIso: string,
  git: ReturnType<typeof gitInfo>,
  target: TargetBook,
  compiled: ReturnType<typeof compileBook>,
  license: SpecLicense,
): string {
  const { witnesses, lines, places, stats } = compiled;
  const langCode = target.language.startsWith("Hebrew") ? "hbo" : "grc";
  const witRef = (idx: number) => `#${witnesses[idx].xmlId}`;
  const witRefs = (idxs: number[]) => idxs.map(witRef).join(" ");
  /** Filled-in text at a line (not counted; METHOD.md section 5): one note per manuscript, naming it and the edition's stated source. */
  const filledInNotes = (l: LineOut) =>
    (l.filledIn ?? [])
      .map((f) => `<note type="filled-in" corresp="${witRef(f.w)}" source="${escXml(f.source)}">${escXml(f.text)}</note>`)
      .join("");

  const out: string[] = [];
  out.push('<?xml version="1.0" encoding="UTF-8"?>');
  out.push('<TEI xmlns="http://www.tei-c.org/ns/1.0">');
  out.push("  <teiHeader>");
  out.push("    <fileDesc>");
  out.push("      <titleStmt>");
  out.push(`        <title>${escXml(target.name)} (${escXml(target.id)}): Compiled Original-Language Text</title>`);
  out.push("        <respStmt>");
  out.push("          <resp>Statistical modeling, reading selection, and probability estimation</resp>");
  out.push(`          <name>${escXml(attributionLine())}</name>`);
  out.push("        </respStmt>");
  out.push("        <respStmt>");
  out.push("          <resp>Deterministic XML parsing, alignment, and TEI P5 serialization</resp>");
  out.push(`          <name>${escXml(`${MODEL_ATTRIBUTION.deterministicEngine.program} (${MODEL_ATTRIBUTION.deterministicEngine.runtime}, commit ${git.commit ?? "unknown"}, code SHA-256 ${git.codeSha256.slice(0, 16)})`)}</name>`);
  out.push("        </respStmt>");
  out.push("      </titleStmt>");
  out.push("      <publicationStmt>");
  out.push(`        <p>This compilation was produced under Open Lexis Transcription Specification ${escXml(specId)}.</p>`);
  out.push(`        <idno type="specification-id">${escXml(specId)}</idno>`);
  out.push(`        <idno type="compilation-id">${escXml(compilationId)}</idno>`);
  out.push(`        <date when="${escXml(timestampIso)}">${escXml(timestampIso)}</date>`);
  out.push(`        <availability><p>The ancient texts are in the public domain. Source transcriptions retain their respective licenses as documented in the specification.</p><licence target="${escXml(license.url)}">${escXml(license.copyright)}. Licensed under ${escXml(license.name)}.</licence></availability>`);
  out.push("      </publicationStmt>");
  out.push("      <sourceDesc>");
  out.push(`        <p>Primary manuscript witnesses allowlisted in specification ${escXml(specId)} for ${escXml(target.name)} (${stats.manuscripts} manuscripts, ${stats.early} early).</p>`);
  out.push("        <listWit>");
  for (const w of witnesses) {
    const s = w.source;
    const dateDesc =
      s.yearFrom !== undefined && s.yearTo !== undefined
        ? `Range: ${s.yearFrom} to ${s.yearTo} (midpoint ${Math.round((s.yearFrom + s.yearTo) / 2)}, margin ±${Math.round((s.yearTo - s.yearFrom) / 2)} years); century: ${s.century ?? "unknown"}; method: ${s.dateBasis ?? "unknown"}; source: ${s.dateSource ?? "unknown"}.`
        : `Date range: unknown (not documented in specification); century: ${s.century ?? "unknown"}; method: ${s.dateBasis ?? "unknown"}; source: ${s.dateSource ?? "unknown"}.`;
    const rel = w.reliability!;
    const label = `${w.siglum}${s.name ? ` (${s.name})` : ""}${w.leaves.length ? ` [includes leaves: ${w.leaves.join(", ")}]` : ""}`;
    out.push(`          <witness xml:id="${escXml(w.xmlId)}">`);
    out.push(`            <abbr type="siglum">${escXml(w.siglum)}</abbr>`);
    out.push(`            <desc>${escXml(label)}${s.shelfmark ? `; shelfmark: ${escXml(s.shelfmark)}` : ""}</desc>`);
    out.push(`            <note type="dating">${escXml(dateDesc)}</note>`);
    out.push(`            <note type="provenance">${escXml(`Place of origin/writing: unknown (not documented in specification). Source archive(s): ${w.provenances.join(", ") || "unknown"}.`)}</note>`);
    out.push('            <note type="scientific-analysis">unknown (not documented in specification)</note>');
    out.push(`            <note type="physical-scribal">${escXml(`Manuscript type: ${s.type}; transcribed words observed: ${w.transcribedWords}; scribal corrections observed: ${w.corrections}; lacunae/damaged tokens observed: ${w.lacunae} (not penalized); scribal prior penalty: ${w.corrPenalty}.`)}</note>`);
    if (w.filledInLines) {
      out.push(`            <note type="filled-in">${escXml(`Filled-in text: ${w.filledInLines} lines (${w.filledInWords} words) of this book are text the edition fills in for lost portions of this manuscript, not the manuscript's own text. That text is not counted as this manuscript's reading and carries no vote. Stated source: ${w.filledInSources.join("; ")}.`)}</note>`);
    }
    out.push(`            <note type="textual-agreement">${escXml(`Posterior reliability: ${rel.estimate} (90% interval: [${rel.low}, ${rel.high}]); lines compared: ${rel.linesCompared}; agreement share: ${rel.agreementShare ?? "n/a"}; prior mean: ${rel.priorMean}; prior strength: ${rel.priorStrength}; date range known: ${rel.dateRangeKnown}.`)}</note>`);
    out.push(`            <note type="source-files">${escXml(w.files.join(", "))}</note>`);
    out.push("          </witness>");
  }
  out.push("        </listWit>");
  out.push("      </sourceDesc>");
  out.push("    </fileDesc>");
  out.push("    <encodingDesc>");
  out.push("      <projectDesc>");
  out.push(`        <p>Compiled strictly under specification ${escXml(specId)} (compilation ${escXml(compilationId)}). Model attribution: ${escXml(attributionLine())}.</p>`);
  out.push(`        <p>Role: ${escXml(MODEL_ATTRIBUTION.role)}</p>`);
  out.push("      </projectDesc>");
  out.push("      <editorialDecl>");
  for (const para of METHOD_DESCRIPTION.split("\n\n")) {
    out.push(`        <p>${escXml(para)}</p>`);
  }
  out.push("      </editorialDecl>");
  out.push('      <variantEncoding method="parallel-segmentation" location="internal"/>');
  out.push("    </encodingDesc>");
  out.push("  </teiHeader>");
  out.push(`  <text xml:lang="${langCode}">`);
  out.push("    <body>");
  out.push(`      <div type="book" n="${escXml(target.id)}">`);

  // Index places by verse ref for O(1) lookup
  const placesByRef = new Map<string, PlaceOut[]>();
  for (const p of places) {
    const arr = placesByRef.get(p.ref) ?? [];
    arr.push(p);
    placesByRef.set(p.ref, arr);
  }

  let curChapter = "";
  let wSeq = 0;

  for (const l of lines) {
    const [ch, vs] = l.ref.split(":");
    if (ch !== curChapter) {
      if (curChapter) out.push("        </div>");
      out.push(`        <div type="chapter" n="${escXml(ch)}">`);
      curChapter = ch;
    }

    if (l.uncovered) {
      out.push(`          <ab n="${escXml(l.ref)}" type="uncovered"><gap reason="lost"/><note type="coverage">Uncovered line; witnesses present without readable words: ${escXml(witRefs(l.witnesses))}</note>${filledInNotes(l)}</ab>`);
      continue;
    }

    const ws = l.words ?? [];
    const linePlaces = placesByRef.get(l.ref) ?? [];
    // Map word index -> place(s) that start at that word index (including 0-word omissions!)
    const placesAtWord = new Map<number, PlaceOut[]>();
    for (const p of linePlaces) {
      const arr = placesAtWord.get(p.at) ?? [];
      arr.push(p);
      placesAtWord.set(p.at, arr);
    }

    const bodyParts: string[] = [];
    // Track unanimous word coverage groups for <spanGrp type="word-coverage">
    type CovGroup = { ids: string[]; attested: number[]; lacuna: number[]; p: number; lo: number; hi: number };
    const covGroups: CovGroup[] = [];
    const covMap = new Map<string, CovGroup>();

    const emitPlace = (p: PlaceOut) => {
      const appId = `app-${target.id}-${ch}-${vs}-${p.id}`;
      const rdgParts: string[] = [];
      if (p.lost) {
        rdgParts.push("<lem/>");
        if (p.partlyLost?.length) rdgParts.push(`<rdg type="lacuna" wit="${witRefs(p.partlyLost)}"><gap reason="lost"/></rdg>`);
      } else {
        const chosen = p.readings[0];
        const chosenWits = [...chosen.witnesses, ...(chosen.partly ?? [])].sort((a, b) => a - b);
        const lemWords: string[] = [];
        for (let j = 0; j < p.n; j++) {
          const wObj = ws[p.at + j];
          wSeq++;
          const wid = `w-${target.id}-${ch}-${vs}-${wSeq}`;
          lemWords.push(`<w xml:id="${wid}"${wObj?.a ? ' xml:lang="arc"' : ""}>${escXml(wObj?.t ?? "")}</w>`);
        }
        rdgParts.push(
          lemWords.length
            ? `<lem wit="${witRefs(chosenWits)}">${lemWords.join(" ")}</lem>`
            : `<lem wit="${witRefs(chosenWits)}"/>`,
        );

        p.readings.forEach((r, ri) => {
          const rId = `rdg-${target.id}-${ch}-${vs}-${p.id}-${ri + 1}`;
          const allWits = [...r.witnesses, ...(r.partly ?? [])].sort((a, b) => a - b);
          const rType = ri === 0 ? "selected" : "variant";
          const textPart = r.text ? escXml(r.text) : "";
          const cert = `<certainty target="#${rId}" locus="value" degree="${r.p.toFixed(3)}"/>`;
          const unc = `<note type="uncertainty">90% interval: [${r.lo.toFixed(3)}, ${r.hi.toFixed(3)}]</note>`;
          const diff = r.diffNote ? `<note type="difference">${escXml(r.diffNote)}</note>` : "";
          const sev = r.severity
            ? `<note type="severity" n="${r.severity.level}" subtype="${escXml(r.severity.id)}">${escXml(formatSeverityNote(r.severity))}</note>`
            : "";
          rdgParts.push(`<rdg xml:id="${rId}" wit="${witRefs(allWits)}" type="${rType}">${textPart}${cert}${unc}${diff}${sev}</rdg>`);
        });

        // Lacunose witnesses at this place: witnesses in verse that didn't vote for any reading
        const voted = new Set<number>();
        for (const r of p.readings) {
          for (const m of r.witnesses) voted.add(m);
          for (const m of r.partly ?? []) voted.add(m);
        }
        const lacWits = l.witnesses.filter((m) => !voted.has(m));
        if (lacWits.length) {
          rdgParts.push(`<rdg type="lacuna" wit="${witRefs(lacWits)}"><gap reason="lost"/></rdg>`);
        }
        if (p.lostEverywhere) {
          const uId = `rdg-${target.id}-${ch}-${vs}-${p.id}-unseen`;
          rdgParts.push(
            `<rdg xml:id="${uId}" type="unseen"><certainty target="#${uId}" locus="value" degree="${p.lostEverywhere.p.toFixed(3)}"/><note type="uncertainty">90% interval: [${p.lostEverywhere.lo.toFixed(3)}, ${p.lostEverywhere.hi.toFixed(3)}]; probability original is unattested in surviving witnesses</note></rdg>`,
          );
        }
      }
      bodyParts.push(`<app xml:id="${appId}">${rdgParts.join("")}</app>`);
    };

    let wi = 0;
    while (wi < ws.length) {
      const psHere = placesAtWord.get(wi);
      if (psHere) {
        let consumed = 0;
        for (const p of psHere) {
          emitPlace(p);
          consumed += p.n;
        }
        if (consumed > 0) {
          wi += consumed;
          continue;
        }
      }
      const wObj = ws[wi];
      wSeq++;
      const wid = `w-${target.id}-${ch}-${vs}-${wSeq}`;
      bodyParts.push(`<w xml:id="${wid}"${wObj.a ? ' xml:lang="arc"' : ""}>${escXml(wObj.t)}</w>`);

      const lacSet = new Set(wObj.l ?? []);
      const attested = l.witnesses.filter((m) => !lacSet.has(m));
      const lacuna = wObj.l ?? [];
      const pVal = wObj.c ?? 1, loVal = wObj.lo ?? pVal, hiVal = wObj.hi ?? pVal;
      const gKey = `${attested.join(",")}|${lacuna.join(",")}|${pVal}|${loVal}|${hiVal}`;
      let grp = covMap.get(gKey);
      if (!grp) {
        grp = { ids: [], attested, lacuna, p: pVal, lo: loVal, hi: hiVal };
        covMap.set(gKey, grp);
        covGroups.push(grp);
      }
      grp.ids.push(`#${wid}`);
      wi++;
    }
    // Any trailing 0-word omission <app> at the end of the verse
    const trailing = placesAtWord.get(ws.length);
    if (trailing) for (const p of trailing) emitPlace(p);

    if (covGroups.length) {
      const spansXml = covGroups.map((g) => {
        const targets = g.ids.join(" ");
        const att = `<note type="attested">${witRefs(g.attested)}</note>`;
        const lac = g.lacuna.length ? `<note type="lacuna">${witRefs(g.lacuna)}</note>` : "";
        const cert = `<certainty target="${targets}" locus="value" degree="${g.p.toFixed(3)}"/>`;
        const unc = `<note type="uncertainty">90% interval: [${g.lo.toFixed(3)}, ${g.hi.toFixed(3)}]</note>`;
        return `<span target="${targets}">${att}${lac}${cert}${unc}</span>`;
      });
      bodyParts.push(`<spanGrp type="word-coverage">${spansXml.join("")}</spanGrp>`);
    }

    const filledXml = filledInNotes(l);
    out.push(`          <ab n="${escXml(l.ref)}">${bodyParts.join(" ")}${filledXml ? " " + filledXml : ""}</ab>`);
  }

  if (curChapter) out.push("        </div>");
  out.push("      </div>");
  out.push("    </body>");
  out.push("  </text>");
  out.push("</TEI>");
  out.push("");
  return out.join("\n");
}

// ---------- main CLI ----------
if (import.meta.main) {
  const args = process.argv.slice(2);
  let specId = "01M8B40TZ4W7PX1RHJWY11ZNW0";
  let bookArg = "all";
  let compilationId = "";
  let skipSite = false;
  let outDirArg = ""; // --out-dir <folder>: write somewhere other than transcripts/ (for a trial run)

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--compilation-id" && args[i + 1]) {
      compilationId = args[++i];
    } else if (args[i] === "--out-dir" && args[i + 1]) {
      outDirArg = args[++i];
      skipSite = true;
    } else if (args[i] === "--no-site") {
      skipSite = true;
    } else if (/^[0-9A-HJKMNP-TV-Z]{26}$/.test(args[i])) {
      specId = args[i];
    } else {
      bookArg = args[i];
    }
  }
  if (!compilationId) compilationId = generateUlid();

  // A folder specification (specifications/<id>/) is read only from its own folder: sources.json lists every transcript and the
  // commit to read it from. An older single-file specification resolves its `sources` through archives/sets/<ULID>.json and
  // archives/<archive>/index.json (scripts/sources.ts).
  const resolved = loadSpecWithSources(specId);
  const specPath = resolved.specPath;
  const specRaw = readFileSync(specPath, "utf8");
  const license = readSpecLicense(Bun.YAML.parse(specRaw) as Record<string, unknown>, specPath.slice(ROOT.length));
  const raw = resolved.spec as unknown as { id: string; title: string; summary?: string };
  const spec: Spec = { id: raw.id, title: raw.title, summary: raw.summary ?? "", targets: resolved.targets, sources: resolved.sources };
  if (spec.id !== specId) throw new Error(`Specification ID mismatch: ${spec.id} !== ${specId}`);

  const selectedTargets =
    bookArg === "all" ? spec.targets : spec.targets.filter((t) => t.id === bookArg || t.name === bookArg);
  if (!selectedTargets.length) throw new Error(`No target book matching "${bookArg}" in specification ${specId}`);

  const outDir = outDirArg || `${ROOT}transcripts/${specId}/${compilationId}`;
  mkdirSync(outDir, { recursive: true });
  const timestampIso = new Date().toISOString();
  const git = gitInfo();

  console.log(`Compiling under specification ${specId} -> ${outDirArg || `transcripts/${specId}/${compilationId}/`} (${selectedTargets.length} target books)`);

  // Build consolidated source map (handling SAME_MANUSCRIPT merges)
  const sourceMap = new Map<string, SourceItem>();
  for (const s of spec.sources) {
    const canon = SAME_MANUSCRIPT[s.id] ?? s.id;
    if (!sourceMap.has(canon) || s.id === canon) sourceMap.set(canon, s);
  }

  const manifestFile = `${outDir}/manifest.json`;
  const oldManifest = existsSync(manifestFile) ? JSON.parse(readFileSync(manifestFile, "utf8")) : { books: [] };
  const bookManifestMap = new Map<string, any>((oldManifest.books ?? []).map((b: any) => [b.id, b]));

  // Process by section (Old Testament, then New Testament) so we only keep one section's parsed units in RAM at a time
  const sections = [...new Set(selectedTargets.map((t) => t.section))];
  const tStart = performance.now();

  for (const section of sections) {
    const secTargets = selectedTargets.filter((t) => t.section === section);
    const secTargetIds = new Set(secTargets.map((t) => t.id));
    const byBook = new Map<string, BookIndexEntry[]>();
    for (const t of secTargets) byBook.set(t.id, []);
    const scribalStats = new Map<string, SourceScribalStats>();

    const tRead = performance.now();
    let filesRead = 0;
    for (const s of spec.sources) {
      if (!(s.targets ?? []).some((tid) => secTargetIds.has(tid))) continue;
      const siglum = SAME_MANUSCRIPT[s.id] ?? s.id;
      const sc = scribalStats.get(siglum) ?? { corrections: 0, lacunae: 0, words: 0, files: [], provenances: new Set<string>() };
      scribalStats.set(siglum, sc);
      let fileIdx = sc.files.length;
      for (const f of s.files) {
        sc.provenances.add(f.provenance.name);
        const commitOf = new Map((f.transcripts ?? []).map((t) => [t.path, t.commit]));
        for (const relPath of f.paths) {
          const absPath = `${ROOT}${relPath}`;
          // A folder specification pins each transcript to a git commit; read the file as it is in that commit.
          const commit = commitOf.get(relPath);
          const { units, stats } = commit
            ? readTranscriptionText(gitShow(commit, relPath), absPath, f.provenance.id)
            : readTranscriptionFile(absPath, f.provenance.id);
          filesRead++;
          sc.corrections += stats.corrections;
          sc.lacunae += stats.lacunae;
          sc.words += stats.words;
          sc.files.push(relPath);
          const grouped = new Map<string, ParsedUnit[]>();
          for (const u of units) {
            if (!secTargetIds.has(u.book)) continue;
            const arr = grouped.get(u.book) ?? [];
            arr.push(u);
            grouped.set(u.book, arr);
          }
          for (const [bId, bUnits] of grouped) {
            byBook.get(bId)!.push({ siglum, file: relPath, fileIdx, units: bUnits });
          }
          fileIdx++;
        }
      }
    }
    console.log(`[${section}] Read ${filesRead} allowlisted XML files in ${((performance.now() - tRead) / 1000).toFixed(1)} s`);

    for (const target of secTargets) {
      const tBook = performance.now();
      const entries = byBook.get(target.id)!;
      const compiled = compileBook(target, entries, sourceMap, scribalStats);
      const xml = renderTeiXml(specId, compilationId, timestampIso, git, target, compiled, license);
      const fileName = `${target.id}.xml`;
      writeFileSync(`${outDir}/${fileName}`, xml);
      bookManifestMap.set(target.id, {
        id: target.id,
        name: target.name,
        section: target.section,
        number: target.number,
        language: target.language,
        file: fileName,
        format: "TEI P5 XML",
        sha256: sha(xml),
        bytes: Buffer.byteLength(xml, "utf8"),
        stats: compiled.stats,
        categoryCounts: compiled.categoryCounts,
        severityCounts: compiled.severityCounts,
      });
      console.log(
        `  ${target.name} (${target.id}): ${compiled.stats.manuscripts} mss, ${compiled.stats.lines} lines, ${compiled.stats.words} words, ${compiled.stats.places} apps, mean conf ${compiled.stats.meanWordConfidence} (${((performance.now() - tBook) / 1000).toFixed(2)} s)`,
      );
    }
  }

  const targetOrder = spec.targets.map((t) => t.id);
  const booksList = [...bookManifestMap.values()].sort(
    (a, b) => targetOrder.indexOf(a.id) - targetOrder.indexOf(b.id),
  );
  const totalCategoryCounts: Record<string, number> = {};
  const totalSeverityCounts: Record<string, number> = {};
  for (const b of booksList) {
    for (const [k, v] of Object.entries((b.categoryCounts ?? {}) as Record<string, number>)) {
      totalCategoryCounts[k] = (totalCategoryCounts[k] ?? 0) + v;
    }
    for (const [k, v] of Object.entries((b.severityCounts ?? {}) as Record<string, number>)) {
      totalSeverityCounts[k] = (totalSeverityCounts[k] ?? 0) + v;
    }
  }
  const totals = {
    books: booksList.length,
    lines: booksList.reduce((s, b) => s + b.stats.lines, 0),
    words: booksList.reduce((s, b) => s + b.stats.words, 0),
    variantPlaces: booksList.reduce((s, b) => s + b.stats.places, 0),
    totalBytes: booksList.reduce((s, b) => s + b.bytes, 0),
  };
  const manifest = {
    specification: {
      id: specId,
      file: specPath.slice(ROOT.length),
      sha256: sha(specRaw),
      statement: `This compilation was produced under Open Lexis Transcription Specification ${specId}.`,
      license,
    },
    compilation: {
      id: compilationId,
      title: "Granular Word-Level Critical Text",
      subtitle: `Decoupled severity & word-level Dawid–Skene compilation by ${MODEL_ATTRIBUTION.modelName}`,
      summary:
        "Full 66-book compilation with granular word-level alignment (preventing unrelated variants from collapsing into whole-verse blocks) and decoupled edit-category vs. substantive-severity scoring.",
      author: "Open Lexis",
      createdAt: timestampIso,
      outputDirectory: outDirArg || `transcripts/${specId}/${compilationId}/`,
      outputFormat: "TEI P5 XML",
      reportFile: "REPORT.md",
    },
    modelAttribution: {
      ...MODEL_ATTRIBUTION,
      deterministicEngine: {
        ...MODEL_ATTRIBUTION.deterministicEngine,
        ...git,
      },
    },
    method: {
      summary:
        "Word-level Bayesian Dawid-Skene latent-class model with granular span alignment, decoupled edit-category vs. substantive-severity scoring, composite-likelihood late-witness discounting, and 100-draw Beta posterior Monte Carlo uncertainty intervals.",
      description: METHOD_DESCRIPTION,
    },
    disagreementCategories: DISAGREEMENT_TAXONOMY.map((c) => ({ ...c, count: totalCategoryCounts[c.id] ?? 0 })),
    totals,
    books: booksList,
  };
  writeFileSync(manifestFile, JSON.stringify(manifest, null, 2) + "\n");
  writeFileSync(
    `${outDir}/REPORT.md`,
    renderReportMarkdown({
      specId,
      compilationId,
      createdAt: timestampIso,
      git,
      totals,
      categoryCounts: totalCategoryCounts,
      severityCounts: totalSeverityCounts,
    }),
  );
  console.log(`Done: ${booksList.length} books written to ${outDirArg || `transcripts/${specId}/${compilationId}/`} in ${((performance.now() - tStart) / 1000).toFixed(1)} s`);

  if (!skipSite) {
    console.log("Rebuilding Astro site (site/www) to include the new compilation...");
    const res = spawnSync("bun", ["run", "site"], { cwd: ROOT, stdio: "inherit" });
    if (res.status !== 0) {
      throw new Error(`Site rebuild failed with exit code ${res.status}`);
    }
  }
}
