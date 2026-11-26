export type LangCode = "grc" | "hbo" | "arc" | "syc" | "lat" | "cop";

export interface LanguageMeta {
  code: LangCode;
  label: string;
  shortLabel: string;
  badgeClass: string;
  note: string;
}

export const LANGUAGE_META: Record<LangCode, LanguageMeta> = {
  grc: {
    code: "grc",
    label: "Koine Greek",
    shortLabel: "Greek",
    badgeClass: "badge-sky",
    note: "Hellenistic and Roman Mediterranean Greek of the New Testament.",
  },
  hbo: {
    code: "hbo",
    label: "Biblical Hebrew",
    shortLabel: "Hebrew",
    badgeClass: "badge-amber",
    note: "Ancient Classical Hebrew written right to left.",
  },
  arc: {
    code: "arc",
    label: "Biblical Aramaic",
    shortLabel: "Aramaic",
    badgeClass: "badge-violet",
    note: "Imperial Aramaic, written right to left in the same square script as Hebrew.",
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
  hebrew: "hbo",
  "biblical hebrew": "hbo",
  "hebrew and aramaic": "hbo",
  "biblical hebrew and aramaic": "hbo",
  "biblical hebrew & aramaic": "hbo",
  aramaic: "arc",
  "biblical aramaic": "arc",
  syriac: "syc",
  "classical syriac": "syc",
  latin: "lat",
  coptic: "cop",
};

/** Map a source or display language name, or a language code, to a compact language code. */
export function languageCodeFor(language: string): LangCode | undefined {
  const raw = language.trim();
  if (raw in LANGUAGE_META) return raw as LangCode;
  return SOURCE_LANGUAGE_CODES[raw.toLowerCase()];
}

function escAttr(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
}

/** One letter from the language's own script. ISO 639-3 codes are keys only, never shown. */
const LANGUAGE_MARK: Record<LangCode, string> = {
  grc: "Α",
  hbo: "א",
  arc: "א",
  syc: "ܐ",
  lat: "A",
  cop: "Ⲁ",
};

/** Compact language icon: a script letter in a neutral mark, with the full name as the accessible label. */
export function languageCodeBadgeHtml(language: string): string {
  const code = languageCodeFor(language);
  const label = code ? LANGUAGE_META[code].label : language.trim();
  const mark = (code && LANGUAGE_MARK[code]) || "";
  if (!label || !mark) return "";
  const attr = escAttr(label);
  return `<span class="lang-code-badge" title="${attr}" aria-label="${attr}"><span aria-hidden="true">${escAttr(mark)}</span></span>`;
}

/** Exact language icons shared between the homepage language breakdown and the transcription reader. */
export function languageIconSvg(code: LangCode, size = 13): string {
  if (code === "grc") {
    return `<svg class="lang-icon" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 20h16M7 16V6a5 5 0 0 1 10 0v10"/></svg>`;
  }
  if (code === "arc") {
    return `<svg class="lang-icon" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m5 8 6 6"/><path d="m4 14 6-6 2-3"/><path d="M2 5h12"/><path d="M7 2h1"/><path d="m22 22-5-10-5 10"/><path d="M14 18h6"/></svg>`;
  }
  return `<svg class="lang-icon" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 6h14M17 6v12M8 10v8"/></svg>`;
}

export function renderLanguageBadgeHtml(code: LangCode, size = 13): string {
  const m = LANGUAGE_META[code];
  return `<span class="badge ${m.badgeClass} lang-badge" title="${m.note}">${languageIconSvg(code, size)}<span>${m.label}</span></span>`;
}

/** Language as plain icon-plus-value text, matching the site byline, with no colored pill. */
export function renderLanguageBylineHtml(code: LangCode, size = 14): string {
  const m = LANGUAGE_META[code];
  return `<span class="byline-item" title="${escAttr(m.note)}">${languageIconSvg(code, size)}<span>${escAttr(m.label)}</span></span>`;
}
