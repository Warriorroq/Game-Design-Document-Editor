import { useCallback, useEffect, useLayoutEffect, useMemo, useRef } from "react";
import { useLocale } from "../context/LocaleContext";
import { useShortcuts } from "../context/ShortcutsContext";
import { useLinkContext } from "../context/LinkContext";
import { applyEditorFormat } from "../lib/editorFormat";
import { EDITOR_FORMAT_SHORTCUT_ACTIONS } from "../lib/editorFormatShortcuts";
import { ensureBlockAnchor, findBlockElement } from "../lib/editorAnchors";
import {
  deleteSelectionInRoot,
  getSelectionRichContent,
  pasteRichContent,
  setClipboardRichContent,
} from "../lib/editorClipboard";
import {
  contentForEditor,
  normalizeEditorDom,
  previewMissingTableControls,
  serializeEditorHtml,
} from "../lib/editorContent";
import { insertLinkInEditor, saveEditorSelection } from "../lib/insertLink";
import type { SearchFocusTarget } from "../lib/globalSearch";
import {
  buildAnchorHref,
  isNavigableHref,
} from "../lib/links";
import {
  HIGHLIGHT_FLASH_MS,
  flashElement,
  highlightQueryInElement,
  stripEphemeralEditorMarkup,
} from "../lib/searchHighlight";
import type { GddSection } from "../types";
import { FormatToolbar } from "./FormatToolbar";

interface SectionEditorProps {
  section: GddSection;
  onChange: (patch: Partial<GddSection>) => void;
  scrollToAnchorId?: string;
  onScrollAnchorDone?: () => void;
  searchFocus?: SearchFocusTarget | null;
  onSearchFocusDone?: () => void;
}

function plainTextFromHtml(html: string): string {
  const doc = new DOMParser().parseFromString(html, "text/html");
  return (doc.body.textContent ?? "").replace(/\s+/g, " ").trim();
}

