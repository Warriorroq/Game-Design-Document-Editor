import {
  displayBoardImageAssetName,
  listBoardImageAssetDesks,
} from "@/features/board/lib/boardImageRegistry";
import type { MessageKey } from "@/shared/i18n";
import { translate, type AppLanguage } from "@/shared/i18n";
import {
  buildAnchorHref,
  buildMediaHref,
  buildSectionHref,
  buildTextHref,
} from "@/features/links/lib/links";
import type { GddDocument, GddSection } from "@/shared/types";

export type GlobalSearchMatchKind =
  | "section-title"
  | "section-description"
  | "section-content"
  | "folder-title"
  | "anchor"
  | "desk-text"
  | "board-image";

export interface GlobalSearchResult {
  key: string;
  href: string;
  sectionId: string;
  sectionTitle: string;
  folderTitle?: string;
  kind: GlobalSearchMatchKind;
  where: string;
  snippet: string;
  matchCount: number;
  anchorId?: string;
  textId?: string;
  mediaId?: string;
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

export function countMatches(haystack: string, needle: string): number {
  const n = needle.trim();
  if (!n || !haystack) return 0;
  const lowerHay = haystack.toLowerCase();
  const lowerNeedle = n.toLowerCase();
  let count = 0;
  let pos = 0;
  while (pos < lowerHay.length) {
    const idx = lowerHay.indexOf(lowerNeedle, pos);
    if (idx < 0) break;
    count++;
    pos = idx + lowerNeedle.length;
  }
  return count;
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
  return normalized.slice(start, end);
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
  "folder-title": "search.where.folderTitle",
  anchor: "search.where.anchor",
  "desk-text": "search.where.deskText",
  "board-image": "search.where.boardImage",
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
      matchCount: countMatches(section.title, query),
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
      matchCount: countMatches(section.description, query),
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
      matchCount: countMatches(bodyText, query),
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
        matchCount: countMatches(text, query),
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
      matchCount: countMatches(content, query),
      textId: text.id,
    });
  }
}

function searchBoardImages(
  doc: GddDocument,
  query: string,
  results: GlobalSearchResult[],
  lang: AppLanguage
) {
  for (const asset of Object.values(doc.boardImages ?? {})) {
    const displayName = displayBoardImageAssetName(asset);
    if (!matches(displayName, query)) continue;

    const desks = listBoardImageAssetDesks(doc, asset.id);
    if (desks.length === 0) {
      pushResult(results, {
        key: `board-image:${asset.id}:unused`,
        href: "",
        sectionId: "",
        sectionTitle: displayName,
        kind: "board-image",
        where: translate(lang, SEARCH_WHERE_KEYS["board-image"]),
        snippet: snippetAround(displayName, query),
        matchCount: countMatches(displayName, query),
      });
      continue;
    }

    for (const desk of desks) {
      pushResult(results, {
        key: `board-image:${asset.id}:${desk.sectionId}`,
        href: buildMediaHref(desk.sectionId, desk.itemId),
        sectionId: desk.sectionId,
        sectionTitle: desk.sectionTitle,
        kind: "board-image",
        where: translate(lang, SEARCH_WHERE_KEYS["board-image"]),
        snippet: snippetAround(displayName, query),
        matchCount: countMatches(displayName, query),
        mediaId: desk.itemId,
      });
    }
  }
}

function searchFolders(
  doc: GddDocument,
  query: string,
  results: GlobalSearchResult[],
  lang: AppLanguage
) {
  for (const folder of doc.folders ?? []) {
    if (!folder.title || !matches(folder.title, query)) continue;
    const firstSection = doc.sections
      .filter((section) => section.folderId === folder.id)
      .sort((a, b) => a.order - b.order)[0];
    pushResult(results, {
      key: `folder:${folder.id}`,
      href: firstSection ? buildSectionHref(firstSection.id) : "",
      sectionId: firstSection?.id ?? "",
      sectionTitle: firstSection?.title ?? folder.title,
      folderTitle: folder.title,
      kind: "folder-title",
      where: translate(lang, SEARCH_WHERE_KEYS["folder-title"]),
      snippet: snippetAround(folder.title, query),
      matchCount: countMatches(folder.title, query),
    });
  }
}

export interface SearchFocusTarget {
  sectionId: string;
  query: string;
  kind: GlobalSearchMatchKind;
  matchIndex: number;
  matchCount: number;
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
  searchBoardImages(doc, q, results, lang);
  searchFolders(doc, q, results, lang);
  const sorted = [...doc.sections].sort((a, b) => a.order - b.order);
  for (const section of sorted) {
    searchSection(section, q, results, lang);
  }
  return results;
}
