export type LangCode = "grc" | "hbo" | "arc";

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
};

/** Exact language icons shared between the homepage language breakdown and the transcription reader. */
export function languageIconSvg(code: LangCode, size = 13): string {
  if (code === "grc") {
    return `<svg class="lang-icon" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 20h16M7 16V6a5 5 0 0 1 10 0v10"/></svg>`;
  }
  if (code === "arc") {
    return `<svg class="lang-icon" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M3.6 9h16.8M3.6 15h16.8M12 3a14.5 14.5 0 0 0 0 18M12 3a14.5 14.5 0 0 0 0 18"/></svg>`;
  }
  return `<svg class="lang-icon" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 6h14M17 6v12M8 10v8"/></svg>`;
}

export function renderLanguageBadgeHtml(code: LangCode, size = 13): string {
  const m = LANGUAGE_META[code];
  return `<span class="badge ${m.badgeClass} lang-badge" title="${m.note}">${languageIconSvg(code, size)}<span>${m.label}</span></span>`;
}
