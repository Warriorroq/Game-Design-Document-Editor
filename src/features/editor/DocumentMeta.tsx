import { useLocale } from "@/shared/context/LocaleContext";
import type { GddDocument } from "@/shared/types";

interface DocumentMetaProps {
  doc: GddDocument;
  onChange: (patch: Partial<GddDocument>) => void;
}

export function DocumentMeta({ doc, onChange }: DocumentMetaProps) {
  const { t } = useLocale();

  return (
    <section className="doc-meta">
      <input
        className="doc-title"
        value={doc.title}
        onChange={(e) => onChange({ title: e.target.value })}
        placeholder={t("doc.titlePlaceholder")}
        aria-label={t("doc.titleAria")}
      />
      <input
        className="doc-subtitle"
        value={doc.subtitle}
        onChange={(e) => onChange({ subtitle: e.target.value })}
        placeholder={t("doc.subtitlePlaceholder")}
        aria-label={t("doc.subtitleAria")}
      />
    </section>
  );
}
