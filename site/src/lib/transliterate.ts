/**
 * Presentation-layer script lexicon for the Astro site ONLY.
 * Converts ancient original-language scripts (Koine Greek, Biblical Hebrew, Biblical Aramaic)
 * into approximate readable forms in the viewer's chosen character set.
 *
 * This module is strictly for display in the web reader and is never available to
 * compilation models or referenced by any specification.
 */

export type DisplayScript = "original" | "romanized" | "gloss" | "interlinear";

export interface ScriptOption {
  id: DisplayScript;
  label: string;
  description: string;
}

/** Extensible registry of display modes (add future target scripts here, e.g. Cyrillic, Hangul, Devanagari). */
export const DISPLAY_SCRIPTS: ScriptOption[] = [
  {
    id: "original",
    label: "Original Script",
    description: "Ancient characters as attested in the manuscripts",
  },
  {
    id: "romanized",
    label: "Romanized (Latin)",
    description: "Approximate phonetic reading in Latin characters",
  },
  {
    id: "interlinear",
    label: "Original + Romanized",
    description: "Original ancient script with romanized reading underneath",
  },
];

const GREEK_SINGLE: Record<string, string> = {
  α: "a",
  β: "b",
  γ: "g",
  δ: "d",
  ε: "e",
  ζ: "z",
  η: "ē",
  θ: "th",
  ι: "i",
  κ: "k",
  λ: "l",
  μ: "m",
  ν: "n",
  ξ: "x",
  ο: "o",
  π: "p",
  ρ: "r",
  σ: "s",
  ς: "s",
  ϲ: "s",
  τ: "t",
  υ: "y",
  φ: "ph",
  χ: "ch",
  ψ: "ps",
  ω: "ō",
};

const GREEK_VELARS = new Set(["γ", "κ", "ξ", "χ"]);
const GREEK_DIPHTHONG_PREFIX = new Set(["α", "ε", "η", "ο"]);

/** Approximate SBL-style romanization of Koine Greek. */
export function romanizeGreek(input: string): string {
  // Preserve rough breathing (U+0314) before stripping other combining diacritics
  const words = input.split(/(\s+)/);
  return words
    .map((part) => {
      if (!part || /^\s+$/.test(part)) return part;
      const nfd = part.normalize("NFD");
      const hasRough = nfd.includes("\u0314");
      const clean = nfd.replace(/\p{M}/gu, "").toLowerCase();

      let out = "";
      for (let i = 0; i < clean.length; i++) {
        const ch = clean[i];
        const next = clean[i + 1] ?? "";

        // Nasal gamma before velar (γγ -> ng, γκ -> nk, γξ -> nx, γχ -> nch)
        if (ch === "γ" && GREEK_VELARS.has(next)) {
          out += "n";
          continue;
        }
        // Diphthongs with upsilon: αυ -> au, ευ -> eu, ηυ -> ēu, ου -> ou
        if (ch === "υ" && i > 0 && GREEK_DIPHTHONG_PREFIX.has(clean[i - 1])) {
          out += "u";
          continue;
        }
        out += GREEK_SINGLE[ch] ?? ch;
      }

      if (hasRough && out.length > 0) {
        if (out.startsWith("r")) out = `rh${out.slice(1)}`;
        else out = `h${out}`;
      }
      return out;
    })
    .join("");
}

// Hebrew Unicode constants
const DAGESH = "\u05BC";
const SHIN_DOT = "\u05C1";
const SIN_DOT = "\u05C2";

const HEB_VOWELS: Record<string, string> = {
  "\u05B0": "e", // sheva (filtered when silent/final)
  "\u05B1": "e", // hataf segol
  "\u05B2": "a", // hataf patach
  "\u05B3": "o", // hataf qamets
  "\u05B4": "i", // hiriq
  "\u05B5": "e", // tsere
  "\u05B6": "e", // segol
  "\u05B7": "a", // patach
  "\u05B8": "a", // qamets
  "\u05B9": "o", // holam
  "\u05BA": "o", // holam haser
  "\u05BB": "u", // qubuts
};

const HEB_CONSONANTS: Record<string, string> = {
  א: "",
  ב: "v",
  ג: "g",
  ד: "d",
  ה: "h",
  ו: "w",
  ז: "z",
  ח: "ḥ",
  ט: "t",
  י: "y",
  כ: "kh",
  ך: "kh",
  ל: "l",
  מ: "m",
  ם: "m",
  נ: "n",
  ן: "n",
  ס: "s",
  ע: "ʿ",
  פ: "f",
  ף: "f",
  צ: "ts",
  ץ: "ts",
  ק: "q",
  ר: "r",
  ש: "sh",
  ת: "t",
};

