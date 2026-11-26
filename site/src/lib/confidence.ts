export type ConfidenceMetricKind =
  | "reading"
  | "book-mean"
  | "reliability"
  | "unseen";

export interface ConfidenceBadgeOptions {
  /** Probability in [0, 1] (or numeric string like "0.543"). */
  value: number | string;
  /** What this percentage measures. Defaults to "reading". */
  kind?: ConfidenceMetricKind;
  /** Optional raw interval string, e.g. "90% interval: [0.455, 0.617]". */
  interval?: string;
  /** Subject/context: e.g. book name ("Genesis"), witness siglum ("P66"), or witness note. */
  context?: string;
  /** Show a concise inline label beside the percentage (e.g. "likely original"). */
  showLabel?: boolean;
  /** In the word-click popup, show the uncertainty band name beside the percentage. */
  showBandLabel?: boolean;
  /** True when every surviving manuscript agrees on this wording. */
  unanimous?: boolean;
  /** Compact variant for dense UI like witness chips. */
  compact?: boolean;
  /** Render integer percent (e.g. "54%") instead of 1 decimal place. */
  integer?: boolean;
  /** Set false when placed inside an <a> or <button> to avoid nested focusables. */
  focusable?: boolean;
  /** Extra CSS classes on the outer wrapper. */
  className?: string;
}

export interface ConfidenceModel {
  prob: number;
  fillPct: number;
  displayPct: string;
  tier: "high" | "mid" | "low";
  kind: ConfidenceMetricKind;
  title: string;
  shortLabel: string;
  description: string;
  intervalText: string;
  contextNote: string;
  ariaLabel: string;
  iconSvg: string;
  /** Set when showBandLabel is on: "Unanimous reading", "Little uncertainty", "Moderate uncertainty", or "High uncertainty". */
  bandLabel: string;
}

const escHtml = (s: unknown): string =>
  String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

export function parseProbability(value: number | string): number {
  const n = typeof value === "number" ? value : Number(value);
  if (Number.isNaN(n)) return 0;
  return Math.max(0, Math.min(1, n));
}

export function formatProbabilityPct(value: number | string, integer = false): string {
  const n = typeof value === "number" ? value : Number(value);
  if (Number.isNaN(n)) return String(value);
  if (n >= 0.9995) return ">99.9%";
  if (n <= 0.0005) return "<0.1%";
  if (integer) return `${Math.round(n * 100)}%`;
  return `${(n * 100).toFixed(1)}%`;
}

export function formatCredibleInterval(raw?: string): string {
  if (!raw) return "";
  const m = raw.match(/\[([0-9.]+),\s*([0-9.]+)\]/);
  if (!m) return raw;
  return `90% credible range: ${formatProbabilityPct(m[1])} – ${formatProbabilityPct(m[2])}`;
}

/**
 * Uncertainty band name used beside the likelihood pill in the word-click popup.
 * Thresholds and wording match the homepage walkthrough: at least 99% is little
 * uncertainty (or "Unanimous reading" when every surviving manuscript agrees),
 * at least 85% is moderate uncertainty, and below that is high uncertainty.
 */
export function uncertaintyBandLabel(prob: number, unanimous = false): string {
  const pct = prob * 100;
  if (unanimous && pct >= 99) return "Unanimous reading";
  if (pct >= 99) return "Little uncertainty";
  if (pct >= 85) return "Moderate uncertainty";
  return "High uncertainty";
}

export function confidenceIconSvg(kind: ConfidenceMetricKind, size = 13): string {
  if (kind === "unseen") {
    return `<svg class="ol-conf-icon" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.15" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9" stroke-dasharray="3.2 2.6"/><path d="M9.5 9.5a2.5 2.5 0 0 1 4.6 1.3c0 1.6-2.1 2-2.1 3.2"/><circle cx="12" cy="17.2" r="0.7" fill="currentColor" stroke="none"/></svg>`;
  }
  if (kind === "reliability") {
    return `<svg class="ol-conf-icon" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.15" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>`;
  }
  return `<svg class="ol-conf-icon" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.15" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="m9 12 2 2 4-4"/></svg>`;
}

