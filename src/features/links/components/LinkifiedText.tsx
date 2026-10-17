import { extractLinksFromText, splitTextWithLinks } from "@/features/links/lib/linkifyText";
import { isExternalHref, suggestLinkText } from "@/features/links/lib/links";
import { useLinkContext } from "@/features/links/LinkContext";

interface LinkifiedTextProps {
  text: string;
  className?: string;
}

export function LinkifiedText({ text, className }: LinkifiedTextProps) {
  const { doc, navigateToHref } = useLinkContext();
  const segments = splitTextWithLinks(text);

  return (
    <span className={className}>
      {segments.map((segment, index) => {
        if (segment.type === "text") {
          return <span key={`t-${index}`}>{segment.value}</span>;
        }

        const label = suggestLinkText(doc, segment.href);
        const external = isExternalHref(segment.href);

        return (
          <a
            key={`l-${index}`}
            href={segment.href}
            className={external ? "gdd-link gdd-link--external" : "gdd-link"}
            target={external ? "_blank" : undefined}
            rel={external ? "noopener noreferrer" : undefined}
            title={segment.href}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              navigateToHref(segment.href);
            }}
          >
            {label}
          </a>
        );
      })}
    </span>
  );
}

interface DescriptionLinksProps {
  text: string;
  title?: string;
}

/** Compact list of unique links found in plain text (e.g. graph node menu). */
export function DescriptionLinks({ text, title }: DescriptionLinksProps) {
  const { doc, navigateToHref } = useLinkContext();
  const hrefs = extractLinksFromText(text);
  if (hrefs.length === 0) return null;

  return (
    <div className="graph-menu__desc-links">
      {title ? <p className="graph-menu__links-title">{title}</p> : null}
      {hrefs.map((href) => {
        const external = isExternalHref(href);
        return (
          <button
            key={href}
            type="button"
            className="graph-menu__desc-link"
            title={href}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              navigateToHref(href);
            }}
          >
            <span className={external ? "gdd-link gdd-link--external" : "gdd-link"}>{suggestLinkText(doc, href)}</span>
          </button>
        );
      })}
    </div>
  );
}
