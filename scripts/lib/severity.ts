// Disagreement severity & subcategory classifier for variant readings.
// Evaluates how severe a variant reading is relative to the selected reading
// and documents both its local word-confidence effect and corpus authenticity signal.
import { dice } from "./align";

export interface SeverityDef {
  level: 1 | 2 | 3 | 4 | 5;
  id: string;
  label: string;
  shortLabel: string;
  description: string;
  localConfidenceEffect: string;
  corpusAuthenticityEffect: string;
  confidenceEffect: string;
}

export const SEVERITY_SCALE = {
  min: 1,
  max: 5,
  description: "Model-chosen 1 (minor mechanical/orthographic slip) to 5 (unexplained major lexical divergence) scale.",
};

export const SEVERITY_TAXONOMY: SeverityDef[] = [
  {
    level: 1,
    id: "orthographic_or_scribal_slip",
    label: "Orthographic / Scribal Slip",
    shortLabel: "Minor (1/5)",
    description:
      "Single-letter misspelling, transposition of adjacent letters, or minor transcription slip on a virtually identical word.",
    localConfidenceEffect:
      "Reduces local confidence in the erring witness's reading at this point while increasing confidence in the cleanly attested competing reading.",
    corpusAuthenticityEffect:
      "Positive: authentic independent human copying naturally produces minor slips; artificial uniformity across centuries of physical decay would be anomalous.",
    confidenceEffect:
      "Reduces local confidence in the erring witness at this point while reinforcing authentic independent human transmission and increasing confidence in the cleaner competing witness.",
  },
  {
    level: 2,
    id: "particle_or_article_variation",
    label: "Particle / Article / Function-Word Variation",
    shortLabel: "Low (2/5)",
    description:
      "Omission, addition, or swap of a common particle, conjunction, article, or preposition (such as Greek δε, και, or the definite article) with minimal impact on core meaning.",
    localConfidenceEffect:
      "Modestly reduces local phrasing certainty where witnesses split.",
    corpusAuthenticityEffect:
      "Positive: reflects expected scribal style and dialectal habits across independent lineages.",
    confidenceEffect:
      "Modestly reduces local phrasing certainty where witnesses split; reflects normal scribal style and dialectal habits consistent with genuine transmission.",
  },
  {
    level: 2,
    id: "grammatical_or_stylistic_nuance",
    label: "Grammatical / Stylistic Nuance",
    shortLabel: "Low (2/5)",
    description:
      "Shared-stem inflectional/morphological variation or word-order transposition of identical words.",
    localConfidenceEffect:
      "Modestly reduces local phrasing certainty where witnesses split.",
    corpusAuthenticityEffect:
      "Positive: reflects expected scribal style and dialectal habits across independent lineages.",
    confidenceEffect:
      "Modestly reduces local phrasing certainty where witnesses split; reflects normal scribal style and dialectal habits consistent with genuine transmission.",
  },
  {
    level: 3,
    id: "phonetic_or_confusable_form",
    label: "Sound-Alike / Visually Confusable Form",
    shortLabel: "Moderate (3/5)",
    description:
      "A different word that sounds alike in Koine Greek or Biblical Hebrew pronunciation (itacism, vowel/guttural shift) or shares visually confusable letters.",
    localConfidenceEffect:
      "Reduces local confidence in the erring witness's reading while increasing overall confidence in the competing witness that lacks the phonetic error.",
    corpusAuthenticityEffect:
      "Positive: natural auditory/visual copying confusion increases confidence that the witness is an authentic human copy rather than a harmonized fabrication.",
    confidenceEffect:
      "Reduces local confidence in the erring witness while increasing confidence that the witness is authentic and raising overall confidence in the better competing witness lacking the error.",
  },
  {
    level: 4,
    id: "substantive_structural_variation",
    label: "Substantive Phrase / Omission / Addition",
    shortLabel: "High (4/5)",
    description:
      "Omission or addition of content word(s) or a multi-word phrase difference with unequal word counts.",
    localConfidenceEffect:
      "Substantially lowers local certainty where early witnesses split; resolved by independent early witness weight rather than majority count.",
    corpusAuthenticityEffect:
      "Neutral: reflects genuine textual divergence across transmission streams.",
    confidenceEffect:
      "Substantially affects local textual certainty and clause scope; resolved by early, independent witness weight rather than majority count.",
  },
  {
    level: 5,
    id: "unexplained_lexical_divergence",
    label: "Unexplained Lexical Divergence",
    shortLabel: "Critical (5/5)",
    description:
      "An entirely different lexical item with no obvious orthographic, grammatical, or phonetic bridge to the selected reading (or an unresolved lacuna).",
    localConfidenceEffect:
      "Strongly reduces local confidence unless settled by strong independent early witnesses.",
    corpusAuthenticityEffect:
      "Requires scrutiny: signals a deep textual or redactional split rather than a mechanical copying slip.",
    confidenceEffect:
      "Strongly reduces local confidence unless settled by strong independent early witnesses; signals a deep textual split rather than a mechanical slip.",
  },
];

