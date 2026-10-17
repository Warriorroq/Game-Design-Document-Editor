import { parseGddHref } from "@/features/links/lib/links";

export type TextSegment = { type: "text"; value: string } | { type: "link"; href: string; value: string };

/** Raw tokens that may be navigable GDD or http(s) links. */
const LINK_TOKEN_RE = /(gdd:(?:section|anchor|media|text)\/[^\s<>"']+|https?:\/\/[^\s<>"']+)/gi;

function trimTrailingPunctuation(token: string): { href: string; trailing: string } {
  let href = token;
  let trailing = "";
  while (href.length > 0 && /[),.!?;:\]}'"]$/.test(href)) {
    trailing = href.slice(-1) + trailing;
    href = href.slice(0, -1);
  }
  return { href, trailing };
}

export function splitTextWithLinks(text: string): TextSegment[] {
  if (!text) return [];

  const segments: TextSegment[] = [];
  const re = new RegExp(LINK_TOKEN_RE.source, LINK_TOKEN_RE.flags);
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = re.exec(text)) !== null) {
    if (match.index > lastIndex) {
      segments.push({ type: "text", value: text.slice(lastIndex, match.index) });
    }

    const raw = match[0];
    const { href, trailing } = trimTrailingPunctuation(raw);
    if (parseGddHref(href)) {
      segments.push({ type: "link", href, value: href });
      if (trailing) segments.push({ type: "text", value: trailing });
    } else {
      segments.push({ type: "text", value: raw });
    }

    lastIndex = match.index + raw.length;
  }

  if (lastIndex < text.length) {
    segments.push({ type: "text", value: text.slice(lastIndex) });
  }

  return segments.length > 0 ? segments : [{ type: "text", value: text }];
}

export function descriptionHasLinks(text: string | undefined | null): boolean {
  if (!text) return false;
  return splitTextWithLinks(text).some((s) => s.type === "link");
}

export function extractLinksFromText(text: string | undefined | null): string[] {
  if (!text) return [];
  const seen = new Set<string>();
  const hrefs: string[] = [];
  for (const segment of splitTextWithLinks(text)) {
    if (segment.type !== "link" || seen.has(segment.href)) continue;
    seen.add(segment.href);
    hrefs.push(segment.href);
  }
  return hrefs;
}
