/** Lay out the book sidebar's previous / transcription / next links: one line with a bare up arrow
 *  between the books when they fit, or a stacked list with "↑ Transcription" when they do not. */
export function initBookSidebarNav(): void {
  const navs = document.querySelectorAll<HTMLElement>("[data-book-nav]");
  navs.forEach((nav) => {
    if (nav.dataset.navReady === "1") return;
    nav.dataset.navReady = "1";
    const layout = () => layoutBookNav(nav);
    layout();
    const ro = new ResizeObserver(layout);
    const box = nav.closest(".page-sidebar") ?? nav.parentElement ?? nav;
    ro.observe(box);
  });
}

function layoutBookNav(nav: HTMLElement): void {
  const items = [...nav.children] as HTMLElement[];
  nav.classList.remove("is-stacked");
  if (items.length <= 1) {
    nav.classList.add("is-stacked");
    return;
  }
  nav.classList.add("is-measuring");
  const styles = getComputedStyle(nav);
  const gap = Number.parseFloat(styles.columnGap || styles.gap) || 0;
  const need = items.reduce((sum, el) => sum + el.offsetWidth, 0) + gap * (items.length - 1);
  const line = Math.max(...items.map((el) => el.offsetHeight));
  const fitsWidth = need <= nav.clientWidth + 0.5;
  nav.classList.remove("is-measuring");
  void nav.offsetHeight;
  const fitsHeight = nav.clientHeight <= line + 4;
  if (!fitsWidth || !fitsHeight) nav.classList.add("is-stacked");
}