export const SEVERITY_BY_ID = new Map(SEVERITY_TAXONOMY.map((s) => [s.id, s]));

// Common short function words / particles / articles / conjunctions (normalized keys)
const GREEK_FUNC = new Set([
  "και", "δε", "ο", "η", "το", "τον", "την", "των", "τοισ", "τασ", "του", "τησ", "τα", "οι", "αι", "τω", "τη",
  "τε", "ουν", "γαρ", "εν", "εισ", "ισ", "εκ", "εξ", "επι", "προσ", "απο", "δια", "μετα", "υπο", "κατα", "παρα", "περι",
  "αυτου", "αυτω", "αυτον", "αυτη", "αυτησ", "αυτην", "αυτων", "αυτοισ", "αυτουσ", "αυτα", "αυτο", "αυτοσ",
  "ου", "ουκ", "ουχ", "μη", "οτι", "ινα", "ωσ", "ει", "ι", "αν", "μεν", "αλα", "ηδη", "νυν", "σου", "μου", "μοι", "σοι", "με", "σε",
]);

const HEBREW_FUNC = new Set([
  "את", "אתה", "ה", "ו", "כי", "אל", "על", "לא", "לוא", "כל", "מן", "מ", "ב", "ל", "כ", "אשר", "גם", "הוא", "היא", "הם", "המה",
  "לו", "לה", "להם", "לי", "לך", "לנו", "בו", "בה", "בהם", "בי", "בך", "עליו", "אליו", "אליהם", "עליהם", "הנה", "עתה", "אז", "אם", "פן", "עד",
]);

function levenshtein(a: string, b: string): number {
  const m = a.length, n = b.length;
  if (Math.abs(m - n) > 3) return Math.abs(m - n);
  let prev = new Int32Array(n + 1);
  let cur = new Int32Array(n + 1);
  for (let j = 0; j <= n; j++) prev[j] = j;
  for (let i = 1; i <= m; i++) {
    cur[0] = i;
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + cost);
    }
    const tmp = prev;
    prev = cur;
    cur = tmp;
  }
  return prev[n];
}

function phoneticFold(w: string, isHebrew: boolean): string {
  if (isHebrew) {
    // Merge common Hebrew guttural / sibilant / stop / graphic confusables
    return w
      .replace(/[^\u05D0-\u05EA]/g, "")
      .replace(/[ך]/g, "כ").replace(/[ם]/g, "מ").replace(/[ן]/g, "נ").replace(/[ף]/g, "פ").replace(/[ץ]/g, "צ")
      .replace(/[אהע]/g, "א")
      .replace(/[חכק]/g, "כ")
      .replace(/[טת]/g, "ת")
      .replace(/[סש]/g, "ש")
      .replace(/[דר]/g, "ד")
      .replace(/[וי]/g, "");
  }
  // Koine Greek phonetic folding (itacism, vowel mergers, aspirate/stop pairs)
  return w
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[ςϲ]/g, "σ")
    .replace(/αι/g, "ε")
    .replace(/οι|ει|η|υ/g, "ι")
    .replace(/ω/g, "ο")
    .replace(/αυ|ευ/g, "αφ")
    .replace(/θ/g, "τ")
    .replace(/φ/g, "π")
    .replace(/χ/g, "κ")
    .replace(/ζ/g, "σ")
    .replace(/(.)\1/g, "$1");
}

