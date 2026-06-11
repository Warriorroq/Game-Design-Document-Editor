import type { ReactNode } from "react";
import { BoardSizeProvider } from "@/shared/context/BoardSizeContext";
import { LinkProvider } from "@/features/links/LinkContext";
import { LocaleProvider } from "@/shared/context/LocaleContext";
import { ShortcutsProvider } from "@/shared/context/ShortcutsContext";
import type { GddDocument } from "@/domain/types";

interface AppProvidersProps {
  doc: GddDocument;
  setActiveSectionId: (id: string) => void;
  children: ReactNode;
}

export function AppProviders({
  doc,
  setActiveSectionId,
  children,
}: AppProvidersProps) {
  return (
    <LocaleProvider>
      <BoardSizeProvider>
        <ShortcutsProvider>
          <LinkProvider doc={doc} setActiveSectionId={setActiveSectionId}>
            {children}
          </LinkProvider>
        </ShortcutsProvider>
      </BoardSizeProvider>
    </LocaleProvider>
  );
}
