import { useEffect, useRef } from "react";
import { useLocale } from "@/shared/context/LocaleContext";
import type { GlobalSearchResult } from "@/features/search/lib/globalSearch";

interface GlobalSearchProps {
  query: string;
  onChange: (query: string) => void;
  results: GlobalSearchResult[];
  onSelectResult: (result: GlobalSearchResult) => void;
}

function SnippetHighlight({
  snippet,
  query,
}: {
  snippet: string;
  query: string;
}) {
  const q = query.trim();
  if (!q) return <>{snippet}</>;

  const lower = snippet.toLowerCase();
  const idx = lower.indexOf(q.toLowerCase());
  if (idx < 0) return <>{snippet}</>;

  return (
    <>
      {snippet.slice(0, idx)}
      <mark className="global-search-mark">{snippet.slice(idx, idx + q.length)}</mark>
      {snippet.slice(idx + q.length)}
    </>
  );
}

export function GlobalSearch({
  query,
  onChange,
  results,
  onSelectResult,
}: GlobalSearchProps) {
  const { t } = useLocale();
  const rootRef = useRef<HTMLDivElement>(null);
  const searchActive = query.trim().length > 0;

  useEffect(() => {
    if (!searchActive) return;

    const onPointer = (e: PointerEvent) => {
      if (rootRef.current?.contains(e.target as Node)) return;
      onChange("");
    };

    window.addEventListener("pointerdown", onPointer, true);
    return () => window.removeEventListener("pointerdown", onPointer, true);
  }, [searchActive, onChange]);

  return (
    <div className="global-search" ref={rootRef}>
      <span className="global-search-icon" aria-hidden>
        ⌕
      </span>
      <input
        type="search"
        className="global-search-input"
        value={query}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            onChange("");
            (e.target as HTMLInputElement).blur();
          }
        }}
        placeholder={t("search.placeholder")}
        aria-label={t("search.aria")}
        aria-expanded={searchActive}
        aria-controls="global-search-results"
        autoComplete="off"
        spellCheck={false}
      />
      {query.length > 0 && (
        <button
          type="button"
          className="global-search-clear"
          onClick={() => onChange("")}
          aria-label={t("search.clear")}
          title={t("search.clear")}
        >
          ×
        </button>
      )}
      {searchActive && (
        <div
          id="global-search-results"
          className="global-search-dropdown"
          role="listbox"
          aria-label={t("search.resultsAria")}
        >
          {results.length === 0 ? (
            <p className="global-search-empty">{t("search.noMatches")}</p>
          ) : (
            results.map((result) => (
              <button
                key={result.key}
                type="button"
                role="option"
                className="global-search-item"
                onClick={() => onSelectResult(result)}
              >
                <span className="global-search-item-where">{result.where}</span>
                <span className="global-search-item-section">
                  {result.folderTitle &&
                  result.kind !== "folder-title" &&
                  result.sectionTitle
                    ? `${result.folderTitle} / ${result.sectionTitle}`
                    : result.folderTitle && result.kind === "folder-title"
                      ? result.folderTitle
                      : result.sectionTitle}
                </span>
                <span className="global-search-item-snippet">
                  <SnippetHighlight snippet={result.snippet} query={query} />
                </span>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
