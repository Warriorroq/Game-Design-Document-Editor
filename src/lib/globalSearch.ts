import type { MessageKey } from "./i18n";
import { translate, type AppLanguage } from "./i18n";
import {
  buildAnchorHref,
  buildSectionHref,
  buildTextHref,
} from "./links";
import type { GddDocument, GddSection } from "../types";

export type GlobalSearchMatchKind =
  | "section-title"
  | "section-description"
  | "section-content"
  | "anchor"
  | "desk-text";

export interface GlobalSearchResult {
  key: string;
  href: string;
  sectionId: string;
  sectionTitle: string;
  kind: GlobalSearchMatchKind;
  where: string;
  snippet: string;
  anchorId?: string;
  textId?: string;
}

function normalizeWhitespace(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

function plainTextFromHtml(html: string): string {
  if (!html.trim()) return "";
  const doc = new DOMParser().parseFromString(html, "text/html");
  return normalizeWhitespace(doc.body.textContent ?? "");
}

function matches(haystack: string, needle: string): boolean {
  return haystack.toLowerCase().includes(needle.toLowerCase());
}

export function snippetAround(
  text: string,
  query: string,
  radius = 36
): string {
  const normalized = normalizeWhitespace(text);
  if (!normalized) return "";
  const idx = normalized.toLowerCase().indexOf(query.toLowerCase());
  if (idx < 0) return normalized.slice(0, radius * 2);
  const start = Math.max(0, idx - radius);
  const end = Math.min(normalized.length, idx + query.length + radius);
  let snippet = normalized.slice(start, end);
  if (start > 0) snippet = `…${snippet}`;
  if (end < normalized.length) snippet += "…";
  return snippet;
}

function pushResult(
  results: GlobalSearchResult[],
  item: Omit<GlobalSearchResult, "key"> & { key?: string }
) {
  results.push({
    ...item,
    key: item.key ?? `${item.href}:${results.length}`,
  });
}

const SEARCH_WHERE_KEYS: Record<GlobalSearchMatchKind, MessageKey> = {
  "section-title": "search.where.sectionTitle",
  "section-description": "search.where.sectionDescription",
  "section-content": "search.where.sectionContent",
  anchor: "search.where.anchor",
  "desk-text": "search.where.deskText",
};

function searchSection(
  section: GddSection,
  query: string,
  results: GlobalSearchResult[],
  lang: AppLanguage
) {
  const sectionTitle = section.title || "Untitled";

  if (section.title && matches(section.title, query)) {
    pushResult(results, {
      href: buildSectionHref(section.id),
      sectionId: section.id,
      sectionTitle,
      kind: "section-title",
      where: translate(lang, SEARCH_WHERE_KEYS["section-title"]),
      snippet: snippetAround(section.title, query),
    });
  }

  if (section.description && matches(section.description, query)) {
    pushResult(results, {
      href: buildSectionHref(section.id),
      sectionId: section.id,
      sectionTitle,
      kind: "section-description",
      where: translate(lang, SEARCH_WHERE_KEYS["section-description"]),
      snippet: snippetAround(section.description, query),
    });
  }

  const bodyText = plainTextFromHtml(section.content);
  if (bodyText && matches(bodyText, query)) {
    pushResult(results, {
      href: buildSectionHref(section.id),
      sectionId: section.id,
      sectionTitle,
      kind: "section-content",
      where: translate(lang, SEARCH_WHERE_KEYS["section-content"]),
      snippet: snippetAround(bodyText, query),
    });
  }

  if (section.content.trim()) {
    const parsed = new DOMParser().parseFromString(
      section.content,
      "text/html"
    );
    parsed.querySelectorAll("[id]").forEach((el) => {
      const anchorId = el.id;
      if (!anchorId) return;
      const text = normalizeWhitespace(el.textContent ?? "");
      if (!text || !matches(text, query)) return;
      pushResult(results, {
        key: `anchor:${section.id}:${anchorId}`,
        href: buildAnchorHref(section.id, anchorId),
        sectionId: section.id,
        sectionTitle,
        kind: "anchor",
        where: translate(lang, SEARCH_WHERE_KEYS.anchor),
        snippet: snippetAround(text, query),
        anchorId,
      });
    });
  }

  for (const text of section.texts) {
    const content = normalizeWhitespace(text.content);
    if (!content || !matches(content, query)) continue;
    pushResult(results, {
      key: `text:${section.id}:${text.id}`,
      href: buildTextHref(section.id, text.id),
      sectionId: section.id,
      sectionTitle,
      kind: "desk-text",
      where: translate(lang, SEARCH_WHERE_KEYS["desk-text"]),
      snippet: snippetAround(content, query),
      textId: text.id,
    });
  }
}

export interface SearchFocusTarget {
  sectionId: string;
  query: string;
  kind: GlobalSearchMatchKind;
  anchorId?: string;
}

export function searchDocument(
  doc: GddDocument,
  query: string,
  lang: AppLanguage = "en"
): GlobalSearchResult[] {
  const q = query.trim();
  if (!q) return [];

  const results: GlobalSearchResult[] = [];
  const sorted = [...doc.sections].sort((a, b) => a.order - b.order);
  for (const section of sorted) {
    searchSection(section, q, results, lang);
  }
  return results;
}
