// The reading page: tapping a word or a line number opens a panel right under that line (the page does not move). The panel
// shows the estimate in plain words, the readings and the manuscripts behind each, what each manuscript adds and why, and
// every manuscript's own text of the line, lined up word by word with only real differences marked.
type Rd = [string, number, number, number, number[], number[], number[]];
type Pl = { cols: [number, number]; c: number; rd: Rd[]; lost?: { p: number; lo: number; hi: number }; pl: number[] };
type Wd = [string, number, number, number, number, number, number[] | 0, number[] | 0];
type Ln = { r: string; u?: 1; m: number[]; ar?: string; w: Wd[]; ps: number[]; rows: [string, string][] };
type Ms = { s: string; lv?: string[]; n: string; k: string; e: 0 | 1; v: { name: string; url: string }[]; f: string[][];
  dt: { estimate: number | null; margin: number | null; from?: number; to?: number; method: string; source: string | null };
  r: { estimate: number; low: number; high: number; linesCompared: number; agreementShare: number | null; priorMean: number; priorStrength: number; dateRangeKnown: boolean } };
const root = document.getElementById("text") as HTMLElement;
const HEB = root.dataset.script === "hebrew", METHOD = root.dataset.method!;
let D: { lines: Ln[]; places: Record<string, Pl> } | undefined, W: { settings: { origin: number; lateAfter: number }; w: Ms[] } | undefined;
const load = async () => { if (!D) [D, W] = await Promise.all([fetch(root.dataset.src!).then((r) => r.json()), fetch(root.dataset.wit!).then((r) => r.json())]); };
const esc = (s: unknown) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);
const pct = (x: number) => (x >= 0.9995 ? "over 99.9%" : x <= 0.0005 ? "under 0.1%" : `${Math.round(x * 1000) / 10}%`);
const rng = (lo: number, hi: number) => (pct(lo) === pct(hi) ? `${pct(lo)} throughout` : `${pct(lo)} to ${pct(hi)}`);
const era = (y: number) => (y < 0 ? `${-y} BC` : `AD ${y}`);
const r2 = (x: number) => x.toFixed(2);
const T = (s: string) => `<span class="${HEB ? "hebrew" : "greek"}" dir="${HEB ? "rtl" : "ltr"}">${esc(s)}</span>`;
/** The form compared and shown in the line-up: no accents, breathings or vowel points. */
const plain = (s: string) => (HEB ? s.replace(/[\u0591-\u05BD\u05BF-\u05C7]/g, "") : s.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().replace(/σ$/, "ς"));
const same = (a: string, b: string) => a === b || (!HEB && "σς".includes(a) && "σς".includes(b));
/** For a word spelled differently: marks the letters of a that the printed word b does not have, and shows struck through
 * the letters of b that a does not have (by a longest common run of letters). */
function charDiff(a: string, b: string) {
  const A = [...a], B = [...b], n = A.length, m = B.length, L = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i--) for (let j = m - 1; j >= 0; j--) L[i][j] = same(A[i], B[j]) ? L[i + 1][j + 1] + 1 : Math.max(L[i + 1][j], L[i][j + 1]);
  let i = 0, j = 0, out = "";
  while (i < n || j < m) {
    if (i < n && j < m && same(A[i], B[j])) { out += esc(A[i]); i++; j++; }
    else if (j < m && (i >= n || L[i][j + 1] >= L[i + 1][j])) { out += `<mark class="dsm" title="the printed word has ${esc(B[j])} here">${esc(B[j])}</mark>`; j++; }
    else { out += `<mark class="ds">${esc(A[i])}</mark>`; i++; }
  }
  return out;
}
const sig = (m: number) => W!.w[m].s;
const chips = (ms: number[], max = 12) => `<div class="chips">${ms.slice(0, max).map((m) => `<button class="chip" data-ms="${m}">${esc(sig(m))}</button>`).join("")}${ms.length > max ? `<button class="chip more" data-all="${ms.join(",")}">all ${ms.length}</button>` : ""}</div>`;

