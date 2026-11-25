// The statistical model this compiler chose (scripts/METHOD.md, "How likely each reading is"). Every step here is
// described there in plain words; the names below follow that description.
//
// Each manuscript m has a reliability q_m: the chance that, at a given point, it carries the original reading. The original
// is one of the readings seen there or one of UNSEEN readings that no manuscript kept, each equally likely before looking.
// A manuscript that does not carry the original carries any one of the other candidates, equally likely. Bayes' rule then
// gives each reading's probability.

/** A small random number generator with a fixed seed, so every run draws the same numbers (mulberry32). */
export function rng(seed: number) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const normal = (u: () => number) => { let x = 0; while (x === 0) x = u(); return Math.sqrt(-2 * Math.log(x)) * Math.cos(2 * Math.PI * u()); };
/** A gamma draw (Marsaglia and Tsang, 2000). */
function gamma(k: number, u: () => number): number {
  if (k < 1) return gamma(k + 1, u) * Math.pow(u() || 1e-12, 1 / k);
  const d = k - 1 / 3, c = 1 / Math.sqrt(9 * d);
  for (;;) { let x, v; do { x = normal(u); v = 1 + c * x; } while (v <= 0); v = v * v * v; const w = u(); if (w < 1 - 0.0331 * x ** 4 || Math.log(w) < 0.5 * x * x + d * (1 - v + Math.log(v))) return d * v; }
}
export const betaDraw = (a: number, b: number, u: () => number) => { const x = gamma(a, u), y = gamma(b, u); return x / (x + y); };

/** The prior for a manuscript's reliability from its date (scripts/METHOD.md, "Dates and the prior"). */
export function prior(o: { from?: number; to?: number; origin: number; halfLife: number; undated: number }) {
  const mu = (year: number) => 0.5 + 0.45 * Math.pow(2, -Math.max(0, year - o.origin) / o.halfLife);
  if (o.from === undefined || o.to === undefined) return { mean: mu(o.undated), strength: 1, rangeKnown: false };
  const n = 21; let s = 0; for (let i = 0; i < n; i++) s += mu(o.from + ((o.to - o.from) * i) / (n - 1));
  const width = Math.max(1, o.to - o.from);
  return { mean: s / n, strength: (4 * 100) / Math.max(100, width), rangeKnown: true };
}

/** One unit of evidence: the readings seen at a place (options) and who reads which (voters: [witness, option]). */
export type Unit = { options: number; voters: [number, number][] };

/** Weights (scripts/METHOD.md, "Copies that depend on each other"): early copies 1 each; late copies that share a reading 1, 1/2, 1/4, ... by reliability. */
export function weights(u: Unit, late: boolean[], q: Float64Array) {
  const w = new Float64Array(u.voters.length);
  const byOpt = new Map<number, number[]>();
  u.voters.forEach(([m, o], i) => { if (!late[m]) w[i] = 1; else (byOpt.get(o) ?? byOpt.set(o, []).get(o)!).push(i); });
  for (const idx of byOpt.values()) { idx.sort((x, y) => q[u.voters[y][0]] - q[u.voters[x][0]] || u.voters[x][0] - u.voters[y][0]); idx.forEach((i, r) => (w[i] = Math.pow(0.5, r))); }
  return w;
}

/** How many readings, besides those the manuscripts show, a copyist who erred could have written at one point (method,
 * section 3). The original is one of the readings seen or one of these; before looking, every one is equally likely. */
export const UNSEEN = 10;
/** Log-likelihood of each possible original (the options, then the unseen readings taken together, which also carry their
 * larger share of the prior) under reliabilities q. A manuscript that errs writes any one of the other candidates, equally
 * likely: (1 - q) / (candidates - 1). */
export function loglik(u: Unit, w: Float64Array, q: (m: number) => number, skip = -1) {
  const K = u.options, alt = K + UNSEEN - 1;
  const L = new Float64Array(K + 1);
  u.voters.forEach(([m, o], i) => {
    if (i === skip) return;
    const qm = Math.min(0.999999, Math.max(1e-6, q(m))), hit = Math.log(qm) * w[i], miss = Math.log((1 - qm) / alt) * w[i];
    for (let r = 0; r <= K; r++) L[r] += r === o ? hit : miss;
  });
  L[K] += Math.log(UNSEEN);
  return L;
}
/** Bayes' rule: turn log-likelihoods (with the prior already added) into probabilities. */
export function posterior(L: Float64Array) {
  const mx = Math.max(...L); let s = 0; const p = new Float64Array(L.length);
  for (let i = 0; i < L.length; i++) { p[i] = Math.exp(L[i] - mx); s += p[i]; }
  for (let i = 0; i < L.length; i++) p[i] /= s;
  return p;
}
export const quantile = (xs: number[], f: number) => { const s = [...xs].sort((a, b) => a - b); const i = (s.length - 1) * f, lo = Math.floor(i), hi = Math.ceil(i); return s[lo] + (s[hi] - s[lo]) * (i - lo); };
