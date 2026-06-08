import type { GddSection } from "../types";

export type SectionDropPosition = "before" | "after";

export function reorderSections(
  sections: GddSection[],
  activeId: string,
  overId: string,
  position: SectionDropPosition
): GddSection[] {
  const sorted = [...sections].sort((a, b) => a.order - b.order);
  const fromIndex = sorted.findIndex((s) => s.id === activeId);
  let toIndex = sorted.findIndex((s) => s.id === overId);
  if (fromIndex < 0 || toIndex < 0 || fromIndex === toIndex) {
    return sections;
  }

  if (position === "after") toIndex += 1;
  if (fromIndex < toIndex) toIndex -= 1;

  const reordered = [...sorted];
  const [moved] = reordered.splice(fromIndex, 1);
  reordered.splice(toIndex, 0, moved!);
  return reordered.map((s, i) => ({ ...s, order: i }));
}
