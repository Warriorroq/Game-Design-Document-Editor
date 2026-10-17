import { isGraphSection } from "@/domain/graph/graph";
import { isSpace3DSection } from "@/domain/space3d/space3d";
import type { GddSection } from "@/shared/types";

export function sectionHasContent(section: GddSection): boolean {
  if (isSpace3DSection(section)) {
    return (section.space3d?.objects.length ?? 0) > 0;
  }
  if (isGraphSection(section)) {
    return (section.graph?.nodes.length ?? 0) > 0;
  }
  return section.content.trim().length > 40 || section.board.length > 0;
}
