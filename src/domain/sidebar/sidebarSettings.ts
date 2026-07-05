import { sectionIdsInRange } from "@/domain/sidebar/sidebarOrder";

const STORAGE_KEY = "gdd-editor-sidebar-open-section-group-select";

export const OPEN_SECTION_GROUP_SELECT_MODES = ["none", "ctrl", "shift", "both"] as const;
export type OpenSectionGroupSelectMode = (typeof OPEN_SECTION_GROUP_SELECT_MODES)[number];
export type GroupSelectGesture = "ctrl" | "shift";

const DEFAULT_MODE: OpenSectionGroupSelectMode = "both";

const includesOpenSection: Record<OpenSectionGroupSelectMode, Record<GroupSelectGesture, boolean>> = {
  none: { ctrl: false, shift: false },
  ctrl: { ctrl: true, shift: false },
  shift: { ctrl: false, shift: true },
  both: { ctrl: true, shift: true }
};

function isOpenSectionGroupSelectMode(value: string): value is OpenSectionGroupSelectMode {
  return (OPEN_SECTION_GROUP_SELECT_MODES as readonly string[]).includes(value);
}

function loadOpenSectionGroupSelectMode(): OpenSectionGroupSelectMode {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored && isOpenSectionGroupSelectMode(stored)) return stored;
  } catch {
    /* ignore */
  }
  return DEFAULT_MODE;
}

let openSectionGroupSelectMode = loadOpenSectionGroupSelectMode();

export function getOpenSectionGroupSelectMode(): OpenSectionGroupSelectMode {
  return openSectionGroupSelectMode;
}

export function parseOpenSectionGroupSelectMode(value: string): OpenSectionGroupSelectMode {
  return isOpenSectionGroupSelectMode(value) ? value : DEFAULT_MODE;
}

export function saveOpenSectionGroupSelectMode(mode: OpenSectionGroupSelectMode): void {
  openSectionGroupSelectMode = mode;
  localStorage.setItem(STORAGE_KEY, mode);
}

export function includesOpenSectionOnGroupSelectStart(
  mode: OpenSectionGroupSelectMode,
  gesture: GroupSelectGesture
): boolean {
  return includesOpenSection[mode][gesture];
}

export function buildShiftGroupSelection(
  visibleSectionIds: string[],
  toId: string,
  activeId: string,
  selectionAnchorId: string | null,
  mode: OpenSectionGroupSelectMode
): string[] {
  const includeOpenOnShift = includesOpenSectionOnGroupSelectStart(mode, "shift");
  const anchor = selectionAnchorId ?? activeId;
  let rangeIds = sectionIdsInRange(visibleSectionIds, anchor, toId);

  if (!includeOpenOnShift) {
    rangeIds = rangeIds.filter((id) => id !== activeId);
    if (rangeIds.length === 0) rangeIds = [toId];
  }

  return rangeIds;
}

export function withOpenSectionOnGroupSelectStart(ids: string[], activeId: string, includeActive: boolean): string[] {
  if (!includeActive || !activeId || ids.includes(activeId)) return ids;
  return [activeId, ...ids];
}
