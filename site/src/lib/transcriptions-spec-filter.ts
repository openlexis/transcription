/** Client-side filter for /transcriptions/?specification=<ULID>. */
export function initTranscriptionsSpecFilter(): void {
  const catalog = readCatalog();
  const list = document.querySelector<HTMLElement>("[data-transcription-list]");
  const cards = list
    ? Array.from(list.querySelectorAll<HTMLElement>("[data-spec-id]"))
    : [];
  const bar = document.querySelector<HTMLElement>("[data-spec-filter]");
  const titleEl = document.querySelector("[data-spec-filter-title]");
  const clearBtn = document.querySelector("[data-spec-filter-clear]");
  const empty = document.querySelector<HTMLElement>("[data-spec-filter-empty]");

  function requestedId(): string {
    return new URLSearchParams(location.search).get("specification")?.trim() ?? "";
  }

  function matches(card: HTMLElement, id: string): boolean {
    const full = card.dataset.specId ?? "";
    const short = card.dataset.specShort ?? "";
    const needle = id.toLowerCase();
    return full.toLowerCase() === needle || short.toLowerCase() === needle;
  }

  function titleFor(id: string): string {
    return catalog[id] ?? catalog[id.slice(-6)] ?? id;
  }

  function apply(id: string): void {
    if (!id) {
      bar?.setAttribute("hidden", "");
      for (const card of cards) card.removeAttribute("hidden");
      if (list) list.hidden = cards.length === 0;
      if (empty) empty.hidden = true;
      return;
    }

    if (titleEl) titleEl.textContent = titleFor(id);
    bar?.removeAttribute("hidden");

    let shown = 0;
    for (const card of cards) {
      const ok = matches(card, id);
      card.hidden = !ok;
      if (ok) shown += 1;
    }
    if (list) list.hidden = shown === 0;
    if (empty) empty.hidden = shown !== 0;
  }

  clearBtn?.addEventListener("click", () => {
    const url = new URL(location.href);
    url.searchParams.delete("specification");
    const next = url.pathname + url.search + url.hash;
    history.replaceState({}, "", next);
    apply("");
  });

  apply(requestedId());
}

function readCatalog(): Record<string, string> {
  const el = document.getElementById("spec-filter-catalog");
  if (!el?.textContent) return {};
  try {
    const data = JSON.parse(el.textContent) as Record<string, string>;
    return data && typeof data === "object" ? data : {};
  } catch {
    return {};
  }
}
