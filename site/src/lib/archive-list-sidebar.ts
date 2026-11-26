/** Nearby-manuscript window and place-in-list bar for the archive list. */

export const ARCHIVE_NAV_RADIUS = 3;

export type ArchiveNavItem = { id: string; name?: string };
export type ArchiveNavEntry = { kind: "item"; index: number } | { kind: "gap" };

export function msAnchor(id: string): string {
  return `ar-ms-${String(id).replace(/[^A-Za-z0-9_-]+/g, "_")}`;
}

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
      const href = `#${msAnchor(item.id)}`;
      if (entry.index === current) {
        return `<li><a href="${href}" class="ar-nav-here" aria-current="location" title="${title}" data-archive-jump="${esc(item.id)}">${inner}</a></li>`;
      }
      return `<li><a href="${href}" title="${title}" data-archive-jump="${esc(item.id)}">${inner}</a></li>`;
    })
    .join("");
}

const thumbObservers = new WeakMap<HTMLElement, ResizeObserver>();
const HEADER_LINE = 90;

function placeThumb(track: HTMLElement, index: number, total: number): void {
  const thumb = track.querySelector<HTMLElement>(".ar-nav-thumb");
  if (!thumb) return;
  const trackH = track.clientHeight;
  if (trackH <= 0) return;
  const thumbH = Math.max(24, trackH / Math.max(total, 1));
  const maxTop = Math.max(0, trackH - thumbH);
  const top = total <= 1 ? 0 : (index / (total - 1)) * maxTop;
  thumb.style.height = `${thumbH}px`;
  thumb.style.top = `${top}px`;
}

function visibleIndex(items: ArchiveNavItem[]): number {
  if (!items.length) return -1;
  const nodes = [...document.querySelectorAll<HTMLElement>(".source-item[data-archive-id]")];
  if (!nodes.length) return 0;
  let currentId = nodes[0].getAttribute("data-archive-id") || "";
  for (const el of nodes) {
    if (el.getBoundingClientRect().top <= HEADER_LINE) {
      currentId = el.getAttribute("data-archive-id") || currentId;
    } else {
      break;
    }
  }
  const idx = items.findIndex((s) => s.id === currentId);
  return idx >= 0 ? idx : 0;
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
  if (!items.length) {
    sidebar.hidden = true;
    body.classList.remove("page-layout");
    return;
  }

  let current = 0;
  const total = items.length;

  const paint = (index: number) => {
    current = Math.max(0, Math.min(index, total - 1));
    list.innerHTML = listHtml(items, current);
    if (pos) {
      pos.textContent = `${(current + 1).toLocaleString("en-US")} of ${total.toLocaleString("en-US")}`;
    }
    const currentLabel = sidebar.querySelector<HTMLElement>("[data-sidebar-current]");
    if (currentLabel) {
      currentLabel.textContent = items[current].id;
      currentLabel.hidden = false;
    }
    if (track) placeThumb(track, current, total);
  };

  const syncFromScroll = () => {
    const index = visibleIndex(items);
    if (index !== current) paint(index);
    else if (track) placeThumb(track, current, total);
  };

  sidebar.hidden = false;
  body.classList.add("page-layout");
  paint(visibleIndex(items));
  requestAnimationFrame(() => {
    if (track) {
      thumbObservers.get(track)?.disconnect();
      const obs = new ResizeObserver(() => placeThumb(track, current, total));
      thumbObservers.set(track, obs);
      obs.observe(track);
      placeThumb(track, current, total);
    }
    syncFromScroll();
  });

  let ticking = false;
  const onScroll = () => {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(() => {
      ticking = false;
      syncFromScroll();
    });
  };
  window.addEventListener("scroll", onScroll, { passive: true });

  const srcList = document.getElementById("src-list");
  if (srcList) {
    new MutationObserver(() => syncFromScroll()).observe(srcList, { childList: true });
  }

  sidebar.addEventListener("click", (e) => {
    const link = (e.target as HTMLElement).closest<HTMLAnchorElement>("[data-archive-jump]");
    if (!link || !sidebar.contains(link)) return;
    const id = link.getAttribute("data-archive-jump");
    if (!id) return;
    e.preventDefault();
    window.dispatchEvent(new CustomEvent("archive-reveal", { detail: { id } }));
    const panel = sidebar.querySelector(".page-sidebar-panel");
    const toggle = sidebar.querySelector<HTMLButtonElement>(".page-sidebar-toggle");
    if (panel && window.matchMedia("(max-width: 920px)").matches) {
      panel.classList.remove("is-open");
      toggle?.setAttribute("aria-expanded", "false");
    }
  });
}
