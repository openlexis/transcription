// The word panel of the reading view: who reads the word, where the manuscripts disagree, and links to each source.
type Ms = [string, string, string, number, number, number, number, { name: string; url: string }[], [string, string, string, string][]];
type Rd = { x: string; s: number; w: number[]; p?: number[]; v: number; f?: string[] };
type Pl = { c: number; w: number; t: string; s: string; l?: number[]; r: Rd[] };
type Data = { id: string; lang?: string; lines: { r: string; u: number; m: number[]; s?: string[]; w: [string, number, number, number[] | 0, number[] | 0, string][] }[]; places: Record<string, Pl> };
const D: Data = JSON.parse(document.getElementById("data")!.textContent!);
const REPO = "https://github.com/openlexis/transcription/blob/main/";
let MS: Ms[] | null = null;
const getMs = async () => (MS ??= await (await fetch(`/data/${D.id}/witnesses.json`)).json());
const sheet = document.getElementById("sheet")!, body = document.getElementById("sheet-body")!;
const esc = (s: unknown) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);
const pct = (x: number) => `${Math.round(x * 1000) / 10}%`;
const WHY: Record<string, string> = { singular: "one manuscript alone: no vote", "eye-skip": "a copying slip (eye-skip): no vote" };

function chips(ids: number[], li: number, cap = 24) {
  const ms = MS!, sorted = [...ids].sort((a, b) => ms[a][3] - ms[b][3] || (ms[a][0] < ms[b][0] ? -1 : 1));
  const shown = sorted.slice(0, cap);
  return `<div class="chips">${shown.map((i) => `<button class="chip${ms[i][5] ? " early" : ""}" data-ms="${i}" data-li="${li}" title="${esc(ms[i][1])} ${esc(ms[i][2])}">${esc(ms[i][0])}</button>`).join("")}${sorted.length > cap ? `<button class="chip more" data-all="${sorted.join(",")}" data-li="${li}">+${sorted.length - cap} more</button>` : ""}</div>`;
}
function msCard(i: number, li: number) {
  const m = MS![i], line = D.lines[li], k = line.m.indexOf(i), src = k >= 0 && line.s ? line.s[k].split(":").map(Number) : null;
  const file = src ? m[8][src[0]] : m[8][0];
  return `<div class="ms"><b>${esc(m[0])}</b> ${esc(m[1])}<br><span class="meta">${esc(m[2] || "date not stated")}${m[4] ? ` · about ${m[3] < 0 ? `${-m[3]} BC` : m[3]}` : ""} · ${m[5] ? "early copy" : "late copy"} · proximity ${m[6]}</span><br>
    ${file ? `<a href="${REPO}${file[0].split("/").map(encodeURIComponent).join("/")}${src ? `#L${src[1]}` : ""}" target="_blank" rel="noopener">transcription, line ${esc(line.r)}</a><a href="${esc(file[1])}" target="_blank" rel="noopener">holder's file (${esc(file[2])})</a>` : ""}
    ${m[7].map((v) => `<a href="${esc(v.url)}" target="_blank" rel="noopener">page images: ${esc(v.name)}</a>`).join("")}
    <a href="/c/${D.id}/inputs/#ms-${encodeURIComponent(m[0])}">all about ${esc(m[0])}</a></div>`;
}
async function open(li: number, wi: number) {
  await getMs();
  const line = D.lines[li], [t, c, p, lost, diff, tongue] = line.w[wi];
  document.querySelectorAll(".w.sel").forEach((e) => e.classList.remove("sel"));
  let html = `<h3 dir="auto">${esc(t)}</h3><div class="sub">${esc(line.r)}, word ${wi + 1} · confidence ${pct(c)}</div>`;
  if (tongue === "Aramaic") html += `<div class="sub"><b class="tag ar">Aramaic</b> This word is in Aramaic (rule 14).</div>`;
  if (tongue === "Greek translation") html += `<div class="sub"><b class="tag tr">Greek</b> From a translation: no Hebrew or Aramaic manuscript has this line (rule 15).</div>`;
  if (p >= 0) {
    const pl = D.places[p];
    document.querySelectorAll(`.w[data-l="${li}"]`).forEach((e) => { const x = line.w[+(e as HTMLElement).dataset.w!]; if (x[2] === p) e.classList.add("sel"); });
    html += `<div class="sub">The manuscripts disagree here: <span class="pill ${pl.s}">${pl.s}</span> <span class="pill">${esc(pl.t)}</span></div>`;
    pl.r.forEach((r, ri) => {
      const all = [...r.w, ...(r.p ?? [])];
      html += `<div class="rd${ri === 0 ? " win" : ""}"><div class="g" lang="${D.lang ?? "grc"}" dir="auto">${esc(r.x)}</div><div class="share"><i style="width:${r.s * 100}%"></i></div>
        <div class="meta">${ri === 0 ? "<b>printed</b> · " : ""}${pct(r.s)} of the votes · ${all.length} manuscript${all.length === 1 ? "" : "s"}${r.p?.length ? ` (${r.p.length} with part lost)` : ""}</div>
        ${(r.f ?? []).map((f) => `<div class="why">${WHY[f] ?? f}</div>`).join("")}${chips(all, li)}</div>`;
    });
    if (pl.l?.length) html += `<div class="meta" style="margin-top:8px">Lost in part here, so not counted:</div>${chips(pl.l, li)}`;
  } else {
    (document.querySelector(`.w[data-l="${li}"][data-w="${wi}"]`) as HTMLElement)?.classList.add("sel");
    const out = new Set([...(lost || []), ...(diff || [])]), readers = line.m.filter((x) => !out.has(x));
    html += `<div class="sub">${readers.length} manuscript${readers.length === 1 ? "" : "s"} read this word${diff ? `; ${diff.length} differ alone (no vote)` : ""}${lost ? `; ${lost.length} have it lost` : ""}.</div>${chips(readers, li)}`;
    if (diff) html += `<div class="meta" style="margin-top:8px">Differ alone:</div>${chips(diff, li)}`;
  }
  html += `<div id="mscard"></div>`;
  body.innerHTML = html;
  sheet.classList.add("open");
}
document.addEventListener("click", (e) => {
  const el = e.target as HTMLElement;
  const w = el.closest(".w") as HTMLElement | null;
  if (w) { open(+w.dataset.l!, +w.dataset.w!); return; }
  const chip = el.closest(".chip") as HTMLElement | null;
  if (chip && chip.dataset.ms) { document.getElementById("mscard")!.innerHTML = msCard(+chip.dataset.ms, +chip.dataset.li!); document.getElementById("mscard")!.scrollIntoView({ block: "nearest", behavior: "smooth" }); return; }
  if (chip && chip.dataset.all) { chip.parentElement!.outerHTML = chips(chip.dataset.all.split(",").map(Number), +chip.dataset.li!, 9999); return; }
  if (el.id === "close") { sheet.classList.remove("open"); document.querySelectorAll(".w.sel").forEach((x) => x.classList.remove("sel")); }
});
document.addEventListener("keydown", (e) => { if (e.key === "Escape") sheet.classList.remove("open"); });
const marks = document.getElementById("marks") as HTMLInputElement;
marks?.addEventListener("change", () => document.body.classList.toggle("marks-off", !marks.checked));
// a link to a place (?p=<id>) opens it
const q = new URLSearchParams(location.search).get("p");
if (q) { const li = D.lines.findIndex((l) => l.w.some((w) => w[2] === +q)); if (li >= 0) { const wi = D.lines[li].w.findIndex((w) => w[2] === +q); open(li, wi); document.querySelector(`.w[data-l="${li}"][data-w="${wi}"]`)?.scrollIntoView({ block: "center" }); } }

// Hebrew: show the consonants only (the vowel points and marks are hidden, not removed from the data).
const points = document.getElementById("points") as HTMLInputElement | null;
points?.addEventListener("change", () => {
  for (const b of document.querySelectorAll<HTMLButtonElement>(".hebrew .w")) {
    b.dataset.full ??= b.textContent ?? "";
    b.textContent = points.checked ? b.dataset.full.replace(/[\u0591-\u05C7]/g, (ch) => (ch === "\u05BE" ? ch : "")) : b.dataset.full;
  }
});
