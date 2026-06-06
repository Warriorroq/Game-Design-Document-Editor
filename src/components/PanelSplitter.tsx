interface PanelSplitterProps {
  edge: "start" | "end";
  hidden: boolean;
  dragging: boolean;
  onPointerDown: (e: React.PointerEvent) => void;
  onDoubleClick: () => void;
}

export function PanelSplitter({
  edge,
  hidden,
  dragging,
  onPointerDown,
  onDoubleClick,
}: PanelSplitterProps) {
  const isStart = edge === "start";
  const label = isStart
    ? "Resize document panel. Double-click to hide or show."
    : "Resize reference board. Double-click to hide or show.";

  return (
    <div
      className={`panel-splitter panel-splitter--${edge} ${hidden ? "panel-splitter--collapsed" : ""} ${dragging ? "dragging" : ""}`}
      role="separator"
      aria-orientation="vertical"
      aria-label={label}
      onPointerDown={onPointerDown}
      onDoubleClick={onDoubleClick}
      title={
        isStart
          ? "Drag to resize · double-click to hide document"
          : "Drag to resize · double-click to hide board"
      }
    />
  );
}
