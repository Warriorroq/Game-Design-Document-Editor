import { normalizeEditorDom } from "@/features/editor/lib/editorContent";
import { DEFAULT_TABLE_HTML } from "@/features/editor/lib/markdown";
import { matchPaletteColor } from "@/shared/lib/textColorUtils";

export type FormatAction =
  | "bold"
  | "italic"
  | "h1"
  | "h2"
  | "h3"
  | "paragraph"
  | "bulletList"
  | "orderedList"
  | "hr"
  | "table";

function focusEnd(el: HTMLElement) {
  el.focus();
  const range = document.createRange();
  range.selectNodeContents(el);
  range.collapse(false);
  const sel = window.getSelection();
  sel?.removeAllRanges();
  sel?.addRange(range);
}

export function insertHtmlInEditable(root: HTMLElement, html: string) {
  root.focus();
  const sel = window.getSelection();
  if (!sel) return;

  if (!sel.rangeCount || !root.contains(sel.anchorNode)) {
    root.insertAdjacentHTML("beforeend", html);
    focusEnd(root);
    return;
  }

  const range = sel.getRangeAt(0);
  range.deleteContents();
  const fragment = range.createContextualFragment(html);
  range.insertNode(fragment);
  range.collapse(false);
  sel.removeAllRanges();
  sel.addRange(range);
}

export function applyEditorFormat(root: HTMLElement, action: FormatAction) {
  root.focus();

  switch (action) {
    case "bold":
      document.execCommand("bold");
      break;
    case "italic":
      document.execCommand("italic");
      break;
    case "h1":
      document.execCommand("formatBlock", false, "h1");
      break;
    case "h2":
      document.execCommand("formatBlock", false, "h2");
      break;
    case "h3":
      document.execCommand("formatBlock", false, "h3");
      break;
    case "paragraph":
      document.execCommand("formatBlock", false, "p");
      break;
    case "bulletList":
      document.execCommand("insertUnorderedList");
      break;
    case "orderedList":
      document.execCommand("insertOrderedList");
      break;
    case "hr":
      document.execCommand("insertHorizontalRule");
      break;
    case "table": {
      const sel = window.getSelection();
      if (sel?.rangeCount && root.contains(sel.anchorNode)) {
        document.execCommand("insertParagraph");
      }
      insertHtmlInEditable(root, DEFAULT_TABLE_HTML + "<p><br></p>");
      normalizeEditorDom(root);
      break;
    }
  }
}

export function editorHasTextSelection(root: HTMLElement): boolean {
  const sel = window.getSelection();
  if (!sel || sel.isCollapsed || !sel.rangeCount) return false;
  return (
    root.contains(sel.anchorNode) && root.contains(sel.focusNode)
  );
}

export function getEditorSelectionColor(root: HTMLElement): string | null {
  if (!editorHasTextSelection(root)) return null;
  root.focus();
  const raw = document.queryCommandValue("foreColor");
  if (typeof raw !== "string" || !raw) return null;
  return matchPaletteColor(raw);
}

export function applyEditorTextColor(root: HTMLElement, color: string) {
  if (!editorHasTextSelection(root)) return;
  root.focus();
  document.execCommand("styleWithCSS", false, "true");
  document.execCommand("foreColor", false, color);
  normalizeEditorDom(root);
}
