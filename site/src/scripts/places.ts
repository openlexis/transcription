// The list of disagreements: loads each book's places on demand and filters them in the browser.
type R = [string, number, number, number, number, string];
type P = [number, string, R[]];
const form = document.getElementById("filters") as HTMLFormElement;
const fixed = form.dataset.fixed || "", slug = form.dataset.slug!, base = form.dataset.base ?? "";
const listEl = document.getElementById("list")!, countEl = document.getElementById("count")!, more = document.getElementById("more")!;
const cache = new Map<string, P[]>();
let books: { id: string; name: string }[] = [];
let shown = 0, rows: { id: string; name: string; p: P }[] = [];
const esc = (s: unknown) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);
const pct = (x: number) => (x >= 0.9995 ? "over 99.9%" : x <= 0.0005 ? "under 0.1%" : `${Math.round(x * 1000) / 10}%`);
const strip = (s: string) => s.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().replace(/ς/g, "σ");
const url = new URLSearchParams(location.search);
if (url.get("book") && form.book) (form.book as HTMLSelectElement).value = url.get("book")!;
async function load(id: string) { if (!cache.has(id)) cache.set(id, await (await fetch(`/data/${slug}/${id}/places.json`)).json()); return cache.get(id)!; }
async function run() {
  if (!books.length) books = ((await (await fetch("/data/index.json")).json()) as { slug: string; books: { id: string; name: string }[] }[]).find((a) => a.slug === slug)!.books;
  const book = fixed || (form.book as HTMLSelectElement | undefined)?.value || "";
  const ids = book ? [book] : books.map((x) => x.id);
  countEl.textContent = "Loading…";
  const sets = await Promise.all(ids.map(load));
  const max = +(form.max as HTMLInputElement).value / 100, other = +(form.other as HTMLInputElement).value / 100;
  document.getElementById("maxv")!.textContent = max >= 1 ? "any" : `${Math.round(max * 100)}%`;
  document.getElementById("otherv")!.textContent = other ? `${Math.round(other * 100)}%` : "any";
  const q = strip(((form.q as HTMLInputElement).value || "").trim());
  rows = [];
  ids.forEach((id, k) => { const name = books.find((x) => x.id === id)!.name; for (const p of sets[k]) {
    const top = p[2][0]?.[1] ?? 1, second = p[2][1]?.[1] ?? 0;
    if (top > max + 1e-9 || second < other - 1e-9) continue;
    if (q && !(/^\d+:\d*$/.test(q) ? p[1].startsWith(q) : p[2].some((r) => strip(r[0]).includes(q)))) continue;
    rows.push({ id, name, p });
  } });
  const s = (form.sort as HTMLSelectElement).value;
  if (s === "other") rows.sort((a, b) => (b.p[2][1]?.[1] ?? 0) - (a.p[2][1]?.[1] ?? 0));
  else if (s === "least") rows.sort((a, b) => a.p[2][0][1] - b.p[2][0][1]);
  else if (s === "size") rows.sort((a, b) => b.p[2].length - a.p[2].length);
  countEl.textContent = `${rows.length.toLocaleString("en-US")} place${rows.length === 1 ? "" : "s"}`;
  listEl.innerHTML = ""; shown = 0; page();
}
function page() {
  const html = rows.slice(shown, shown + 40).map(({ id, name, p }) => {
    const [pid, ref, rs] = p, ch = ref.split(":")[0];
    return `<div class="place"><div class="head"><a href="${base}/c/${id}/${ch}/?p=${pid}#l${ref.replace(":", "-")}">${esc(fixed ? "" : name + " ")}${esc(ref)}</a></div>
      <div class="rds">${rs.slice(0, 6).map((r, i) => `<div class="r${i === 0 ? " win" : ""}"><div class="g" dir="auto">${esc(r[0])}</div><div class="n">${pct(r[1])} <span class="meta">(90% range ${pct(r[2]) === pct(r[3]) ? `${pct(r[2])} throughout` : `${pct(r[2])} to ${pct(r[3])}`})</span> · ${r[4]} manuscript${r[4] === 1 ? "" : "s"}</div><div class="sig">${esc(r[5])}${r[4] > 12 ? " …" : ""}</div></div>`).join("")}${rs.length > 6 ? `<div class="meta">and ${rs.length - 6} more readings</div>` : ""}</div></div>`;
  }).join("");
  listEl.insertAdjacentHTML("beforeend", html);
  shown += 40; more.hidden = shown >= rows.length;
}
more.addEventListener("click", page);
let tmr: number | undefined;
form.addEventListener("input", () => { clearTimeout(tmr); tmr = window.setTimeout(run, 150); });
run();
