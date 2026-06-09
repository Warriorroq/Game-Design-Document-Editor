import { useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { useLocale } from "../context/LocaleContext";
import { useLinkContext } from "../context/LinkContext";
import { resolveBoardItemSrc } from "../lib/boardImageRegistry";
import {
  findBoardItem,
  findBoardText,
  findSection,
  parseGddHref,
} from "../lib/links";
import "./LinkMenus.css";

const HOVER_MS = 250;

function plainSnippet(
  html: string,
  emptyLabel: string,
  max = 200
): string {
  const doc = new DOMParser().parseFromString(html, "text/html");
  const text = (doc.body.textContent ?? "").replace(/\s+/g, " ").trim();
  if (!text) return emptyLabel;
  if (text.length <= max) return text;
  return text.slice(0, max);
}

export function LinkPreviewLayer() {
  const { t } = useLocale();
  const { doc } = useLinkContext();
  const [preview, setPreview] = useState<{
    href: string;
    left: number;
    top: number;
  } | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const anchorRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const clearTimer = () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };

    const hide = () => {
      clearTimer();
      anchorRef.current = null;
      setPreview(null);
    };

    const onOver = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      const link = target?.closest("a.gdd-link, a[href^='gdd:'], a[href^='http']");
      if (!link || !(link instanceof HTMLAnchorElement)) {
        if (!anchorRef.current?.contains(target ?? null)) hide();
        return;
      }

      if (anchorRef.current === link) return;

      clearTimer();
      anchorRef.current = link;
      const rect = link.getBoundingClientRect();
      const href = link.getAttribute("href") ?? "";

      timerRef.current = setTimeout(() => {
        setPreview({
          href,
          left: Math.min(rect.left, window.innerWidth - 320),
          top: rect.bottom + 8,
        });
      }, HOVER_MS);
    };

    const onOut = (e: MouseEvent) => {
      const related = e.relatedTarget as Node | null;
      if (anchorRef.current?.contains(related)) return;
      hide();
    };

    document.addEventListener("mouseover", onOver, true);
    document.addEventListener("mouseout", onOut, true);
    return () => {
      document.removeEventListener("mouseover", onOver, true);
      document.removeEventListener("mouseout", onOut, true);
      clearTimer();
    };
  }, []);

  if (!preview) return null;

  const link = parseGddHref(preview.href);
  let body: ReactNode = null;

  if (!link) {
    body = <p className="link-preview-fallback">{t("link.invalid")}</p>;
  } else if (link.type === "external") {
    body = (
      <div className="link-preview-external">
        <p className="link-preview-url">{link.url}</p>
        <iframe
          title={t("link.previewTitle")}
          src={link.url}
          className="link-preview-iframe"
          sandbox="allow-scripts allow-same-origin"
        />
      </div>
    );
  } else if (link.type === "media") {
    const item = findBoardItem(doc, link.sectionId, link.itemId);
    body = item ? (
      <img src={resolveBoardItemSrc(doc, item)} alt="" className="link-preview-image" />
    ) : (
      <p className="link-preview-fallback">{t("link.imageNotFound")}</p>
    );
  } else if (link.type === "text") {
    const boardText = findBoardText(doc, link.sectionId, link.textId);
    const section = findSection(doc, link.sectionId);
    body = boardText ? (
      <div className="link-preview-section">
        {section && <strong>{section.title}</strong>}
        <p className="link-preview-desk-text">
          {boardText.content || t("link.emptyText")}
        </p>
      </div>
    ) : (
      <p className="link-preview-fallback">{t("link.textNotFound")}</p>
    );
  } else {
    const section = findSection(doc, link.sectionId);
    if (!section) {
      body = <p className="link-preview-fallback">{t("link.sectionNotFound")}</p>;
    } else if (link.type === "anchor") {
      const frag = new DOMParser().parseFromString(section.content, "text/html");
      const el = frag.getElementById(link.anchorId);
      body = (
        <div className="link-preview-section">
          <strong>{section.title}</strong>
          <p>
            {el
              ? plainSnippet(el.outerHTML, t("link.emptySection"), 160)
              : t("link.blockNotFound")}
          </p>
        </div>
      );
    } else {
      body = (
        <div className="link-preview-section">
          <strong>{section.title}</strong>
          {section.description && (
            <p className="link-preview-desc">{section.description}</p>
          )}
          <p>{plainSnippet(section.content, t("link.emptySection"))}</p>
        </div>
      );
    }
  }

  const popover = (
    <div
      className="link-preview-popover"
      style={{ left: preview.left, top: preview.top }}
      onMouseEnter={() => {}}
    >
      {body}
    </div>
  );

  return createPortal(popover, document.body);
}
