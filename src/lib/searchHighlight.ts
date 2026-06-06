/** How long search / link target highlights stay visible. */
export const HIGHLIGHT_FLASH_MS = 800;

export function flashElement(el: HTMLElement | null, className = "gdd-search-flash") {
  if (!el) return;
  el.scrollIntoView({ behavior: "smooth", block: "center" });
  el.classList.add(className);
  window.setTimeout(() => el.classList.remove(className), HIGHLIGHT_FLASH_MS);
}

const EPHEMERAL_MARKUP_RE =
  /gdd-search-hit|gdd-anchor-flash|gdd-search-flash/;

function unwrapMark(mark: HTMLElement) {
  const parent = mark.parentNode;
  if (!parent) return;
  while (mark.firstChild) {
    parent.insertBefore(mark.firstChild, mark);
  }
  parent.removeChild(mark);
}

/** Remove search marks and flash classes so they are never persisted or shown after reload. */
export function stripEphemeralEditorMarkup(root: HTMLElement): void {
  root.querySelectorAll("mark.gdd-search-hit").forEach((node) => {
    unwrapMark(node as HTMLElement);
  });
  root
    .querySelectorAll(".gdd-anchor-flash, .gdd-search-flash")
    .forEach((el) => {
      el.classList.remove("gdd-anchor-flash", "gdd-search-flash");
    });
}

export function stripEphemeralFromHtml(html: string): string {
  if (!html.trim() || !EPHEMERAL_MARKUP_RE.test(html)) return html;
  const doc = new DOMParser().parseFromString(html, "text/html");
  stripEphemeralEditorMarkup(doc.body);
  return doc.body.innerHTML;
}
export function highlightQueryInElement(
  root: HTMLElement,
  query: string
): () => void {
  stripEphemeralEditorMarkup(root);

  const q = query.trim();
  if (!q) return () => undefined;

  const marks: HTMLElement[] = [];
  const needle = q.toLowerCase();
  const textNodes: Text[] = [];
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let node = walker.nextNode();
  while (node) {
    textNodes.push(node as Text);
    node = walker.nextNode();
  }

  for (const textNode of textNodes) {
    const text = textNode.textContent ?? "";
    const idx = text.toLowerCase().indexOf(needle);
    if (
      idx < 0 ||
      !textNode.parentElement ||
      textNode.parentElement.closest("mark.gdd-search-hit")
    ) {
      continue;
    }
    const range = document.createRange();
    range.setStart(textNode, idx);
    range.setEnd(textNode, Math.min(idx + q.length, text.length));
    const mark = document.createElement("mark");
    mark.className = "gdd-search-hit";
    try {
      range.surroundContents(mark);
      marks.push(mark);
    } catch {
      /* split across elements — skip */
    }
  }

  const first = marks[0];
  if (first) {
    first.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  return () => {
    marks.forEach(unwrapMark);
  };
}