function commonPrefixLen(a: string, b: string): number {
  const n = Math.min(a.length, b.length);
  let i = 0;
  while (i < n && a[i] === b[i]) i++;
  return i;
}

const LEVEL_LABELS: Record<1 | 2 | 3 | 4 | 5, string> = {
  1: "Minor (1/5)",
  2: "Low (2/5)",
  3: "Moderate (3/5)",
  4: "High (4/5)",
  5: "Critical (5/5)",
};

function withLevel(base: SeverityDef, level: 1 | 2 | 3 | 4 | 5): SeverityDef {
  if (base.level === level) return base;
  return { ...base, level, shortLabel: LEVEL_LABELS[level] };
}

/** Extract only the words that differ (omitted from sel or added in rdg) via word-level LCS. */
function diffChangedWords(selKeys: string[], rdgKeys: string[]): { omitted: string[]; added: string[] } {
  const m = selKeys.length;
  const n = rdgKeys.length;
  if (m * n > 2500) return { omitted: selKeys, added: rdgKeys };
  const dp: number[][] = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  for (let i = m - 1; i >= 0; i--) {
    for (let j = n - 1; j >= 0; j--) {
      dp[i][j] = selKeys[i] === rdgKeys[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }
  const omitted: string[] = [];
  const added: string[] = [];
  let i = 0;
  let j = 0;
  while (i < m && j < n) {
    if (selKeys[i] === rdgKeys[j]) {
      i++;
      j++;
    } else if (dp[i + 1][j] >= dp[i][j + 1]) {
      omitted.push(selKeys[i++]);
    } else {
      added.push(rdgKeys[j++]);
    }
  }
  while (i < m) omitted.push(selKeys[i++]);
  while (j < n) added.push(rdgKeys[j++]);
  return { omitted, added };
}

/**
 * Classify a competing reading relative to the selected reading, decoupling
 * the mechanical edit category (`id`/`label`) from substantive severity (`level` 1–5).
 */
export function classifyReadingSeverity(selKeys: string[], rdgKeys: string[], isHebrew: boolean): SeverityDef {
  const funcSet = isHebrew ? HEBREW_FUNC : GREEK_FUNC;

  // 1. Pure omission or addition
  if ((rdgKeys.length === 0 && selKeys.length > 0) || (selKeys.length === 0 && rdgKeys.length > 0)) {
    const words = rdgKeys.length ? rdgKeys : selKeys;
    const contentWords = words.filter((w) => !funcSet.has(w));
    if (contentWords.length === 0) {
      return withLevel(SEVERITY_BY_ID.get("particle_or_article_variation")!, words.length === 1 ? 1 : 2);
    }
    if (contentWords.length === 1) {
      return withLevel(SEVERITY_BY_ID.get("substantive_structural_variation")!, 3);
    }
    return withLevel(
      SEVERITY_BY_ID.get("substantive_structural_variation")!,
      contentWords.length >= 4 ? 5 : 4,
    );
  }

  // 2. Unequal non-empty lengths -> inspect the actual differing words instead of assuming Level 4
  if (selKeys.length !== rdgKeys.length) {
    const { omitted, added } = diffChangedWords(selKeys, rdgKeys);
    const changed = [...omitted, ...added];
    const contentChanged = changed.filter((w) => !funcSet.has(w));
    if (contentChanged.length === 0) {
      return withLevel(SEVERITY_BY_ID.get("particle_or_article_variation")!, changed.length <= 1 ? 1 : 2);
    }
    if (contentChanged.length === 1 && Math.abs(selKeys.length - rdgKeys.length) === 1) {
      return withLevel(SEVERITY_BY_ID.get("substantive_structural_variation")!, 3);
    }
    return withLevel(
      SEVERITY_BY_ID.get("substantive_structural_variation")!,
      contentChanged.length >= 4 ? 5 : 4,
    );
  }

  // 3. Equal lengths: check transposition (identical multiset of words)
  const sortedSel = [...selKeys].sort().join("\0");
  const sortedRdg = [...rdgKeys].sort().join("\0");
  if (sortedSel === sortedRdg) {
    return SEVERITY_BY_ID.get("grammatical_or_stylistic_nuance")!;
  }

  // 4. Equal lengths: compare differing word pairs
  const joinedSel = selKeys.join(" ");
  const joinedRdg = rdgKeys.join(" ");
  const maxLen = Math.max(joinedSel.length, joinedRdg.length);
  const sim = dice(joinedSel, joinedRdg);
  const editDist = levenshtein(joinedSel, joinedRdg);

  // Level 1: 1-character slip on a word >= 4 chars, or very high Dice similarity (>= 0.80)
  if ((maxLen >= 4 && editDist <= 1) || (maxLen >= 6 && sim >= 0.82)) {
    return SEVERITY_BY_ID.get("orthographic_or_scribal_slip")!;
  }

  // Level 2: Shared stem/prefix (morphological / inflectional / grammatical nuance)
  if (selKeys.length === 1) {
    const pref = commonPrefixLen(selKeys[0], rdgKeys[0]);
    if (pref >= 3 && pref / maxLen >= 0.52) {
      return SEVERITY_BY_ID.get("grammatical_or_stylistic_nuance")!;
    }
  } else {
    // Multi-word equal length where only one word differs and shares stem or is a function word
    let diffCount = 0;
    let minorDiff = true;
    const funcSet = isHebrew ? HEBREW_FUNC : GREEK_FUNC;
    for (let i = 0; i < selKeys.length; i++) {
      if (selKeys[i] !== rdgKeys[i]) {
        diffCount++;
        const p = commonPrefixLen(selKeys[i], rdgKeys[i]);
        const mL = Math.max(selKeys[i].length, rdgKeys[i].length);
        if (!(p >= 3 && p / mL >= 0.52) && !(funcSet.has(selKeys[i]) && funcSet.has(rdgKeys[i]))) {
          minorDiff = false;
        }
      }
    }
    if (diffCount === 1 && minorDiff) {
      return SEVERITY_BY_ID.get("grammatical_or_stylistic_nuance")!;
    }
  }

  // Level 3: Sound-alike / phonetically or visually confusable form
  const phSel = selKeys.map((w) => phoneticFold(w, isHebrew)).join(" ");
  const phRdg = rdgKeys.map((w) => phoneticFold(w, isHebrew)).join(" ");
  const phSim = dice(phSel, phRdg);
  if (phSel === phRdg || phSim >= 0.68 || sim >= 0.52) {
    return SEVERITY_BY_ID.get("phonetic_or_confusable_form")!;
  }

  // Level 2 fallback: swapping two common function words (e.g. δε <-> και, εις <-> εν)
  if (selKeys.length === 1 && funcSet.has(selKeys[0]) && funcSet.has(rdgKeys[0])) {
    return withLevel(SEVERITY_BY_ID.get("particle_or_article_variation")!, 2);
  }

  // Level 5: Entirely different lexical item with no obvious orthographic, grammatical, or phonetic bridge
  return SEVERITY_BY_ID.get("unexplained_lexical_divergence")!;
}

export function formatSeverityNote(sev: SeverityDef): string {
  return `${sev.shortLabel} — ${sev.label}: ${sev.confidenceEffect}`;
}
