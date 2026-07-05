import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
  buildShiftGroupSelection,
  getOpenSectionGroupSelectMode,
  includesOpenSectionOnGroupSelectStart,
  withOpenSectionOnGroupSelectStart
} from "@/domain/sidebar/sidebarSettings";
import type { ContextMenuAction } from "@/features/links/LinkContext";
import { visibleSectionIdsInOrder } from "@/features/sidebar/lib/sidebarOrder";
import { useLocale } from "@/shared/context/LocaleContext";
import { useShortcuts } from "@/shared/context/ShortcutsContext";
import type { GddSection, GddSectionFolder } from "@/shared/types";

interface UseSidebarGroupSelectionOptions {
  hidden: boolean;
  folders: GddSectionFolder[];
  sections: GddSection[];
  activeId: string;
  onRequestRemoveGroup: (count: number) => void;
}

export function useSidebarGroupSelection({
  hidden,
  folders,
  sections,
  activeId,
  onRequestRemoveGroup
}: UseSidebarGroupSelectionOptions) {
  const { t } = useLocale();
  const { matches: shortcutMatches } = useShortcuts();
  const selectionAnchorRef = useRef<string | null>(null);
  const [selectedGroupIds, setSelectedGroupIds] = useState<string[]>([]);

  const selectedGroupSet = useMemo(() => new Set(selectedGroupIds), [selectedGroupIds]);
  const hasGroupSelection = selectedGroupIds.length > 0;
  const visibleSectionIds = useMemo(() => visibleSectionIdsInOrder({ folders, sections }), [folders, sections]);

  const clearGroupSelection = useCallback(() => {
    setSelectedGroupIds([]);
  }, []);

  const toggleGroupSection = useCallback(
    (sectionId: string) => {
      setSelectedGroupIds((current) => {
        if (current.length === 0) {
          const mode = getOpenSectionGroupSelectMode();
          return withOpenSectionOnGroupSelectStart(
            [sectionId],
            activeId,
            includesOpenSectionOnGroupSelectStart(mode, "ctrl")
          );
        }
        return current.includes(sectionId) ? current.filter((id) => id !== sectionId) : [...current, sectionId];
      });
    },
    [activeId]
  );

  const selectSectionRange = useCallback(
    (toId: string, additive: boolean) => {
      const mode = getOpenSectionGroupSelectMode();
      const rangeIds = buildShiftGroupSelection(visibleSectionIds, toId, activeId, selectionAnchorRef.current, mode);
      if (rangeIds.length === 0) return;
      const includeOpenOnShift = includesOpenSectionOnGroupSelectStart(mode, "shift");
      setSelectedGroupIds((current) => {
        const next = additive ? [...new Set([...current, ...rangeIds])] : rangeIds;
        return current.length === 0 ? withOpenSectionOnGroupSelectStart(next, activeId, includeOpenOnShift) : next;
      });
    },
    [activeId, visibleSectionIds]
  );

  useEffect(() => {
    setSelectedGroupIds((current) => current.filter((id) => sections.some((section) => section.id === id)));
  }, [sections]);

  useEffect(() => {
    if (hidden || !hasGroupSelection) return;

    const onKey = (e: globalThis.KeyboardEvent) => {
      if (!shortcutMatches("sidebar.exitGroupSelect", e)) return;
      e.preventDefault();
      clearGroupSelection();
    };

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [clearGroupSelection, hasGroupSelection, hidden, shortcutMatches]);

  const buildGroupActions = useCallback((): ContextMenuAction[] => {
    if (!hasGroupSelection) return [];

    return [
      {
        id: "remove-group-sections",
        label: t("sidebar.deleteGroupSections"),
        onClick: () => onRequestRemoveGroup(selectedGroupIds.length)
      },
      {
        id: "exit-group-select",
        label: t("sidebar.exitGroupSelect"),
        onClick: clearGroupSelection
      }
    ];
  }, [clearGroupSelection, hasGroupSelection, onRequestRemoveGroup, selectedGroupIds.length, t]);

  return {
    selectedGroupIds,
    selectedGroupSet,
    hasGroupSelection,
    selectionAnchorRef,
    clearGroupSelection,
    toggleGroupSection,
    selectSectionRange,
    buildGroupActions
  };
}
