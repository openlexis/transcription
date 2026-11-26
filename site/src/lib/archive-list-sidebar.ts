/** Nearby-manuscript window and place-in-list bar for archive record pages. */

export const ARCHIVE_NAV_RADIUS = 3;

export type ArchiveNavItem = { id: string; name?: string };
export type ArchiveNavEntry = { kind: "item"; index: number } | { kind: "gap" };

/** Visible indices around `current`, plus the first and last items. A one-item hole is filled instead of shown as a gap. */
export function archiveNavEntries(
  current: number,
  total: number,
  radius = ARCHIVE_NAV_RADIUS,
): ArchiveNavEntry[] {
  if (total <= 0 || current < 0 || current >= total) return [];
  const must = new Set<number>([0, total - 1]);
  for (let i = current - radius; i <= current + radius; i++) {
    if (i >= 0 && i < total) must.add(i);
  }
  const sorted = [...must].sort((a, b) => a - b);
  const filled: number[] = [];
  for (let i = 0; i < sorted.length; i++) {
    if (i > 0 && sorted[i] === sorted[i - 1] + 2) filled.push(sorted[i - 1] + 1);
    filled.push(sorted[i]);
  }
  const uniq = [...new Set(filled)];
  const out: ArchiveNavEntry[] = [];
  for (let i = 0; i < uniq.length; i++) {
    if (i > 0 && uniq[i] > uniq[i - 1] + 1) out.push({ kind: "gap" });
    out.push({ kind: "item", index: uniq[i] });
  }
  return out;
}

export function esc(s: unknown): string {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function itemLabel(item: ArchiveNavItem): string {
  const name = (item.name || "").trim();
  if (name && name !== item.id) return `${name} (${item.id})`;
  return item.id;
}

function itemInner(item: ArchiveNavItem): string {
  const name = (item.name || "").trim();
  const id = `<span class="ar-nav-id">${esc(item.id)}</span>`;
  if (name && name !== item.id) {
    return `${id}<span class="ar-nav-name">${esc(name)}</span>`;
  }
  return id;
}

function listHtml(items: ArchiveNavItem[], current: number): string {
  return archiveNavEntries(current, items.length)
    .map((entry) => {
      if (entry.kind === "gap") {
        return `<li class="ar-nav-gap" aria-hidden="true"><span></span><span></span><span></span></li>`;
      }
      const item = items[entry.index];
      const title = esc(itemLabel(item));
      const inner = itemInner(item);
      if (entry.index === current) {
        return `<li><span class="ar-nav-here" aria-current="page" title="${title}">${inner}</span></li>`;
      }
      const href = `/archive/?id=${encodeURIComponent(item.id)}`;
      return `<li><a href="${href}" title="${title}">${inner}</a></li>`;
    })
    .join("");
}

export function initArchiveListSidebar(): void {
  const body = document.querySelector<HTMLElement>("[data-archive-body]");
  const list = document.querySelector<HTMLElement>("[data-archive-nav-list]");
  const pos = document.querySelector<HTMLElement>("[data-archive-nav-pos]");
  const track = document.querySelector<HTMLElement>("[data-archive-nav-track]");
  const dataEl = document.getElementById("src-data");
  if (!body || !list || !dataEl) return;

  const sidebar = list.closest<HTMLElement>(".page-sidebar");
  if (!sidebar) return;

  const items = JSON.parse(dataEl.textContent || "[]") as ArchiveNavItem[];
  const raw = new URLSearchParams(location.search).get("id")?.trim() || "";
  const current = raw ? items.findIndex((s) => s.id.toLowerCase() === raw.toLowerCase()) : -1;
  const isRecord = current >= 0;

  if (!isRecord) {
    sidebar.hidden = true;
    body.classList.remove("page-layout");
    return;
  }

  const total = items.length;
  list.innerHTML = listHtml(items, current);

  if (pos) {
    pos.textContent = `${(current + 1).toLocaleString("en-US")} of ${total.toLocaleString("en-US")}`;
  }
  if (track) {
    track.style.setProperty("--ar-nav-i", String(current));
    track.style.setProperty("--ar-nav-n", String(total));
  }

  const currentLabel = sidebar.querySelector<HTMLElement>("[data-sidebar-current]");
  if (currentLabel) {
    currentLabel.textContent = items[current].id;
    currentLabel.hidden = false;
  }

  sidebar.hidden = false;
  body.classList.add("page-layout");
}