/** Weights, as in the method: copies within lateAfter years count fully; late copies sharing a reading count 1, 1/2, 1/4 ... */
function weights(voters: [number, number][]) {
  const w = voters.map(() => 1), by = new Map<number, number[]>();
  voters.forEach(([m, o], i) => { if (!W!.w[m].e) (by.get(o) ?? by.set(o, []).get(o)!).push(i); });
  for (const idx of by.values()) { idx.sort((x, y) => W!.w[voters[y][0]].r.estimate - W!.w[voters[x][0]].r.estimate || voters[x][0] - voters[y][0]); idx.forEach((i, k) => (w[i] = 0.5 ** k)); }
  return w;
}
/** What each manuscript adds: how many times more likely its reading becomes, against any single other possibility. */
function adds(voters: [number, number][], K: number, labels: string[]) {
  const w = weights(voters);
  const rows = voters.map(([m, o], i) => { const q = Math.min(0.999999, Math.max(1e-6, W!.w[m].r.estimate)); return { m, o, w: w[i], f: Math.pow((q * K) / (1 - q), w[i]) }; }).sort((a, b) => b.f - a.f || a.m - b.m);
  const share = (x: number) => (x === 1 ? "full" : x >= 0.01 ? `1/${Math.round(1 / x)}` : "under 1/100");
  const fx = (f: number) => (f >= 1000 ? `×${Math.round(f).toLocaleString("en-US")}` : `×${f < 10 ? f.toFixed(1) : Math.round(f)}`);
  const body = (rs: typeof rows) => rs.map((r) => { const M = W!.w[r.m]; return `<tr><td><button class="chip" data-ms="${r.m}">${esc(M.s)}</button></td><td>${M.dt.estimate !== null ? `${esc(era(M.dt.estimate))} ± ${M.dt.margin}` : "unknown"}</td><td>${labels[r.o]}</td><td>${r2(M.r.estimate)}</td><td>${share(r.w)}${M.e ? "" : " (late)"}</td><td class="num">${fx(r.f)}</td></tr>`; }).join("");
  return `<details class="adds"><summary>What each manuscript adds (${voters.length})</summary><p class="meta">Each manuscript makes its own reading more likely by the factor shown, against any one other possibility. The factor grows with its reliability; a late copy that shares its reading with other late copies counts only in part. Multiplying these factors for every reading, and comparing, gives the chances above.</p><div class="scroll"><table class="mini"><thead><tr><th>Manuscript</th><th>Date</th><th>Reads</th><th>Reliability</th><th>Counts</th><th class="num">Adds</th></tr></thead><tbody>${body(rows)}</tbody></table></div></details>`;
}
function msCard(m: number) {
  const M = W!.w[m], d = M.dt, r = M.r, S = W!.settings;
  const date = d.estimate !== null
    ? `${esc(era(d.estimate))} ± ${d.margin} years (${esc(era(d.from!))} to ${esc(era(d.to!))}). How it was dated: ${esc(d.method)}.`
    : `Unknown: ${esc(d.method)}. Without a date, the compiler starts from a weak expectation, so the estimate rests on agreement and its range is wider.`;
  return `<div class="mscard"><div class="h"><b>${esc(M.s)}</b>${M.lv ? ` (with ${esc(M.lv.join(", "))})` : ""} <span class="meta">${esc(M.n)}${M.k !== "continuous" ? ` · ${esc(M.k)}` : ""}</span></div>
    <dl class="front"><dt>Date</dt><dd>${date}${d.source ? ` Source: ${esc(d.source)}.` : ""}</dd>
    <dt>Reliability</dt><dd>${r2(r.estimate)} (90% range ${r2(r.low)} to ${r2(r.high)}): the compiler's estimate of how often it has the original reading.</dd>
    <dt>From its date</dt><dd>${r.dateRangeKnown ? `A copy of this date was expected, before comparing, to be reliable about ${r2(r.priorMean)}, an expectation weighted like ${r.priorStrength.toFixed(1)} lines of evidence.` : `Date unknown: expected ${r2(r.priorMean)}, weighted like only ${r.priorStrength.toFixed(1)} line of evidence.`}</dd>
    <dt>From agreement</dt><dd>${r.linesCompared ? `In ${r.linesCompared.toLocaleString("en-US")} lines it shares with other manuscripts, its readings had on average a ${pct(r.agreementShare ?? 0)} chance of being original, judged from all the manuscripts together.` : "No line could be compared with another manuscript."}</dd>
    <dt>Copied</dt><dd>${M.e ? `within ${S.lateAfter} years of the original: counts in full` : `more than ${S.lateAfter} years after the original: where late copies share a reading they count together as at most about two`}</dd>
    <dt>Place of writing</dt><dd>unknown (not in the holder's record)</dd>
    <dt>Scientific dating</dt><dd>none recorded</dd>
    <dt>Condition</dt><dd>only the first hand is read; its slips lower its agreement</dd>
    <dt>Holder's file</dt><dd>${M.f.map(([h, src, fmt, mem, lic]) => `<a href="${esc(src)}" rel="noopener">${esc(h || "holder")}</a> <span class="meta">${esc(fmt)}${mem ? ` · ${esc(mem)}` : ""}${lic ? ` · ${esc(lic)}` : ""}</span>`).join("<br>")}</dd>
    <dt>Page images</dt><dd>${M.v.length ? M.v.map((v) => `<a href="${esc(v.url)}" rel="noopener">${esc(v.name)}</a>`).join(", ") : "no viewer known"}</dd></dl>
    <a href="${METHOD}#3-how-likely-each-reading-is-the-model">How reliability is worked out</a></div>`;
}
/** Every manuscript's text of the line, lined up by column; identical rows are grouped. */
function lineUp(L: Ln, focus?: [number, number]) {
  const nC = L.rows[0]?.[1].length ?? 0, printed: string[] = new Array(nC).fill("");
  for (const w of L.w) printed[w[1]] = w[0];
  const groups = new Map<string, { cells: string[]; st: string; ms: number[] }>();
  L.rows.forEach(([text, st], i) => { const key = `${text}|${st}`; const g = groups.get(key) ?? groups.set(key, { cells: text.split(" "), st, ms: [] }).get(key)!; g.ms.push(L.m[i]); });
  const gs = [...groups.values()].sort((a, b) => b.ms.length - a.ms.length || a.ms[0] - b.ms[0]);
  const fc = (c: number) => (focus && c >= focus[0] && c <= focus[1] ? " fc" : "");
  const head = `<tr class="pr"><th>Printed</th>${printed.map((t, c) => `<td class="${fc(c).trim()}">${esc(plain(t))}</td>`).join("")}</tr>`;
  const body = gs.map((g, gi) => {
    const label = g.ms.length === 1 ? esc(sig(g.ms[0])) : `${esc(sig(g.ms[0]))} +${g.ms.length - 1}`;
    const cells = g.cells.map((t, c) => {
      const s = g.st[c], P = plain(printed[c]), x = plain(t);
      const inner = s === "=" ? (x === P || [...x].every((ch, k) => same(ch, [...P][k] ?? "")) && [...x].length === [...P].length ? esc(x) : charDiff(x, P)) : s === "x" || s === "+" ? `<mark class="dx">${esc(x)}</mark>` : s === "-" ? `<mark class="dm" title="no word here">—</mark>` : s === "?" ? `<span class="lost" title="lost in this manuscript">…</span>` : "";
      return `<td class="${fc(c).trim()}">${inner}</td>`;
    }).join("");
    return `<tr><th><button class="grp" data-g="${gi}" data-ms="${g.ms.join(",")}" title="${esc(g.ms.map(sig).join(" "))}">${label}</button></th>${cells}</tr>`;
  }).join("");
  return `<div class="al-note meta">Each row is one manuscript, or several with exactly the same text (tap a row's name to list them). Marked: <mark class="dx">another word</mark> <mark class="dm">—</mark> no word where one is printed, <mark class="ds">letters</mark> or <mark class="dsm">letters</mark> spelled otherwise (added or missing), <span class="lost">…</span> lost.${HEB ? " Shown without vowel points." : " Shown without accents."}</div><div class="al-wrap"><table class="al ${HEB ? "hebrew" : "greek"}" dir="${HEB ? "rtl" : "ltr"}">${head}${body}</table></div><div class="grp-list"></div>`;
}
function placeBlock(id: number, L: Ln) {
  const p = D!.places[id]; if (!p) return "";
  const labels = p.rd.map((r) => T(r[0] === "—" ? "(no words)" : r[0]));
  const voters: [number, number][] = []; p.rd.forEach((r, ri) => { for (const m of [...r[4], ...r[5]]) voters.push([m, ri]); });
  const rds = p.rd.map((r, ri) => `<div class="rd${ri === 0 ? " win" : ""}"><div class="rh">${labels[ri]} <b>${pct(r[1])}</b> <span class="meta">90% range ${rng(r[2], r[3])} · ${r[4].length + r[5].length} manuscript${r[4].length + r[5].length === 1 ? "" : "s"}</span></div><div class="bar"><i style="width:${Math.max(0.5, r[1] * 100)}%"></i></div>${chips([...r[4], ...r[5]].sort((a, b) => a - b))}</div>`).join("");
  const others = p.rd.length - 1;
  const why = `${p.rd[0][4].length + p.rd[0][5].length} manuscripts have the printed reading${others ? ` and ${voters.length - p.rd[0][4].length - p.rd[0][5].length} have ${others === 1 ? "another" : `one of ${others} others`}` : ""}. Each counts by its reliability, which comes from its date range and from how often it agrees with the others across the book; late copies that share a reading count together as at most about two. The range shows how much the answer moves when each reliability is varied within what the evidence allows: few or late manuscripts give a wide range, many early ones a narrow range.`;
  return `<div class="est"><p><b>Most likely what the author wrote here:</b> ${labels[0]}, ${pct(p.rd[0][1])} (90% range ${rng(p.rd[0][2], p.rd[0][3])}).</p>${rds}${p.lost ? `<p class="meta">Chance that the original is in none of these manuscripts: ${pct(p.lost.p)} (90% range ${rng(p.lost.lo, p.lost.hi)}).</p>` : ""}${p.pl.length ? `<p class="meta">Lost in part here, so not counted: ${p.pl.map(sig).join(" ")}</p>` : ""}<p class="why">${why} <a href="${METHOD}#3-how-likely-each-reading-is-the-model">How this is worked out</a></p>${adds(voters, p.rd.length, labels)}</div>`;
}
function wordBlock(L: Ln, w: Wd) {
  const d = (w[6] || []) as number[], lost = (w[7] || []) as number[], out = new Set([...d, ...lost]), readers = L.m.filter((m) => !out.has(m));
  const ci = L.m.indexOf.bind(L.m);
  const theirs = d.map((m) => plain(L.rows[ci(m)][0].split(" ")[w[1]] || "—"));
  const labels = [T(w[0]), ...theirs.map((t) => T(t || "(no word)"))];
  const voters: [number, number][] = [...readers.map((m) => [m, 0] as [number, number]), ...d.map((m, j) => [m, j + 1] as [number, number])];
  return `<div class="est"><p><b>${readers.length} of ${L.m.length} manuscripts</b> have this word${d.length ? `; ${d.length} ha${d.length === 1 ? "s" : "ve"} something else, each alone` : ""}${lost.length ? `; in ${lost.length} it is lost` : ""}. Chance it is what the author wrote: <b>${pct(w[2])}</b> (90% range ${rng(w[3], w[4])}).</p>${chips(readers)}${d.length ? `<p class="meta">Something else here, each alone:</p>${d.map((m, j) => `<div class="alone">${theirs[j] ? T(theirs[j]) : "(no word)"} ${chips([m])}</div>`).join("")}` : ""}<p class="why">The more manuscripts agree, and the more reliable they are, the higher the chance; one manuscript alone against many counts for little. <a href="${METHOD}#3-how-likely-each-reading-is-the-model">How this is worked out</a></p>${adds(voters, 1 + d.length, labels)}</div>`;
}
let openKey = "";
function close() { root.querySelectorAll(".panel").forEach((x) => x.remove()); root.querySelectorAll(".sel").forEach((x) => x.classList.remove("sel")); openKey = ""; }
async function open(li: number, wi: number | null, place?: number) {
  const key = `${li}:${wi}:${place ?? ""}`;
  if (key === openKey) { close(); return; }
  close(); openKey = key;
  await load();
  const L = D!.lines[li], lnEl = root.querySelector(`.ln[data-l="${li}"]`) as HTMLElement;
  const panel = document.createElement("div"); panel.className = "panel"; panel.setAttribute("dir", "ltr"); panel.lang = "en";
  let html = `<div class="ph"><b>${esc(L.r)}</b>`;
  let focus: [number, number] | undefined;
  if (L.u) html += ` <span class="meta">No manuscript we hold has this line.</span></div>`;
  else if (wi !== null) {
    const w = L.w[wi]; (root.querySelector(`.w[data-l="${li}"][data-w="${wi}"]`) as HTMLElement)?.classList.add("sel");
    html += ` · ${T(w[0])}<button class="x" aria-label="Close">×</button></div>`;
    if (w[5] >= 0) { focus = D!.places[w[5]]?.cols; html += placeBlock(w[5], L); } else { focus = [w[1], w[1]]; html += wordBlock(L, w); }
  } else {
    lnEl.querySelector(".no")?.classList.add("sel");
    html += ` · every manuscript<button class="x" aria-label="Close">×</button></div><p>${L.m.length} manuscript${L.m.length === 1 ? "" : "s"} have this line; they differ at ${L.ps.length} place${L.ps.length === 1 ? "" : "s"}.</p>`;
    if (place !== undefined) { focus = D!.places[place]?.cols; html += placeBlock(place, L); }
    else if (L.ps.length) html += `<details class="adds"><summary>The places where they differ</summary>${L.ps.map((id) => placeBlock(id, L)).join("<hr>")}</details>`;
  }
  if (!L.u) html += `<h4>Every manuscript's text of this line</h4>${lineUp(L, focus)}`;
  html += `<div class="msbox"></div>`;
  panel.innerHTML = html;
  lnEl.after(panel);
  // bring the word's column into view inside the line-up only (the page itself does not scroll)
  const wrap = panel.querySelector(".al-wrap") as HTMLElement | null, cell = wrap?.querySelector("td.fc") as HTMLElement | null;
  if (wrap && cell) { const a = wrap.getBoundingClientRect(), b = cell.getBoundingClientRect(); wrap.scrollLeft += b.left - a.left - a.width / 2 + b.width / 2; }
}
root.addEventListener("click", (e) => {
  const el = e.target as HTMLElement;
  const w = el.closest(".w") as HTMLElement | null;
  if (w) { open(+w.dataset.l!, +w.dataset.w!); return; }
  const no = el.closest(".no") as HTMLElement | null;
  if (no) { open(+no.dataset.l!, null); return; }
  if (el.closest(".x")) { close(); return; }
  const chip = el.closest(".chip") as HTMLElement | null, panel = el.closest(".panel") as HTMLElement | null;
  if (chip?.dataset.all) { chip.parentElement!.outerHTML = chips(chip.dataset.all.split(",").map(Number), 9999); return; }
  if (chip?.dataset.ms && panel) {
    // the manuscript's card opens right under the list it was tapped in
    panel.querySelectorAll(".mscard").forEach((x) => x.remove());
    const holder = chip.closest(".chips, table, .alone") as HTMLElement;
    holder.insertAdjacentHTML("afterend", msCard(+chip.dataset.ms)); return;
  }
  const grp = el.closest(".grp") as HTMLElement | null;
  if (grp && panel) { const box = panel.querySelector(".grp-list") as HTMLElement; box.innerHTML = box.dataset.g === grp.dataset.g ? "" : `<p class="meta">This row's text is in:</p>${chips(grp.dataset.ms!.split(",").map(Number), 9999)}`; box.dataset.g = box.dataset.g === grp.dataset.g ? "" : grp.dataset.g; }
});
document.addEventListener("keydown", (e) => { if (e.key === "Escape") close(); });
const marks = document.getElementById("marks") as HTMLInputElement | null;
marks?.addEventListener("change", () => document.body.classList.toggle("marks-off", !marks.checked));
// a link to a place (?p=<id>) opens it under its line
const q = new URLSearchParams(location.search).get("p");
if (q) load().then(() => {
  const li = D!.lines.findIndex((l) => l.ps?.includes(+q)); if (li < 0) return;
  const wi = D!.lines[li].w.findIndex((w) => w[5] === +q);
  open(li, wi >= 0 ? wi : null, wi >= 0 ? undefined : +q);
  root.querySelector(`.ln[data-l="${li}"]`)?.scrollIntoView({ block: "start" });
});
// Hebrew: show the consonants only (the vowel points and marks are hidden, not removed from the data)
const points = document.getElementById("points") as HTMLInputElement | null;
points?.addEventListener("change", () => {
  for (const b of document.querySelectorAll<HTMLButtonElement>(".hebrew .w")) {
    b.dataset.full ??= b.textContent ?? "";
    b.textContent = points.checked ? b.dataset.full.replace(/[\u0591-\u05C7]/g, (ch) => (ch === "\u05BE" ? ch : "")) : b.dataset.full;
  }
});
