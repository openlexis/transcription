// Browser side of the cite boxes: switch between plain text and BibTeX, copy a block, and fill in today's date.
import { citeBodyHtml, type CiteBoxData } from "./cite";

function upgrade(root: ParentNode = document) {
  root.querySelectorAll<HTMLElement>(".cite-box[data-cite]").forEach((box) => {
    try {
      const d = JSON.parse(box.dataset.cite || "") as CiteBoxData;
      const body = box.querySelector(".cite-body");
      if (body) body.innerHTML = citeBodyHtml(d, location.origin, new Date());
      box.removeAttribute("data-cite");
    } catch {
      /* keep the server-rendered text */
    }
  });
}

if (!(window as unknown as { __citeUi?: boolean }).__citeUi) {
  (window as unknown as { __citeUi?: boolean }).__citeUi = true;
  document.addEventListener("click", async (e) => {
    const t = e.target as HTMLElement | null;
    const fmtBtn = t?.closest<HTMLButtonElement>("[data-cite-fmt]");
    if (fmtBtn) {
      const box = fmtBtn.closest(".cite-box");
      const fmt = fmtBtn.dataset.citeFmt;
      box?.querySelectorAll<HTMLButtonElement>("[data-cite-fmt]").forEach((b) => {
        const on = b.dataset.citeFmt === fmt;
        b.classList.toggle("active", on);
        b.setAttribute("aria-pressed", String(on));
      });
      box?.querySelectorAll<HTMLElement>(".cite-pre").forEach((p) => (p.hidden = p.dataset.fmt !== fmt));
      return;
    }
    const copyBtn = t?.closest<HTMLButtonElement>("[data-cite-copy]");
    if (copyBtn) {
      const pre = [...(copyBtn.closest(".cite-block")?.querySelectorAll<HTMLElement>(".cite-pre") ?? [])].find((p) => !p.hidden);
      if (!pre) return;
      try {
        await navigator.clipboard.writeText(pre.textContent ?? "");
        copyBtn.textContent = "Copied";
      } catch {
        const r = document.createRange();
        r.selectNodeContents(pre);
        const sel = getSelection();
        sel?.removeAllRanges();
        sel?.addRange(r);
        copyBtn.textContent = "Selected";
      }
      setTimeout(() => (copyBtn.textContent = "Copy"), 1500);
    }
  });
}
upgrade();
