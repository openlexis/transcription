// The disagreements list: loads each compilation's places on demand and filters them in the browser.
type P = [number, string, string, string, number, number, [string, number, number, number, string, string][]];
const form = document.getElementById("filters") as HTMLFormElement;
const fixed = form.dataset.fixed || "";
const listEl = document.getElementById("list")!, countEl = document.getElementById("count")!, more = document.getElementById("more")!;
const cache = new Map<string, P[]>();
let index: { id: string; name: string }[] = [];
let shown = 0, rows: { id: string; name: string; p: P }[] = [];
const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);
const pct = (x: number) => `${Math.round(x * 1000) / 10}%`;
const WHY: Record<string, string> = { singular: "one manuscript alone, no vote", "eye-skip": "eye-skip, no vote" };
const strip = (s: string) => s.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().replace(/ς/g, "σ");
// filters from the address (?severity=high&type=omission)
const url = new URLSearchParams(location.search);
if (url.get("severity")) form.querySelectorAll<HTMLInputElement>('[name="severity"]').forEach((x) => (x.checked = x.value === url.get("severity")));
if (url.get("type")) form.querySelectorAll<HTMLInputElement>('[name="type"]').forEach((x) => (x.checked = x.value === url.get("type")));
if (url.get("book") && form.book) (form.book as HTMLSelectElement).value = url.get("book")!;

async function load(id: string) { if (!cache.has(id)) cache.set(id, await (await fetch(`/data/${id}/places.json`)).json()); return cache.get(id)!; }
async function run() {
  if (!index.length) index = await (await fetch("/data/index.json")).json();
  const book = fixed || (form.book as HTMLSelectElement | undefined)?.value || "";
  const ids = book ? [book] : index.map((x) => x.id);
  countEl.textContent = "Loading…";
  const sets = await Promise.all(ids.map(load));
  const sev = new Set([...form.querySelectorAll<HTMLInputElement>('[name="severity"]:checked')].map((x) => x.value));
  const typ = new Set([...form.querySelectorAll<HTMLInputElement>('[name="type"]:checked')].map((x) => x.value));
  const wmin = +(form.weight as HTMLInputElement).value / 100;
  document.getElementById("wv")!.textContent = wmin ? `at least ${Math.round(wmin * 100)}%` : "any";
  const q = strip(((form.q as HTMLInputElement).value || "").trim());
  rows = [];
  ids.forEach((id, k) => { const name = index.find((x) => x.id === id)!.name; for (const p of sets[k]) {
    if (!sev.has(p[3]) || !typ.has(p[2]) || p[4] < wmin) continue;
    if (q && !(/^\d+:\d*$/.test(q) ? p[1].startsWith(q) : p[6].some((r) => strip(r[0]).includes(q)))) continue;
    rows.push({ id, name, p });
  } });
  const s = (form.sort as HTMLSelectElement).value;
  if (s === "weight") rows.sort((a, b) => b.p[4] - a.p[4]);
  else if (s === "conf") rows.sort((a, b) => a.p[5] - b.p[5]);
  else if (s === "size") rows.sort((a, b) => b.p[6].length - a.p[6].length);
  countEl.textContent = `${rows.length.toLocaleString("en-US")} place${rows.length === 1 ? "" : "s"}`;
  listEl.innerHTML = ""; shown = 0; page();
}
function page() {
  const html = rows.slice(shown, shown + 40).map(({ id, name, p }) => {
    const [pid, ref, type, sev, w, c, rs] = p, ch = ref.split(":")[0];
    return `<div class="place"><div class="head"><a href="/c/${id}/${ch}/?p=${pid}#l${ref.replace(":", "-")}">${esc(fixed ? "" : name + " ")}${esc(ref)}</a><span class="pill ${sev}">${sev}</span><span class="pill">${esc(type)}</span><span class="meta">confidence ${pct(c)} · weight ${pct(w)}</span></div>
      <div class="rds">${rs.slice(0, 6).map((r, i) => `<div class="r${i === 0 ? " win" : ""}"><div class="g" lang="grc">${esc(r[0])}</div><div class="n">${pct(r[1])} · ${r[2]} ms</div><div class="sig">${esc(r[5])}${r[2] > 16 ? " …" : ""}${r[4] ? ` · ${r[4].split(",").map((f) => WHY[f] ?? f).join(", ")}` : ""}</div></div>`).join("")}${rs.length > 6 ? `<div class="meta">and ${rs.length - 6} more readings</div>` : ""}</div></div>`;
  }).join("");
  listEl.insertAdjacentHTML("beforeend", html);
  shown += 40; more.hidden = shown >= rows.length;
}
more.addEventListener("click", page);
let tmr: number | undefined;
form.addEventListener("input", () => { clearTimeout(tmr); tmr = window.setTimeout(run, 150); });
run();
