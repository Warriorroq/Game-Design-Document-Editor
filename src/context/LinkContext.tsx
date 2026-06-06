import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  linkTargetFromGddLink,
  parseGddHref,
  type LinkTarget,
} from "../lib/links";
import type { GddDocument } from "../types";

export interface PasteLinkRequest {
  href: string;
  suggestedText: string;
  insert: (href: string, text: string) => void;
}

export interface ContextMenuAction {
  id: string;
  label: string;
  onClick: () => void;
  disabled?: boolean;
}

export interface ContextMenuRequest {
  x: number;
  y: number;
  copyHref?: string;
  pasteLink?: PasteLinkRequest;
  actions?: ContextMenuAction[];
}

interface LinkContextValue {
  doc: GddDocument;
  linkTarget: LinkTarget | null;
  clearLinkTarget: () => void;
  navigateToHref: (href: string) => boolean;
  copyHref: (href: string) => Promise<void>;
  contextMenu: ContextMenuRequest | null;
  openContextMenu: (menu: ContextMenuRequest) => void;
  closeContextMenu: () => void;
  pasteDialog: PasteLinkRequest | null;
  openPasteDialog: (req: PasteLinkRequest) => void;
  closePasteDialog: () => void;
  setActiveSectionId: (id: string) => void;
}

const LinkContext = createContext<LinkContextValue | null>(null);

export function LinkProvider({
  doc,
  setActiveSectionId,
  children,
}: {
  doc: GddDocument;
  setActiveSectionId: (id: string) => void;
  children: ReactNode;
}) {
  const [linkTarget, setLinkTarget] = useState<LinkTarget | null>(null);
  const [contextMenu, setContextMenu] = useState<ContextMenuRequest | null>(
    null
  );
  const [pasteDialog, setPasteDialog] = useState<PasteLinkRequest | null>(
    null
  );

  const clearLinkTarget = useCallback(() => setLinkTarget(null), []);

  const navigateToHref = useCallback(
    (href: string): boolean => {
      const link = parseGddHref(href);
      if (!link) return false;

      if (link.type === "external") {
        window.open(link.url, "_blank", "noopener,noreferrer");
        return true;
      }

      const target = linkTargetFromGddLink(link);
      if (!target) return false;

      setActiveSectionId(target.sectionId);
      setLinkTarget(target);
      return true;
    },
    [setActiveSectionId]
  );

  const copyHref = useCallback(async (href: string) => {
    await navigator.clipboard.writeText(href);
  }, []);

  const openContextMenu = useCallback((menu: ContextMenuRequest) => {
    setContextMenu(menu);
  }, []);

  const closeContextMenu = useCallback(() => setContextMenu(null), []);

  const openPasteDialog = useCallback((req: PasteLinkRequest) => {
    setPasteDialog(req);
    setContextMenu(null);
  }, []);

  const closePasteDialog = useCallback(() => setPasteDialog(null), []);

  const value = useMemo(
    () => ({
      doc,
      linkTarget,
      clearLinkTarget,
      navigateToHref,
      copyHref,
      contextMenu,
      openContextMenu,
      closeContextMenu,
      pasteDialog,
      openPasteDialog,
      closePasteDialog,
      setActiveSectionId,
    }),
    [
      doc,
      linkTarget,
      clearLinkTarget,
      navigateToHref,
      copyHref,
      contextMenu,
      openContextMenu,
      closeContextMenu,
      pasteDialog,
      openPasteDialog,
      closePasteDialog,
      setActiveSectionId,
    ]
  );

  return (
    <LinkContext.Provider value={value}>{children}</LinkContext.Provider>
  );
}

export function useLinkContext(): LinkContextValue {
  const ctx = useContext(LinkContext);
  if (!ctx) {
    throw new Error("useLinkContext must be used within LinkProvider");
  }
  return ctx;
}
