import { SidebarFolderBlock } from "@/features/sidebar/components/SidebarFolderBlock";
import { SidebarSectionRow } from "@/features/sidebar/components/SidebarSectionRow";
import { useSidebarInteraction } from "@/features/sidebar/hooks/useSidebarInteraction";
import { childItems } from "@/features/sidebar/lib/sidebarOrder";
import { useLocale } from "@/shared/context/LocaleContext";

export function SidebarTree() {
  const { t } = useLocale();
  const {
    docLike,
    hasGroupSelection,
    buildGroupActions,
    openContextMenu,
    draggingGroup,
    groupDropTarget,
    setDropTarget,
    setGroupDropTarget,
    handleGroupDropFromEvent
  } = useSidebarInteraction();

  return (
    <nav
      className={[
        "section-list",
        draggingGroup && groupDropTarget?.kind === "root" ? "section-list--group-drop-target" : ""
      ]
        .filter(Boolean)
        .join(" ")}
      aria-label={t("sidebar.sectionsAria")}
      onDragOver={(e) => {
        if (!draggingGroup) return;
        if ((e.target as HTMLElement).closest(".sidebar-row")) return;
        e.preventDefault();
        e.dataTransfer.dropEffect = "move";
        setDropTarget(null);
        setGroupDropTarget({ kind: "root" });
      }}
      onDrop={(e) => {
        if (!draggingGroup) return;
        if ((e.target as HTMLElement).closest(".sidebar-row")) return;
        handleGroupDropFromEvent(e, { kind: "root" });
      }}
      onDragLeave={(e) => {
        if (!draggingGroup) return;
        if (e.currentTarget.contains(e.relatedTarget as Node | null)) return;
        setGroupDropTarget((current) => (current?.kind === "root" ? null : current));
      }}
      onContextMenu={(e) => {
        if (!hasGroupSelection) return;
        if ((e.target as HTMLElement).closest(".sidebar-row")) return;
        e.preventDefault();
        openContextMenu({
          x: e.clientX,
          y: e.clientY,
          actions: buildGroupActions()
        });
      }}
    >
      {childItems(docLike, null).map((entry) =>
        entry.kind === "folder" ? (
          <SidebarFolderBlock key={entry.item.id} folder={entry.item} depth={0} />
        ) : (
          <SidebarSectionRow key={entry.item.id} section={entry.item} depth={0} />
        )
      )}
    </nav>
  );
}