const BEGADKEFAT_HARD: Record<string, string> = {
  ב: "b",
  כ: "k",
  ך: "k",
  פ: "p",
  ף: "p",
};

interface HebCluster {
  base: string;
  dagesh: boolean;
  shin: boolean;
  sin: boolean;
  vowel: string;
  vowelMark: string;
}

/** Approximate readable romanization of Biblical Hebrew & Biblical Aramaic (pointed or unpointed). */
export function romanizeHebrew(input: string): string {
  // Replace maqaf (U+05BE) with hyphen, strip cantillation marks (U+0591-U+05AF) and paseq/sof pasuq
  const normalized = input
    .replace(/\u05BE/g, "-")
    .replace(/[\u0591-\u05AF\u05BD\u05BF\u05C0\u05C3\u05C4\u05C5\u05C6\u05C7]/g, "");

  return normalized
    .split(/(\s+|-)/)
    .map((word) => {
      if (!word || /^(\s+|-)$/.test(word)) return word;

      // Group each base consonant with its following combining marks
      const clusters: HebCluster[] = [];
      for (const ch of word) {
        const code = ch.charCodeAt(0);
        if (code >= 0x05b0 && code <= 0x05c2) {
          const cur = clusters[clusters.length - 1];
          if (!cur) continue;
          if (ch === DAGESH) cur.dagesh = true;
          else if (ch === SHIN_DOT) cur.shin = true;
          else if (ch === SIN_DOT) cur.sin = true;
          else if (HEB_VOWELS[ch] !== undefined) {
            cur.vowel = HEB_VOWELS[ch];
            cur.vowelMark = ch;
          }
        } else {
          clusters.push({ base: ch, dagesh: false, shin: false, sin: false, vowel: "", vowelMark: "" });
        }
      }

      let out = "";
      for (let i = 0; i < clusters.length; i++) {
        const c = clusters[i];
        const prev = clusters[i - 1];
        const next = clusters[i + 1];
        const isLast = i === clusters.length - 1;

        // Shuruq: וּ with no other vowel after a consonant -> "u"
        if (c.base === "ו" && c.dagesh && !c.vowel && i > 0) {
          out += "u";
          continue;
        }
        // Holam male: וֹ with no other vowel -> "o"
        if (c.base === "ו" && c.vowelMark === "\u05B9" && i > 0) {
          out += "o";
          continue;
        }
        // Silent mater lectionis י after hiriq/tsere/segol (e.g. בְּרֵאשִׁית)
        if (
          c.base === "י" &&
          !c.vowel &&
          !c.dagesh &&
          prev &&
          (prev.vowelMark === "\u05B4" || prev.vowelMark === "\u05B5" || prev.vowelMark === "\u05B6")
        ) {
          continue;
        }
        // Silent final ה after a/e/o vowel (e.g. תּוֹרָה)
        if (c.base === "ה" && isLast && !c.dagesh && !c.vowel && prev?.vowel) {
          continue;
        }
        // Silent א with no vowel
        if (c.base === "א" && !c.vowel) {
          continue;
        }

        // Consonant sound
        let cons = HEB_CONSONANTS[c.base] ?? c.base;
        if (c.base === "ש") {
          cons = c.sin ? "s" : "sh";
        } else if (c.dagesh && BEGADKEFAT_HARD[c.base]) {
          cons = BEGADKEFAT_HARD[c.base];
        }

        // Furtive patach at end of word on ח/ע/ה (e.g. רוּחַ -> ruach)
        if (isLast && c.vowelMark === "\u05B7" && (c.base === "ח" || c.base === "ע" || c.base === "ה")) {
          out += `a${cons}`;
          continue;
        }

        // Vowel sound: omit final sheva and medial sheva after a short vowel when closing a syllable
        let vow = c.vowel;
        if (c.vowelMark === "\u05B0") {
          if (isLast) vow = "";
          else if (i > 0 && prev && prev.vowelMark && prev.vowelMark !== "\u05B0" && !c.dagesh && next) {
            vow = "";
          }
        }

        out += cons + vow;
      }

      return out;
    })
    .join("");
}

/** Transliterates a text string from an ancient biblical script into the chosen display script. */
export function transliterateText(text: string, isHebrew: boolean, script: DisplayScript): string {
  if (script === "original" || !text) return text;
  return isHebrew ? romanizeHebrew(text) : romanizeGreek(text);
}