export function buildConfidenceModel(opts: ConfidenceBadgeOptions): ConfidenceModel {
  const kind: ConfidenceMetricKind = opts.kind ?? "reading";
  const prob = parseProbability(opts.value);
  const fillPct = Math.round(prob * 1000) / 10;
  const displayPct = formatProbabilityPct(
    opts.value,
    opts.integer ?? (opts.compact && kind === "reliability"),
  );
  const intervalText = formatCredibleInterval(opts.interval);

  let tier: "high" | "mid" | "low";
  if (kind === "unseen") {
    tier = prob >= 0.15 ? "mid" : "low";
  } else {
    tier = prob >= 0.9 ? "high" : prob >= 0.5 ? "mid" : "low";
  }

  let title: string;
  let shortLabel: string;
  let description: string;
  let contextNote = "";

  if (kind === "book-mean") {
    title = "Average Word Likelihood";
    shortLabel = "avg. likely original";
    description = opts.context
      ? `Average model likelihood across all reconstructed words in ${opts.context} that the text matches the original author (not raw manuscript agreement).`
      : "Average model likelihood across all reconstructed words that the text matches the original author.";
  } else if (kind === "reliability") {
    title = "Manuscript Reliability";
    shortLabel = "reliability";
    description = opts.context
      ? `Estimated probability that manuscript ${opts.context} preserves the original reading at a compared verse, learned from dating and agreement.`
      : "Estimated probability that this manuscript preserves the original reading at a compared verse.";
  } else if (kind === "unseen") {
    title = "Unattested-Original Chance";
    shortLabel = "unattested";
    description =
      "Estimated probability that the original author's wording was not preserved in any surviving manuscript here.";
    contextNote = opts.context ?? "";
  } else {
    title = "Original-Text Likelihood";
    shortLabel = "likely original";
    description =
      "Model probability that the original author wrote this wording (not the percentage of surviving manuscripts).";
    contextNote = opts.context ?? "";
  }

  const bandLabel = opts.showBandLabel ? uncertaintyBandLabel(prob, opts.unanimous === true) : "";
  const ariaParts = [`${displayPct} ${bandLabel || title.toLowerCase()}`, description, intervalText, contextNote].filter(Boolean);

  return {
    prob,
    fillPct,
    displayPct,
    tier,
    kind,
    title,
    shortLabel,
    description,
    intervalText,
    contextNote,
    ariaLabel: ariaParts.join(". "),
    iconSvg: confidenceIconSvg(kind, opts.compact ? 11 : 13),
    bandLabel,
  };
}

/** Render the canonical ConfidenceBadge (icon + indicator + hover card) as HTML for client-side scripts. */
export function renderConfidenceBadgeHtml(opts: ConfidenceBadgeOptions): string {
  const m = buildConfidenceModel(opts);
  const focusable = opts.focusable !== false;
  const wrapClasses = [
    "ol-conf-wrap",
    opts.compact ? "ol-conf-compact" : "",
    opts.className ?? "",
  ]
    .filter(Boolean)
    .join(" ");
  const fillWidth = Math.max(m.fillPct, m.prob > 0 ? 4 : 0).toFixed(1);
  const metaHtml =
    m.intervalText || m.contextNote
      ? `<span class="ol-conf-card-meta">${m.contextNote ? `<span>${escHtml(m.contextNote)}</span>` : ""}${m.intervalText ? `<span>${escHtml(m.intervalText)}</span>` : ""}</span>`
      : "";

  const meterHtml = opts.compact
    ? `<span class="ol-conf-dot" aria-hidden="true"></span>`
    : `<span class="ol-conf-meter" aria-hidden="true"><span class="ol-conf-meter-fill" style="width:${fillWidth}%"></span></span>`;

  const labelText = opts.showBandLabel ? m.bandLabel : opts.showLabel ? m.shortLabel : "";
  const inlineLabel = labelText
    ? `<span class="ol-conf-inline-label">${escHtml(labelText)}</span>`
    : "";

  return `<span class="${escHtml(wrapClasses)}"${focusable ? ' tabindex="0"' : ""} aria-label="${escHtml(m.ariaLabel)}"><span class="ol-conf-pill ol-conf-${m.tier}">${m.iconSvg}${meterHtml}<span class="ol-conf-val">${escHtml(m.displayPct)}</span>${inlineLabel}</span><span class="ol-conf-card" role="tooltip"><span class="ol-conf-card-head"><span class="ol-conf-card-title">${confidenceIconSvg(m.kind, 13)}<span>${escHtml(m.title)}</span></span><span class="ol-conf-card-pct ol-conf-text-${m.tier}">${escHtml(m.displayPct)}</span></span><span class="ol-conf-card-track" aria-hidden="true"><span class="ol-conf-card-fill ol-conf-fill-${m.tier}" style="width:${Math.max(m.fillPct, 2).toFixed(1)}%"></span></span><span class="ol-conf-card-desc">${escHtml(m.description)}</span>${metaHtml}</span></span>`;
}
