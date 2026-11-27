/** Lay out the book sidebar's previous / transcription / next links: "↑ Transcription" in both
 *  layouts when it fits; a bare ↑ only when previous and next sit side by side and the word does not fit. */
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
  nav.classList.remove("is-stacked", "is-bare-up");
  if (items.length <= 1) {
    nav.classList.add("is-stacked");
    return;
  }
  const fits = () => {
    nav.classList.add("is-measuring");
    const styles = getComputedStyle(nav);
    const gap = Number.parseFloat(styles.columnGap || styles.gap) || 0;
    const need = items.reduce((sum, el) => sum + el.offsetWidth, 0) + gap * (items.length - 1);
    const line = Math.max(...items.map((el) => el.offsetHeight));
    const fitsWidth = need <= nav.clientWidth + 0.5;
    nav.classList.remove("is-measuring");
    void nav.offsetHeight;
    const fitsHeight = nav.clientHeight <= line + 4;
    return fitsWidth && fitsHeight;
  };
  if (fits()) return;
  nav.classList.add("is-bare-up");
  if (fits()) return;
  nav.classList.remove("is-bare-up");
  nav.classList.add("is-stacked");
}
