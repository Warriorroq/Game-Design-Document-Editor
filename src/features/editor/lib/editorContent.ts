import {
  stripEphemeralEditorMarkup,
  stripEphemeralFromHtml,
} from "@/shared/lib/searchHighlight";
import { isExternalHref } from "@/features/links/lib/links";
import { previewMissingTableControls, renderMarkdown } from "@/features/editor/lib/markdown";

export { previewMissingTableControls };

const EMPTY_PLACEHOLDER =
  "<p class='empty-preview'>Click here to start writing</p>";

export function looksLikeMarkdown(text: string): boolean {
  const t = text.trim();
  if (!t) return false;
  if (
    t.includes("gdd-table-wrap") ||
    /^<(p|h[1-6]|ul|ol|div|table)\b/i.test(t)
  ) {
    return false;
  }
  return (
    /^#{1,3}\s/m.test(t) ||
    /^\s*[-*]\s+/m.test(t) ||
    /^\s*\d+\.\s+/m.test(t) ||
    /\*\*[^*]+\*\*/.test(t) ||
    /^\|.+\|/m.test(t) ||
    /^---\s*$/m.test(t)
  );
}

export function ensureHtmlContent(content: string): string {
  if (!content.trim()) return "";
  const html = looksLikeMarkdown(content)
    ? renderMarkdown(content)
    : content;
  return stripEphemeralFromHtml(html);
}

export function contentForEditor(content: string): string {
  const html = ensureHtmlContent(content);
  if (!html.trim()) return EMPTY_PLACEHOLDER;
  return html;
}

function isEmptyBlock(el: Element): boolean {
  const tag = el.tagName;
  if (tag !== "P" && tag !== "DIV") return false;
  const text = (el.textContent ?? "").replace(/\u200B/g, "").trim();
  if (text) return false;
  const html = el.innerHTML.trim().toLowerCase();
  return html === "" || html === "<br>" || html === "<br/>";
}

function normalizeLinks(root: HTMLElement): void {
  root.querySelectorAll("a[href]").forEach((node) => {
    const a = node as HTMLAnchorElement;
    const href = a.getAttribute("href");
    if (!href) return;
    a.classList.add("gdd-link");
    if (isExternalHref(href)) {
      a.classList.add("gdd-link--external");
      a.target = "_blank";
      a.rel = "noopener noreferrer";
    }
  });
}

/** Strip orphan empty blocks before tables; keeps tables on their own line. */
export function normalizeEditorDom(root: HTMLElement): void {
  normalizeLinks(root);
  for (const wrap of root.querySelectorAll(".gdd-table-wrap")) {
    let prev = wrap.previousElementSibling;
    while (prev && isEmptyBlock(prev)) {
      const remove = prev;
      prev = prev.previousElementSibling;
      remove.remove();
    }
  }
}

export function serializeEditorHtml(root: HTMLElement): string {
  normalizeEditorDom(root);
  const clone = root.cloneNode(true) as HTMLElement;
  stripEphemeralEditorMarkup(clone);
  clone.querySelectorAll(".empty-preview").forEach((el) => {
    const p = el.closest("p");
    if (p && p.childElementCount === 1 && p.contains(el)) {
      p.remove();
    } else {
      el.remove();
    }
  });
  const html = clone.innerHTML.trim();
  if (!html || html === "<p><br></p>" || html === "<br>") return "";
  return html;
}
