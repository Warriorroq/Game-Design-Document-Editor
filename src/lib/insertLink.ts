import { isExternalHref } from "./links";

export function saveEditorSelection(root: HTMLElement): Range | null {
  const sel = window.getSelection();
  if (!sel?.rangeCount || !sel.anchorNode || !root.contains(sel.anchorNode)) {
    return null;
  }
  return sel.getRangeAt(0).cloneRange();
}

export function restoreEditorSelection(range: Range | null): boolean {
  if (!range) return false;
  const sel = window.getSelection();
  if (!sel) return false;
  sel.removeAllRanges();
  sel.addRange(range);
  return true;
}

export function insertLinkInEditor(
  root: HTMLElement,
  href: string,
  text: string,
  savedRange?: Range | null
): void {
  root.focus();
  const sel = window.getSelection();
  if (!sel) return;

  const a = document.createElement("a");
  a.href = href;
  a.className = isExternalHref(href)
    ? "gdd-link gdd-link--external"
    : "gdd-link";
  if (isExternalHref(href)) {
    a.target = "_blank";
    a.rel = "noopener noreferrer";
  }
  a.textContent = text || href;

  const rangeInRoot = (range: Range) =>
    root.contains(range.startContainer) && root.contains(range.endContainer);

  if (savedRange && rangeInRoot(savedRange)) {
    restoreEditorSelection(savedRange);
  }

  if (!sel.rangeCount || !root.contains(sel.anchorNode)) {
    const end = document.createRange();
    end.selectNodeContents(root);
    end.collapse(false);
    sel.removeAllRanges();
    sel.addRange(end);
  }

  const range = sel.getRangeAt(0);
  if (range.collapsed) {
    range.insertNode(a);
  } else {
    range.deleteContents();
    range.insertNode(a);
  }

  range.setStartAfter(a);
  range.collapse(true);
  sel.removeAllRanges();
  sel.addRange(range);
}
