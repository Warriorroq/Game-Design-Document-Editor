import type { ReactNode } from "react";

import type { GddDocument } from "@/domain/types";
import { LinkProvider } from "@/features/links/LinkContext";
import { BoardSizeProvider } from "@/shared/context/BoardSizeContext";
import { LocaleProvider } from "@/shared/context/LocaleContext";
import { ShortcutsProvider } from "@/shared/context/ShortcutsContext";

interface AppProvidersProps {
  doc: GddDocument;
  setActiveSectionId: (id: string) => void;
  children: ReactNode;
}

export function AppProviders({
  doc,
  setActiveSectionId,
  children
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