export function SectionEditor({
  section,
  onChange,
  scrollToAnchorId,
  onScrollAnchorDone,
  searchFocus,
  onSearchFocusDone,
}: SectionEditorProps) {
  const { t } = useLocale();
  const { matches: shortcutMatches } = useShortcuts();
  const { navigateToHref, openContextMenu } = useLinkContext();
  const editorRef = useRef<HTMLElement>(null);
  const titleRef = useRef<HTMLInputElement>(null);
  const descRef = useRef<HTMLInputElement>(null);
  const savedSelectionRef = useRef<Range | null>(null);
  const skipInnerHTMLReplaceOnceRef = useRef(false);

  useLayoutEffect(() => {
    const el = editorRef.current;
    if (!el) return;
    if (skipInnerHTMLReplaceOnceRef.current) {
      skipInnerHTMLReplaceOnceRef.current = false;
      return;
    }
    const html = contentForEditor(section.content);
    const domMatchesContent =
      serializeEditorHtml(el).trim() === section.content.trim();
    const missingControls = previewMissingTableControls(el);
    const focused = document.activeElement === el;

    if (focused && domMatchesContent && !missingControls) return;

    if (el.innerHTML !== html) {
      el.innerHTML = html;
      normalizeEditorDom(el);
    }
  }, [section.id, section.content]);

  useLayoutEffect(() => {
    if (!scrollToAnchorId) return;
    const el = editorRef.current;
    if (!el) return;

    requestAnimationFrame(() => {
      const target = el.querySelector(
        `#${CSS.escape(scrollToAnchorId)}`
      ) as HTMLElement | null;
      if (target) {
        target.scrollIntoView({ behavior: "smooth", block: "center" });
        target.classList.add("gdd-anchor-flash");
        window.setTimeout(
          () => target.classList.remove("gdd-anchor-flash"),
          HIGHLIGHT_FLASH_MS
        );
      }
      onScrollAnchorDone?.();
    });
  }, [scrollToAnchorId, section.id, onScrollAnchorDone]);

  useLayoutEffect(() => {
    if (!searchFocus || searchFocus.sectionId !== section.id) return;

    let cleanupHighlights: (() => void) | undefined;
    const doneTimer = window.setTimeout(() => {
      cleanupHighlights?.();
      onSearchFocusDone?.();
    }, HIGHLIGHT_FLASH_MS);

    requestAnimationFrame(() => {
      const { query, kind } = searchFocus;
      if (kind === "section-title") {
        flashElement(titleRef.current);
      } else if (kind === "section-description") {
        flashElement(descRef.current);
      } else if (kind === "section-content" && editorRef.current) {
        cleanupHighlights = highlightQueryInElement(editorRef.current, query);
      } else if (kind === "anchor" && searchFocus.anchorId && editorRef.current) {
        const target = editorRef.current.querySelector(
          `#${CSS.escape(searchFocus.anchorId)}`
        );
        if (target instanceof HTMLElement) {
          cleanupHighlights = highlightQueryInElement(target, query);
          flashElement(target, "gdd-anchor-flash");
        }
      }
    });

    return () => {
      window.clearTimeout(doneTimer);
      cleanupHighlights?.();
    };
  }, [searchFocus, section.id, onSearchFocusDone]);

  useEffect(() => {
    return () => {
      const el = editorRef.current;
      if (!el) return;
      stripEphemeralEditorMarkup(el);
      titleRef.current?.classList.remove("gdd-search-flash");
      descRef.current?.classList.remove("gdd-search-flash");
    };
  }, [section.id]);

  useEffect(() => {
    if (section.content.trim() || section.title !== "New Section") return;
    const frame = requestAnimationFrame(() => {
      editorRef.current?.focus();
    });
    const timer = window.setTimeout(() => {
      editorRef.current?.focus();
    }, 50);
    return () => {
      cancelAnimationFrame(frame);
      window.clearTimeout(timer);
    };
  }, [section.id, section.content, section.title]);

  const syncContent = useCallback(() => {
    const el = editorRef.current;
    if (!el) return;
    onChange({ content: serializeEditorHtml(el) });
  }, [onChange]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const root = editorRef.current;
      if (!root) return;

      const target = e.target as HTMLElement;
      if (target.tagName === "INPUT" || target.tagName === "TEXTAREA") return;
      if (!root.contains(target) && document.activeElement !== root) return;

      for (const { id, action } of EDITOR_FORMAT_SHORTCUT_ACTIONS) {
        if (!shortcutMatches(id, e)) continue;
        e.preventDefault();
        applyEditorFormat(root, action);
        syncContent();
        return;
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [shortcutMatches, syncContent]);

  const addRowToDomTable = useCallback((table: HTMLTableElement) => {
    const firstRow =
      table.tHead?.rows[0] ??
      table.tBodies?.[0]?.rows?.[0] ??
      table.rows?.[0] ??
      null;
    const colCount = firstRow?.cells.length ?? 2;

    const tbody =
      table.tBodies?.[0] ??
      (() => {
        const tb = document.createElement("tbody");
        table.appendChild(tb);
        return tb;
      })();

    const tr = document.createElement("tr");
    for (let i = 0; i < colCount; i++) {
      tr.appendChild(document.createElement("td"));
    }
    tbody.appendChild(tr);
  }, []);

  const addColToDomTable = useCallback((table: HTMLTableElement) => {
    const rows = Array.from(table.querySelectorAll("tr"));
    for (const tr of rows) {
      const isHead = tr.parentElement?.tagName === "THEAD";
      const cell = document.createElement(isHead ? "th" : "td");
      tr.appendChild(cell);
    }
  }, []);

  const deleteRowFromDomTable = useCallback((table: HTMLTableElement) => {
    const tbody = table.tBodies?.[0];
    if (!tbody) return;

    const rows = Array.from(tbody.querySelectorAll("tr"));
    if (rows.length <= 1) return;

    rows[rows.length - 1]?.remove();
  }, []);

  const deleteColFromDomTable = useCallback((table: HTMLTableElement) => {
    const sampleRow =
      table.tHead?.rows?.[0] ??
      table.tBodies?.[0]?.rows?.[0] ??
      table.rows?.[0] ??
      null;

    const colCount = sampleRow?.cells.length ?? 0;
    if (colCount <= 1) return;

    const rows = Array.from(table.querySelectorAll("tr"));
    for (const tr of rows) {
      const cells = Array.from(tr.cells);
      if (cells.length <= 1) continue;
      cells[cells.length - 1]?.remove();
    }
  }, []);

  const handleTableControlClick = useCallback(
    (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      if (!target) return;

      const addRowBtn = target.closest(
        ".gdd-table-add-row"
      ) as HTMLElement | null;
      const addColBtn = target.closest(
        ".gdd-table-add-col"
      ) as HTMLElement | null;

      const delRowBtn = target.closest(
        ".gdd-table-del-row"
      ) as HTMLElement | null;
      const delColBtn = target.closest(
        ".gdd-table-del-col"
      ) as HTMLElement | null;

      if (!addRowBtn && !addColBtn && !delRowBtn && !delColBtn) return;

      const wrap = target.closest(".gdd-table-wrap") as HTMLElement | null;
      const table = wrap?.querySelector("table.gdd-table") as
        | HTMLTableElement
        | null;
      if (!table) return;

      e.preventDefault();
      e.stopPropagation();

      if (addRowBtn) addRowToDomTable(table);
      if (addColBtn) addColToDomTable(table);
      if (delRowBtn) deleteRowFromDomTable(table);
      if (delColBtn) deleteColFromDomTable(table);

      skipInnerHTMLReplaceOnceRef.current = true;
      syncContent();
    },
    [
      addColToDomTable,
      addRowToDomTable,
      deleteColFromDomTable,
      deleteRowFromDomTable,
      syncContent,
    ]
  );

  const handleTableControlMouseDown = useCallback((e: MouseEvent) => {
    const target = e.target as HTMLElement | null;
    if (!target) return;
    if (target.closest(".gdd-table-control")) {
      e.preventDefault();
      e.stopPropagation();
    }
  }, []);

  const wordCount = useMemo(() => {
    const text = plainTextFromHtml(section.content);
    if (!text) return 0;
    return text.split(/\s+/).filter(Boolean).length;
  }, [section.content]);

  const handleEditorInput = () => {
    syncContent();
  };

  const handleEditorCopy = (e: React.ClipboardEvent) => {
    const root = editorRef.current;
    if (!root) return;
    const rich = getSelectionRichContent(root);
    if (!rich) return;
    setClipboardRichContent(e.nativeEvent, rich.html, rich.plain);
  };

  const handleEditorCut = (e: React.ClipboardEvent) => {
    const root = editorRef.current;
    if (!root) return;
    const rich = getSelectionRichContent(root);
    if (!rich) return;
    setClipboardRichContent(e.nativeEvent, rich.html, rich.plain);
    deleteSelectionInRoot(root);
    syncContent();
  };

  const handleEditorPaste = (e: React.ClipboardEvent) => {
    const root = editorRef.current;
    if (!root) return;
    e.preventDefault();
    pasteRichContent(root, e.clipboardData);
    syncContent();
  };

  const handleEditorClick = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    const link = target.closest("a[href]");
    if (!link || !editorRef.current?.contains(link)) return;
    const href = link.getAttribute("href") ?? "";
    if (!isNavigableHref(href)) return;
    e.preventDefault();
    navigateToHref(href);
  };

  const handleEditorContextMenu = (e: React.MouseEvent) => {
    const root = editorRef.current;
    if (!root) return;

    e.preventDefault();
    const target = e.target as HTMLElement;

    if (target.closest(".gdd-table-control")) return;

    savedSelectionRef.current = saveEditorSelection(root);

    let copyHref: string | undefined;
    const linkEl = target.closest("a[href]");
    if (linkEl instanceof HTMLAnchorElement) {
      copyHref = linkEl.getAttribute("href") ?? "";
    } else {
      const block = findBlockElement(target, root);
      if (block) {
        const anchorId = ensureBlockAnchor(block);
        copyHref = buildAnchorHref(section.id, anchorId);
      }
    }

    openContextMenu({
      x: e.clientX,
      y: e.clientY,
      copyHref,
      pasteLink: {
        href: "",
        suggestedText: "",
        insert: (href, text) => {
          if (!editorRef.current) return;
          insertLinkInEditor(
            editorRef.current,
            href,
            text,
            savedSelectionRef.current
          );
          savedSelectionRef.current = null;
          syncContent();
        },
      },
    });
  };

  useLayoutEffect(() => {
    const el = editorRef.current;
    if (!el) return;

    el.addEventListener("click", handleTableControlClick);
    el.addEventListener("mousedown", handleTableControlMouseDown);
    return () => {
      el.removeEventListener("click", handleTableControlClick);
      el.removeEventListener("mousedown", handleTableControlMouseDown);
    };
  }, [section.id, handleTableControlClick, handleTableControlMouseDown]);

  return (
    <main className="editor">
      <div className="editor-header">
        <input
          ref={titleRef}
          className="section-title-input"
          value={section.title}
          onChange={(e) => onChange({ title: e.target.value })}
          aria-label={t("editor.sectionTitleAria")}
        />
        <input
          ref={descRef}
          className="section-desc-input"
          value={section.description}
          onChange={(e) => onChange({ description: e.target.value })}
          placeholder={t("editor.sectionDescPlaceholder")}
          aria-label={t("editor.sectionDescAria")}
        />
        <div className="editor-toolbar">
          <span className="word-count">
            {t("editor.words", { count: wordCount })}
          </span>
        </div>
      </div>

      <div className="editor-body">
        <article
          ref={editorRef}
          className="markdown-preview markdown-preview--editable"
          contentEditable
          suppressContentEditableWarning
          onInput={handleEditorInput}
          onBlur={syncContent}
          onCopy={handleEditorCopy}
          onCut={handleEditorCut}
          onPaste={handleEditorPaste}
          onClick={handleEditorClick}
          onContextMenu={handleEditorContextMenu}
          spellCheck
          aria-label={t("editor.contentAria")}
        />
      </div>

      <FormatToolbar editorRef={editorRef} onContentChange={syncContent} />
    </main>
  );
}
