// Short titles: every specification and every transcription (compilation) has a required short title of at most
// SHORT_TITLE_MAX characters, stated in the specification YAML as `shortTitle` and in a transcription's
// manifest.json as `compilation.shortTitle`. `bun run check` fails if it is missing. Links, navigation, cards,
// lists and page titles use it, so two items never look alike and no name falls back to ULID characters. A longer
// title may still be shown where there is room, cut off with an ellipsis past FULL_TITLE_MAX characters.
export const SHORT_TITLE_MAX = 40;
export const FULL_TITLE_MAX = 80;

/** Returns a problem with a short title, or null when it is valid. */
export function shortTitleProblem(v: unknown): string | null {
  if (typeof v !== "string" || !v.trim()) return "is required";
  if (v !== v.trim()) return "has leading or trailing spaces";
  if ([...v].length > SHORT_TITLE_MAX) return `is ${[...v].length} characters, over the ${SHORT_TITLE_MAX}-character limit`;
  if (v.includes("\u2014")) return "contains an em dash";
  if (/[\u2026]|\.\.\.$/.test(v)) return "must not end in an ellipsis";
  if (/^[0-9A-HJKMNP-TV-Z]{6,26}$/.test(v)) return "looks like ULID characters, not a title";
  return null;
}

/** A specification's short title from its own `shortTitle` field. */
export function specShortTitle(raw: { shortTitle?: unknown }): string | undefined {
  return typeof raw.shortTitle === "string" && raw.shortTitle.trim() ? raw.shortTitle.trim() : undefined;
}

/** Cuts a longer title off with an ellipsis at a word boundary, past `max` characters. */
export function clampTitle(text: string, max = FULL_TITLE_MAX): string {
  const chars = [...text];
  if (chars.length <= max) return text;
  const cut = chars.slice(0, max - 1).join("");
  const sp = cut.lastIndexOf(" ");
  return `${(sp > max * 0.6 ? cut.slice(0, sp) : cut).replace(/[\s,;:·&-]+$/, "")}\u2026`;
}

/** Problems with every short title, for `bun run check`. */
export function checkShortTitles(
  specs: { id: string; at: string; raw: Record<string, unknown> }[],
  comps: { at: string; shortTitle: unknown }[],
): string[] {
  const fails: string[] = [];
  const seenSpec = new Map<string, string>();
  for (const s of specs) {
    const p = shortTitleProblem(s.raw.shortTitle);
    if (p) fails.push(`${s.at}: shortTitle ${p}`);
    const t = specShortTitle(s.raw);
    if (t) {
      const k = t.toLowerCase();
      if (seenSpec.has(k)) fails.push(`${s.at}: short title "${t}" is the same as ${seenSpec.get(k)}'s; short titles must tell specifications apart`);
      else seenSpec.set(k, s.id);
    }
  }
  const seenComp = new Map<string, string>();
  for (const c of comps) {
    const p = shortTitleProblem(c.shortTitle);
    if (p) { fails.push(`${c.at}/manifest.json: compilation.shortTitle ${p}`); continue; }
    const k = String(c.shortTitle).toLowerCase();
    if (seenComp.has(k)) fails.push(`${c.at}/manifest.json: short title "${c.shortTitle}" is the same as ${seenComp.get(k)}'s`);
    else seenComp.set(k, c.at);
  }
  return fails;
}
