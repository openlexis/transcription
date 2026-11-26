// Short titles: every specification and every transcription (compilation) has a required short title of at most
// SHORT_TITLE_MAX characters. Links, navigation, cards, lists and page titles use it, so two items never look alike
// and no name falls back to ULID characters. A longer title may still be shown where there is room, cut off with an
// ellipsis past FULL_TITLE_MAX characters.
//
// Where the short title lives:
// - A new specification states it in its own YAML as `shortTitle`. `bun run check` fails if it is missing.
// - Specifications are frozen once published, and the ones published before this rule (LEGACY_SPEC_IDS) cannot gain
//   the field. Their short titles live in a site-side registry, site/src/data/specification-short-titles.json, keyed
//   by ULID. Only the specifications in LEGACY_SPEC_IDS may appear there, so the registry cannot replace the field for
//   new specifications.
// - A transcription states it in its manifest.json as `compilation.shortTitle`.
import { existsSync, readFileSync } from "node:fs";

export const SHORT_TITLE_MAX = 40;
export const FULL_TITLE_MAX = 80;

/** Specifications published before short titles were required. Never add to this list. */
export const LEGACY_SPEC_IDS: readonly string[] = [
  "01M88AX3YW2HWVPGHTREFJS181",
  "01M89WMZPKWMDPCWWDTAA9VN7D",
  "01M8AW2EZ2NVKBF813GZE3MN7M",
  "01M8B40TZ4W7PX1RHJWY11ZNW0",
];

export const SPEC_TITLE_REGISTRY = "site/src/data/specification-short-titles.json";

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

/** The registry of short titles for legacy specifications, keyed by ULID. */
export function readSpecTitleRegistry(root: string): Record<string, string> {
  const p = `${root}${SPEC_TITLE_REGISTRY}`;
  if (!existsSync(p)) return {};
  const raw = JSON.parse(readFileSync(p, "utf8")) as { specifications?: Record<string, string> };
  return raw.specifications ?? {};
}

/** A specification's short title: its own `shortTitle`, or for a legacy specification, the registry entry. */
export function specShortTitle(raw: { id?: unknown; shortTitle?: unknown }, registry: Record<string, string>): string | undefined {
  if (typeof raw.shortTitle === "string" && raw.shortTitle.trim()) return raw.shortTitle.trim();
  return typeof raw.id === "string" ? registry[raw.id] : undefined;
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
  root: string,
  specs: { id: string; at: string; raw: Record<string, unknown> }[],
  comps: { at: string; shortTitle: unknown }[],
): string[] {
  const fails: string[] = [];
  let registry: Record<string, string> = {};
  try { registry = readSpecTitleRegistry(root); } catch (e) { fails.push(`${SPEC_TITLE_REGISTRY}: ${e}`); }
  const ids = new Set(specs.map((s) => s.id));
  for (const [id, t] of Object.entries(registry)) {
    if (!LEGACY_SPEC_IDS.includes(id)) fails.push(`${SPEC_TITLE_REGISTRY}: ${id} is not a specification published before short titles were required; state shortTitle in its own YAML instead`);
    if (!ids.has(id)) fails.push(`${SPEC_TITLE_REGISTRY}: ${id} is not a specification in specifications/`);
    const p = shortTitleProblem(t);
    if (p) fails.push(`${SPEC_TITLE_REGISTRY}: short title for ${id} ${p}`);
  }
  const seenSpec = new Map<string, string>();
  for (const s of specs) {
    const own = s.raw.shortTitle;
    if (own !== undefined) {
      const p = shortTitleProblem(own);
      if (p) fails.push(`${s.at}: shortTitle ${p}`);
      if (registry[s.id]) fails.push(`${SPEC_TITLE_REGISTRY}: ${s.id} states its own shortTitle, so remove it from the registry`);
    } else if (!registry[s.id]) {
      fails.push(`${s.at}: missing required field shortTitle (at most ${SHORT_TITLE_MAX} characters)`);
    }
    const t = specShortTitle(s.raw, registry);
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
