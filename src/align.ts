// Lining up the manuscripts of one line (RULES.md, rule 5). Manuscripts are added one at a time, oldest first, by a global
// alignment of the manuscript's words against the columns made so far:
//   a word whose key a column already holds        +3
//   a word spelled almost like the column           +1 (letter pairs in common, Dice share at least one half)
//   a different word in the same place              -1 (both readings stand in one column)
//   a word with no column, or a column with no word  -1.2
// Ties in the trace-back go to: the diagonal, then a new column for the word, then a column with no word.
export type Col = { keys: Set<string>; rep: string; cells: Map<number, number> };
const MATCH = 3, NEAR = 1, SUB = -1, GAP = -1.2;
const pairs = (s: string) => { const p = new Map<string, number>(); for (let i = 0; i < s.length - 1; i++) { const b = s.slice(i, i + 2); p.set(b, (p.get(b) ?? 0) + 1); } return p; };
const SIM = new Map<string, number>();
export function dice(a: string, b: string): number {
  if (a === b) return 1;
  if (a.length < 2 || b.length < 2) return 0;
  const k = a < b ? `${a}|${b}` : `${b}|${a}`;
  let v = SIM.get(k);
  if (v === undefined) {
    const pa = pairs(a), pb = pairs(b); let hit = 0;
    for (const [x, n] of pa) hit += Math.min(n, pb.get(x) ?? 0);
    v = (2 * hit) / (a.length + b.length - 2);
    if (SIM.size > 1_000_000) SIM.clear();
    SIM.set(k, v);
  }
  return v;
}
export function align(seqs: string[][]): Col[] {
  let cols: Col[] = [];
  seqs.forEach((words, wi) => {
    if (!cols.length) { cols = words.map((k, i) => ({ keys: new Set([k]), rep: k, cells: new Map([[wi, i]]) })); return; }
    const n = cols.length, m = words.length, W = m + 1;
    const S = new Float64Array((n + 1) * W);
    for (let i = 1; i <= n; i++) S[i * W] = i * GAP;
    for (let j = 1; j <= m; j++) S[j] = j * GAP;
    const pair = (i: number, j: number) => { const c = cols[i], k = words[j]; return c.keys.has(k) ? MATCH : dice(c.rep, k) >= 0.5 ? NEAR : SUB; };
    for (let i = 1; i <= n; i++) for (let j = 1; j <= m; j++) {
      const d = S[(i - 1) * W + j - 1] + pair(i - 1, j - 1), u = S[(i - 1) * W + j] + GAP, l = S[i * W + j - 1] + GAP;
      S[i * W + j] = Math.max(d, u, l);
    }
    const out: Col[] = []; let i = n, j = m;
    while (i > 0 || j > 0) {
      const here = S[i * W + j];
      if (i > 0 && j > 0 && Math.abs(here - (S[(i - 1) * W + j - 1] + pair(i - 1, j - 1))) < 1e-9) {
        const c = cols[i - 1]; c.keys.add(words[j - 1]); c.cells.set(wi, j - 1); out.push(c); i--; j--;
      } else if (j > 0 && Math.abs(here - (S[i * W + j - 1] + GAP)) < 1e-9) {
        out.push({ keys: new Set([words[j - 1]]), rep: words[j - 1], cells: new Map([[wi, j - 1]]) }); j--;
      } else { out.push(cols[i - 1]); i--; }
    }
    cols = out.reverse();
  });
  return cols;
}
