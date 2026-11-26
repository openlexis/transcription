/** Highlight the sidebar link for the section currently in view, and close the mobile panel after a jump. */

const HEADER_LINE = 90;
const MOBILE_MQ = "(max-width: 920px)";

export function initSidebarSpy(): void {
  const sidebars = document.querySelectorAll<HTMLElement>("[data-page-sidebar]");
  sidebars.forEach((sidebar) => {
    if (sidebar.dataset.spyReady === "1") return;
    sidebar.dataset.spyReady = "1";
    bindSidebar(sidebar);
  });
}

function bindSidebar(sidebar: HTMLElement): void {
  const links = [...sidebar.querySelectorAll<HTMLAnchorElement>('a[href^="#"]')];
  const sections: { id: string; el: HTMLElement; link: HTMLAnchorElement }[] = [];
  for (const link of links) {
    const id = decodeURIComponent(link.hash.replace(/^#/, ""));
    if (!id) continue;
    const el = document.getElementById(id);
    if (el) sections.push({ id, el, link });
  }
  if (!sections.length) return;

  const currentLabel = sidebar.querySelector<HTMLElement>("[data-sidebar-current]");

  const setActive = (id: string | null) => {
    for (const s of sections) {
      const on = s.id === id;
      s.link.classList.toggle("is-active", on);
      if (on) s.link.setAttribute("aria-current", "location");
      else s.link.removeAttribute("aria-current");
    }
    if (currentLabel) {
      const s = sections.find((x) => x.id === id);
      const text =
        s?.link.getAttribute("data-current-label")?.trim() ||
        s?.link.textContent?.replace(/\s+/g, " ").trim() ||
        "";
      currentLabel.textContent = text;
      currentLabel.hidden = !text;
    }
  };

  const pick = () => {
    let aboveId: string | null = null;
    let aboveTop = -Infinity;
    let firstBelow: string | null = null;
    let firstBelowTop = Infinity;
    for (const s of sections) {
      if (s.el.hidden) continue;
      const top = s.el.getBoundingClientRect().top;
      if (top <= HEADER_LINE) {
        if (top >= aboveTop) {
          aboveTop = top;
          aboveId = s.id;
        }
      } else if (top < firstBelowTop) {
        firstBelowTop = top;
        firstBelow = s.id;
      }
    }
    setActive(aboveId ?? firstBelow ?? sections[0]?.id ?? null);
  };

  const obs = new IntersectionObserver(pick, {
    rootMargin: "-80px 0px -40% 0px",
    threshold: [0, 0.1, 0.25, 0.5, 1],
  });
  for (const s of sections) obs.observe(s.el);

  let ticking = false;
  window.addEventListener(
    "scroll",
    () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        ticking = false;
        pick();
      });
    },
    { passive: true },
  );
  pick();

  sidebar.addEventListener("click", (e) => {
    const link = (e.target as HTMLElement).closest('a[href^="#"]');
    if (!link || !sidebar.contains(link)) return;
    const panel = sidebar.querySelector(".page-sidebar-panel");
    if (panel instanceof HTMLDetailsElement && window.matchMedia(MOBILE_MQ).matches) {
      panel.open = false;
    }
  });
}
