export type LangCode = "grc" | "hbo" | "arc" | "syc" | "lat" | "cop";

export interface LanguageMeta {
  code: LangCode;
  /** English name, used in the hover together with `native`. */
  label: string;
  /** Native name in the language's own script, shown in the hover after the English name. */
  native?: string;
  shortLabel: string;
  badgeClass: string;
  note: string;
}

export const LANGUAGE_META: Record<LangCode, LanguageMeta> = {
  grc: {
    code: "grc",
    label: "Ancient Greek",
    native: "Ἑλληνική",
    shortLabel: "Greek",
    badgeClass: "badge-sky",
    note: "Ancient Greek, including the Hellenistic and Roman Mediterranean Greek of the New Testament.",
  },
  hbo: {
    code: "hbo",
    label: "Ancient Hebrew",
    native: "עברית",
    shortLabel: "Hebrew",
    badgeClass: "badge-amber",
    note: "Ancient Hebrew, written right to left.",
  },
  arc: {
    code: "arc",
    label: "Aramaic",
    native: "ܐܪܡܝܐ",
    shortLabel: "Aramaic",
    badgeClass: "badge-violet",
    note: "Imperial Aramaic, written right to left.",
  },
  syc: {
    code: "syc",
    label: "Classical Syriac",
    shortLabel: "Syriac",
    badgeClass: "badge-rose",
    note: "Classical Syriac, written right to left.",
  },
  lat: {
    code: "lat",
    label: "Latin",
    shortLabel: "Latin",
    badgeClass: "badge-slate",
    note: "Latin.",
  },
  cop: {
    code: "cop",
    label: "Coptic",
    shortLabel: "Coptic",
    badgeClass: "badge-emerald",
    note: "Coptic.",
  },
};

const SOURCE_LANGUAGE_CODES: Record<string, LangCode> = {
  greek: "grc",
  "koine greek": "grc",
  "ancient greek": "grc",
  hebrew: "hbo",
  "biblical hebrew": "hbo",
  "ancient hebrew": "hbo",
  aramaic: "arc",
  "biblical aramaic": "arc",
  "imperial aramaic": "arc",
  syriac: "syc",
  "classical syriac": "syc",
  latin: "lat",
  coptic: "cop",
};

const COMBINED_LANGUAGE_CODES: Record<string, LangCode[]> = {
  "hebrew and aramaic": ["hbo", "arc"],
  "biblical hebrew and aramaic": ["hbo", "arc"],
  "biblical hebrew & aramaic": ["hbo", "arc"],
  "biblical hebrew and biblical aramaic": ["hbo", "arc"],
  "biblical hebrew & biblical aramaic": ["hbo", "arc"],
  "ancient hebrew and aramaic": ["hbo", "arc"],
  "ancient hebrew and ancient aramaic": ["hbo", "arc"],
};

/** Map a source or display language name, or a language code, to a compact language code. */
export function languageCodeFor(language: string): LangCode | undefined {
  const raw = language.trim();
  if (raw in LANGUAGE_META) return raw as LangCode;
  const combined = COMBINED_LANGUAGE_CODES[raw.toLowerCase()];
  if (combined?.length) return combined[0];
  return SOURCE_LANGUAGE_CODES[raw.toLowerCase()];
}

/** Every ISO 639-3 code that applies, including both Hebrew and Aramaic when the source is mixed. */
export function languageCodesFor(language: string): LangCode[] {
  const raw = language.trim();
  if (raw in LANGUAGE_META) return [raw as LangCode];
  const combined = COMBINED_LANGUAGE_CODES[raw.toLowerCase()];
  if (combined) return combined;
  const one = SOURCE_LANGUAGE_CODES[raw.toLowerCase()];
  return one ? [one] : [];
}

function escAttr(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
}

/** English name plus native name, for the hover and accessible label: "Ancient Greek (Ἑλληνική)". */
export function languageHoverLabel(code: LangCode): string {
  const m = LANGUAGE_META[code];
  return m.native ? `${m.label} (${m.native})` : m.label;
}

/** The site's shared language/translate icon, matching Icon.astro at the pill's default size. */
const LANGUAGE_ICON_SVG =
  '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m5 8 6 6"></path><path d="m4 14 6-6 2-3"></path><path d="M2 5h12"></path><path d="M7 2h1"></path><path d="m22 22-5-10-5 10"></path><path d="M14 18h6"></path></svg>';

/** One language as the shared pill: the language icon plus the ISO 639-3 code, with English and native names in the hover. */
export function languageCodeTagHtml(code: LangCode): string {
  const hover = escAttr(languageHoverLabel(code));
  return `<span class="pill" title="${hover}" aria-label="${hover}">${LANGUAGE_ICON_SVG}${escAttr(code)}</span>`;
}

/** Language pills for a language name or code. */
export function languageCodeBadgeHtml(language: string): string {
  const tags = languageCodesFor(language).map(languageCodeTagHtml);
  if (tags.length <= 1) return tags[0] ?? "";
  return `<span class="pill-row">${tags.join("")}</span>`;
}

/** Language as the shared pill, used in the word popup. */
export function renderLanguageBylineHtml(code: LangCode, _size = 14): string {
  return languageCodeTagHtml(code);
}

/** Language as the shared pill. */
export function renderLanguageBadgeHtml(code: LangCode, _size = 13): string {
  return languageCodeTagHtml(code);
}
