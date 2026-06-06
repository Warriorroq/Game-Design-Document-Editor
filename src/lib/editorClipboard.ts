import { normalizeEditorDom } from "./editorContent";
import { insertHtmlInEditable } from "./editorFormat";
import { isExternalHref } from "./links";
import { stripEphemeralEditorMarkup } from "./searchHighlight";

const ALLOWED_TAGS = new Set([
  "P",
  "BR",
  "DIV",
  "SPAN",
  "STRONG",
  "B",
  "EM",
  "I",
  "U",
  "S",
  "STRIKE",
  "H1",
  "H2",
  "H3",
  "H4",
  "H5",
  "H6",
  "UL",
  "OL",
  "LI",
  "A",
  "HR",
  "BLOCKQUOTE",
  "CODE",
  "PRE",
  "TABLE",
  "THEAD",
  "TBODY",
  "TR",
  "TH",
  "TD",
  "SUP",
  "SUB",
  "BUTTON",
]);

const GLOBAL_ATTRS = new Set(["class", "id", "contenteditable", "tabindex", "aria-label", "role"]);

const TAG_ATTRS: Record<string, Set<string>> = {
  A: new Set(["href", "class", "target", "rel"]),
  SPAN: new Set(["style", "class"]),
  TD: new Set(["colspan", "rowspan"]),
  TH: new Set(["colspan", "rowspan"]),
  TABLE: new Set(["class"]),
  DIV: new Set(["class"]),
  BUTTON: new Set(["type", "class", "contenteditable", "tabindex", "aria-label"]),
};

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function plainTextToHtml(plain: string): string {
  const lines = plain.replace(/\r\n/g, "\n").split("\n");
  if (lines.length <= 1) {
    const t = escapeHtml(plain);
    return t ? `<p>${t}</p>` : "<p><br></p>";
  }
  return lines
    .map((line) => {
      const t = escapeHtml(line);
      return t ? `<p>${t}</p>` : "<p><br></p>";
    })
    .join("");
}

function allowedAttr(tag: string, name: string): boolean {
  const lower = name.toLowerCase();
  if (lower.startsWith("on") || lower === "style") {
    return tag === "SPAN" && lower === "style";
  }
  if (GLOBAL_ATTRS.has(lower)) return true;
  return TAG_ATTRS[tag]?.has(lower) ?? false;
}

function normalizeAnchor(el: HTMLAnchorElement): void {
  const href = el.getAttribute("href")?.trim() ?? "";
  if (!href) {
    unwrapElement(el);
    return;
  }
  el.classList.add("gdd-link");
  if (isExternalHref(href)) {
    el.classList.add("gdd-link--external");
    el.target = "_blank";
    el.rel = "noopener noreferrer";
  } else {
    el.removeAttribute("target");
    el.removeAttribute("rel");
  }
}

function unwrapElement(el: Element): void {
  const parent = el.parentNode;
  if (!parent) return;
  while (el.firstChild) {
    parent.insertBefore(el.firstChild, el);
  }
  parent.removeChild(el);
}

function sanitizeElement(el: Element): void {
  const tag = el.tagName;

  if (!ALLOWED_TAGS.has(tag)) {
    unwrapElement(el);
    return;
  }

  if (tag === "BUTTON" && !el.classList.contains("gdd-table-control")) {
    unwrapElement(el);
    return;
  }

  for (const attr of [...el.attributes]) {
    if (!allowedAttr(tag, attr.name)) {
      el.removeAttribute(attr.name);
    }
  }

  if (tag === "A") {
    normalizeAnchor(el as HTMLAnchorElement);
  }

  for (const child of [...el.childNodes]) {
    if (child.nodeType === Node.ELEMENT_NODE) {
      sanitizeElement(child as Element);
    }
  }
}

export function sanitizePastedHtml(rawHtml: string): string {
  const doc = new DOMParser().parseFromString(rawHtml, "text/html");
  for (const child of [...doc.body.childNodes]) {
    if (child.nodeType === Node.ELEMENT_NODE) {
      sanitizeElement(child as Element);
    }
  }
  return doc.body.innerHTML;
}

export function selectionIsInRoot(root: HTMLElement): boolean {
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0 || sel.isCollapsed) return false;
  const anchor = sel.anchorNode;
  const focus = sel.focusNode;
  return Boolean(
    anchor && focus && root.contains(anchor) && root.contains(focus)
  );
}

export function getSelectionRichContent(
  root: HTMLElement
): { html: string; plain: string } | null {
  if (!selectionIsInRoot(root)) return null;
  const sel = window.getSelection()!;
  const wrap = document.createElement("div");
  wrap.appendChild(sel.getRangeAt(0).cloneContents());
  stripEphemeralEditorMarkup(wrap);
  return { html: wrap.innerHTML, plain: sel.toString() };
}

export function setClipboardRichContent(
  e: ClipboardEvent,
  html: string,
  plain: string
): void {
  const data = e.clipboardData;
  if (!data) return;
  e.preventDefault();
  data.clearData();
  data.setData("text/html", html);
  data.setData("text/plain", plain);
}

export function deleteSelectionInRoot(root: HTMLElement): boolean {
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0 || sel.isCollapsed) return false;
  const anchor = sel.anchorNode;
  const focus = sel.focusNode;
  if (
    !anchor ||
    !focus ||
    !root.contains(anchor) ||
    !root.contains(focus)
  ) {
    return false;
  }
  sel.deleteFromDocument();
  return true;
}

export function pasteRichContent(root: HTMLElement, clipboard: DataTransfer): void {
  const html = clipboard.getData("text/html").trim();
  const plain = clipboard.getData("text/plain");

  if (html) {
    insertHtmlInEditable(root, sanitizePastedHtml(html));
  } else if (plain) {
    insertHtmlInEditable(root, plainTextToHtml(plain));
  }

  normalizeEditorDom(root);
}
