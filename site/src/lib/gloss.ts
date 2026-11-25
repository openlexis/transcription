// Build-time literal US English word-for-word gloss lookup strictly for Astro UI rendering.
// Data source: STEPBible.org / Tyndale House, Cambridge (CC BY 4.0) via site/src/data/gloss-*.json.
// Never imported or read by compilation scripts.
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const DATA_DIR = existsSync(resolve(process.cwd(), "src/data/gloss-grc.json"))
  ? resolve(process.cwd(), "src/data")
  : resolve(process.cwd(), "site/src/data");

let _grc: Record<string, string> | undefined;
let _hbo: Record<string, string> | undefined;
let _grcFold: Map<string, string> | undefined;
let _hboFold: Map<string, string> | undefined;

export function normGreekWord(raw: string): string {
  return raw
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[ςϲ]/g, "σ")
    .replace(/[^α-ω]/g, "");
}

function foldGreek(norm: string): string {
  return norm
    .replace(/αι/g, "ε")
    .replace(/οι|ει|η|υ/g, "ι")
    .replace(/ω/g, "ο")
    .replace(/(.)\1/g, "$1")
    .replace(/ν$/, "");
}

export function normHebrewWord(raw: string): string {
  return raw.replace(/[^א-ת]/g, "");
}

function foldHebrew(norm: string): string {
  return norm
    .replace(/ך/g, "כ")
    .replace(/ם/g, "מ")
    .replace(/ן/g, "נ")
    .replace(/ף/g, "פ")
    .replace(/ץ/g, "צ")
    .replace(/[וי]/g, "");
}

function loadDict(isHebrew: boolean): Record<string, string> {
  if (isHebrew) {
    if (!_hbo) {
      const p = `${DATA_DIR}/gloss-hbo.json`;
      _hbo = existsSync(p) ? JSON.parse(readFileSync(p, "utf8")) : {};
    }
    return _hbo!;
  }
  if (!_grc) {
    const p = `${DATA_DIR}/gloss-grc.json`;
    _grc = existsSync(p) ? JSON.parse(readFileSync(p, "utf8")) : {};
  }
  return _grc!;
}

function loadFoldDict(isHebrew: boolean): Map<string, string> {
  const dict = loadDict(isHebrew);
  if (isHebrew) {
    if (!_hboFold) {
      _hboFold = new Map();
      for (const [k, v] of Object.entries(dict)) {
        const f = foldHebrew(k);
        if (f && !_hboFold.has(f)) _hboFold.set(f, v);
      }
    }
    return _hboFold;
  }
  if (!_grcFold) {
    _grcFold = new Map();
    for (const [k, v] of Object.entries(dict)) {
      const f = foldGreek(k);
      if (f && !_grcFold.has(f)) _grcFold.set(f, v);
    }
  }
  return _grcFold;
}

const HEBREW_PREFIXES: [string, string][] = [
  ["וה", "and the "],
  ["וב", "and in "],
  ["ול", "and to "],
  ["וכ", "and like "],
  ["ומ", "and from "],
  ["ו", "and "],
  ["ה", "the "],
  ["ב", "in "],
  ["ל", "to "],
  ["כ", "like "],
  ["מ", "from "],
];

export function lookupWordGloss(rawWord: string, isHebrew: boolean): string {
  const dict = loadDict(isHebrew);
  if (isHebrew) {
    const k = normHebrewWord(rawWord);
    if (!k) return "";
    if (dict[k]) return dict[k];
    const fold = loadFoldDict(true);
    const fk = foldHebrew(k);
    if (fk && fold.has(fk)) return fold.get(fk)!;
    // Try stripping common Hebrew prefixes (ו, ה, ב, ל, כ, מ)
    for (const [pref, label] of HEBREW_PREFIXES) {
      if (k.startsWith(pref) && k.length - pref.length >= 2) {
        const rest = k.slice(pref.length);
        if (dict[rest]) return `${label}${dict[rest]}`;
        const fRest = foldHebrew(rest);
        if (fRest && fold.has(fRest)) return `${label}${fold.get(fRest)!}`;
      }
    }
    return "";
  }

  const k = normGreekWord(rawWord);
  if (!k) return "";
  if (dict[k]) return dict[k];
  // Try with/without movable nu
  if (k.endsWith("ν") && dict[k.slice(0, -1)]) return dict[k.slice(0, -1)];
  if (dict[`${k}ν`]) return dict[`${k}ν`];
  const fold = loadFoldDict(false);
  const fk = foldGreek(k);
  if (fk && fold.has(fk)) return fold.get(fk)!;
  return "";
}

/** Build a compact per-book map of raw word -> literal US English gloss for client-side display. */
export function buildBookGlossMap(words: Iterable<string>, isHebrew: boolean): Record<string, string> {
  const out: Record<string, string> = {};
  const seen = new Set<string>();
  for (const w of words) {
    const trimmed = w.trim();
    if (!trimmed || seen.has(trimmed)) continue;
    seen.add(trimmed);
    const g = lookupWordGloss(trimmed, isHebrew);
    if (g) out[trimmed] = g;
  }
  return out;
}
