import type { BoardItem, BoardText, GddDocument, GddSection } from "@/shared/types";

export type GddLink =
  | { type: "section"; sectionId: string }
  | { type: "anchor"; sectionId: string; anchorId: string }
  | { type: "media"; sectionId: string; itemId: string }
  | { type: "text"; sectionId: string; textId: string }
  | { type: "external"; url: string };

export interface LinkTarget {
  sectionId: string;
  anchorId?: string;
  mediaId?: string;
  textId?: string;
}

const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function buildSectionHref(sectionId: string): string {
  return `gdd:section/${sectionId}`;
}

export function buildAnchorHref(sectionId: string, anchorId: string): string {
  return `gdd:anchor/${sectionId}/${anchorId}`;
}

export function buildMediaHref(sectionId: string, itemId: string): string {
  return `gdd:media/${sectionId}/${itemId}`;
}

export function buildTextHref(sectionId: string, textId: string): string {
  return `gdd:text/${sectionId}/${textId}`;
}

export function isNavigableHref(href: string): boolean {
  return parseGddHref(href) !== null;
}

export function isExternalHref(href: string): boolean {
  return /^https?:\/\//i.test(href.trim());
}

export function parseGddHref(href: string): GddLink | null {
  const raw = href.trim();
  if (!raw) return null;

  if (isExternalHref(raw)) {
    return { type: "external", url: raw };
  }

  const section = raw.match(/^gdd:section\/([^#?/]+)$/i);
  if (section && UUID.test(section[1])) {
    return { type: "section", sectionId: section[1] };
  }

  const anchor = raw.match(/^gdd:anchor\/([^/]+)\/([^#?/]+)$/i);
  if (anchor && UUID.test(anchor[1])) {
    return { type: "anchor", sectionId: anchor[1], anchorId: anchor[2] };
  }

  const media = raw.match(/^gdd:media\/([^/]+)\/([^#?/]+)$/i);
  if (media && UUID.test(media[1]) && UUID.test(media[2])) {
    return { type: "media", sectionId: media[1], itemId: media[2] };
  }

  const text = raw.match(/^gdd:text\/([^/]+)\/([^#?/]+)$/i);
  if (text && UUID.test(text[1]) && UUID.test(text[2])) {
    return { type: "text", sectionId: text[1], textId: text[2] };
  }

  return null;
}

export function findSection(
  doc: GddDocument,
  sectionId: string
): GddSection | undefined {
  return doc.sections.find((s) => s.id === sectionId);
}

export function findBoardItem(
  doc: GddDocument,
  sectionId: string,
  itemId: string
): BoardItem | undefined {
  return findSection(doc, sectionId)?.board.find((b) => b.id === itemId);
}

export function findBoardText(
  doc: GddDocument,
  sectionId: string,
  textId: string
): BoardText | undefined {
  return findSection(doc, sectionId)?.texts.find((t) => t.id === textId);
}

export function suggestLinkText(doc: GddDocument, href: string): string {
  const link = parseGddHref(href);
  if (!link) return href;

  if (link.type === "external") {
    try {
      return new URL(link.url).hostname;
    } catch {
      return link.url;
    }
  }

  const section = findSection(doc, link.sectionId);
  if (!section) return "Missing section";

  if (link.type === "section") {
    return section.title || "Section";
  }

  if (link.type === "media") {
    const idx = section.board.findIndex((b) => b.id === link.itemId);
    return idx >= 0 ? `Image ${idx + 1} · ${section.title}` : `Image · ${section.title}`;
  }

  if (link.type === "text") {
    const label = section.texts.find((t) => t.id === link.textId)?.content.trim();
    if (label) {
      const short = label.replace(/\s+/g, " ").slice(0, 48);
      return short;
    }
    return `Text · ${section.title}`;
  }

  if (link.type === "anchor") {
    const html = section.content;
    if (html) {
      const docEl = new DOMParser().parseFromString(html, "text/html");
      const el = docEl.getElementById(link.anchorId);
      if (el) {
        const tag = el.tagName.toLowerCase();
        const text = (el.textContent ?? "").replace(/\s+/g, " ").trim();
        if (text) return text.slice(0, 80);
        if (tag.startsWith("h")) return `${tag.toUpperCase()} · ${section.title}`;
      }
    }
    return `Block · ${section.title}`;
  }

  return section.title;
}

export function linkTargetFromGddLink(link: GddLink): LinkTarget | null {
  if (link.type === "external") return null;
  return {
    sectionId: link.sectionId,
    anchorId: link.type === "anchor" ? link.anchorId : undefined,
    mediaId: link.type === "media" ? link.itemId : undefined,
    textId: link.type === "text" ? link.textId : undefined,
  };
}
