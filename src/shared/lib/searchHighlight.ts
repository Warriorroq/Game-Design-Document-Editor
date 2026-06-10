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
interface TextMatchPosition {
  textNode: Text;
  idx: number;
}

export function highlightQueryInElement(
  root: HTMLElement,
  query: string,
  focusIndex = 0
): () => void {
  stripEphemeralEditorMarkup(root);

  const q = query.trim();
  if (!q) return () => undefined;

  const needle = q.toLowerCase();
  const textNodes: Text[] = [];
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let node = walker.nextNode();
  while (node) {
    textNodes.push(node as Text);
    node = walker.nextNode();
  }

  const positions: TextMatchPosition[] = [];
  for (const textNode of textNodes) {
    if (
      !textNode.parentElement ||
      textNode.parentElement.closest("mark.gdd-search-hit")
    ) {
      continue;
    }
    const text = textNode.textContent ?? "";
    let pos = 0;
    while (pos < text.length) {
      const idx = text.toLowerCase().indexOf(needle, pos);
      if (idx < 0) break;
      positions.push({ textNode, idx });
      pos = idx + q.length;
    }
  }

  const marks: HTMLElement[] = [];
  for (let i = positions.length - 1; i >= 0; i--) {
    const { textNode, idx } = positions[i];
    const text = textNode.textContent ?? "";
    const range = document.createRange();
    range.setStart(textNode, idx);
    range.setEnd(textNode, Math.min(idx + q.length, text.length));
    const mark = document.createElement("mark");
    mark.className = "gdd-search-hit";
    try {
      range.surroundContents(mark);
      marks.unshift(mark);
    } catch {
      /* split across elements — skip */
    }
  }

  if (marks.length > 0) {
    const safeIndex = Math.min(Math.max(0, focusIndex), marks.length - 1);
    marks.forEach((mark, i) => {
      if (i === safeIndex) mark.classList.add("gdd-search-hit-active");
    });
    marks[safeIndex]?.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  return () => {
    marks.forEach(unwrapMark);
  };
}
