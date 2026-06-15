const BLOCK_TAGS = new Set([
  "H1",
  "H2",
  "H3",
  "P",
  "LI",
  "TD",
  "TH",
  "BLOCKQUOTE",
]);

export function findBlockElement(
  node: Node | null,
  root: HTMLElement
): HTMLElement | null {
  let current: Node | null = node;
  while (current && current !== root) {
    if (current.nodeType === Node.ELEMENT_NODE) {
      const el = current as HTMLElement;
      if (BLOCK_TAGS.has(el.tagName)) return el;
    }
    current = current.parentNode;
  }
  return null;
}

export function ensureBlockAnchor(el: HTMLElement): string {
  if (el.id && el.id.length > 0) return el.id;
  const id = `gdd-${crypto.randomUUID().slice(0, 8)}`;
  el.id = id;
  return id;
}

export function blockLabel(el: HTMLElement): string {
  const text = (el.textContent ?? "").replace(/\s+/g, " ").trim();
  if (text) return text.slice(0, 80);
  return el.tagName.toLowerCase();
}
