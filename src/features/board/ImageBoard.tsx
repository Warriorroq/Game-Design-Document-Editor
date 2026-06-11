import { BoardShapesLayer } from "./components/BoardShapesLayer";
import { BoardStrokesLayer } from "./components/BoardStrokesLayer";
import { BoardToolbar } from "./components/BoardToolbar";
import { BoardTextsLayer } from "./components/BoardTextsLayer";
import { DeskContextMenu } from "./components/DeskContextMenu";
import { buildMediaHref, buildTextHref } from "@/features/links/lib/links";
import { selectionCount } from "@/domain/board/deskGroups";
import { boardItemTransform } from "@/domain/board/boardItemTransform";
import { useImageBoard, type ImageBoardProps } from "@/application/board/useImageBoard";
import "./Board.css";

export type { ImageBoardProps };

export function ImageBoard(props: ImageBoardProps) {
  const {
    t,
    surfaceRef,
    pasteHint,
    setPasteHint,
    isDrawing,
    zoomPercent,
    items,
    shapes,
    strokes,
    texts,
    canGroup,
    groupSelection,
    canUngroup,
    ungroupSelection,
    selectionSize,
    deleteSelection,
    onSurfacePointerDownCapture,
    onSurfacePointerDown,
    onSurfacePointerMove,
    onSurfacePointerUp,
    handleSurfaceContextMenu,
    handleDrop,
    viewport,
    canvasWidth,
    canvasHeight,
    boxShapes,
    lineShapes,
    boxDrawPreview,
    lineDrawPreview,
    selectedShapeIds,
    selectedItemSet,
    singleImageSelection,
    highlightMediaId,
    sectionId,
    selection,
    handleItemPointerDown,
    startItemRotate,
    onRemove,
    setSelection,
    resolveItemSrc,
    openDeskObjectMenu,
    handleShapePointerDown,
    startEndpointDrag,
    selectedTextIds,
    editingTextId,
    highlightTextId,
    handleTextPointerDown,
    commitTextContent,
    setEditingTextId,
    penPreview,
    selectedStrokeIds,
    handleStrokePointerDown,
    marqueePreview,
    deskMenu,
    setDeskMenu,
    canCopy,
    canPasteDesk,
    selectionLockSummary,
    canBringForward,
    canSendBackward,
    canFlipImages,
    addTextAtCursor,
    copyDesk,
    pasteDesk,
    lockSelection,
    unlockSelection,
    bringSelectionForward,
    sendSelectionBackward,
    flipSelectionHorizontal,
    flipSelectionVertical,
    penMode,
    setPenMode,
    penColor,
    penWidth,
    setPenColor,
    setPenWidth,
    applyTextColor,
    applyTextStyle,
    drawPreview,
    pickDeskTool,
  } = useImageBoard(props);

  return (
    <div className="board-panel board-panel--embedded">
      <header className="board-header">
        <div>
          <h2 className="board-title">{t("desk.title")}</h2>
        </div>
        <div className="board-meta">
          <span className="board-zoom">{zoomPercent}%</span>
          <span>{t("desk.images", { count: items.length })}</span>
          <span>{t("desk.shapes", { count: shapes.length })}</span>
          <span>{t("desk.labels", { count: texts.length })}</span>
          {canGroup && (
            <button
              type="button"
              className="btn btn-ghost board-group-action"
              onClick={groupSelection}
            >
              {t("desk.group")}
            </button>
          )}
          {canUngroup && (
            <button
              type="button"
              className="btn btn-ghost board-group-action"
              onClick={ungroupSelection}
            >
              {t("desk.ungroup")}
            </button>
          )}
          {selectionSize > 0 && (
            <button
              type="button"
              className="btn btn-ghost board-delete"
              onClick={deleteSelection}
            >
              {t("desk.removeSelected")}
            </button>
          )}
        </div>
      </header>

      <div
        ref={surfaceRef}
        className={`board-surface ${pasteHint ? "paste-ready" : ""} ${isDrawing ? "board-surface--draw" : ""}`}
        tabIndex={0}
        onFocus={() => setPasteHint(true)}
        onBlur={() => setPasteHint(false)}
        onPointerDownCapture={onSurfacePointerDownCapture}
        onPointerDown={onSurfacePointerDown}
        onPointerMove={onSurfacePointerMove}
        onPointerUp={onSurfacePointerUp}
        onPointerLeave={onSurfacePointerUp}
        onContextMenu={handleSurfaceContextMenu}
        onDragOver={(e) => e.preventDefault()}
        onDrop={handleDrop}
      >
        <div
          className="board-viewport"
          style={{
            transform: `translate(${viewport.panX}px, ${viewport.panY}px) scale(${viewport.scale})`,
          }}
        >
          <div
            className="board-canvas"
            style={{
              width: canvasWidth,
              height: canvasHeight,
            }}
            onContextMenu={handleSurfaceContextMenu}
          >
            {items.length === 0 &&
              shapes.length === 0 &&
              strokes.length === 0 &&
              texts.length === 0 &&
              !drawPreview &&
              !penPreview && (
              <div className="board-empty">
                <p>{t("desk.empty")}</p>
              </div>
            )}
            <BoardShapesLayer
              canvasWidth={canvasWidth}
              canvasHeight={canvasHeight}
              items={items}
              shapes={boxShapes}
              preview={boxDrawPreview}
              selectedShapeIds={selectedShapeIds}
              className="board-boxes-layer"
              onShapePointerDown={handleShapePointerDown}
              onEndpointPointerDown={startEndpointDrag}
            />
            {items.map((item) => (
              <div
                key={item.id}
                className={`board-item ${item.locked ? "locked" : ""} ${selectedItemSet.has(item.id) ? "selected" : ""} ${singleImageSelection === item.id ? "board-item--image-tools" : ""} ${highlightMediaId === item.id ? "board-item--link-target" : ""}`}
                style={{
                  left: item.x,
                  top: item.y,
                  width: item.width,
                  height: item.height,
                }}
                onContextMenu={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  const next =
                    selection.itemIds.includes(item.id) && selectionCount(selection) > 0
                      ? selection
                      : { itemIds: [item.id], shapeIds: [], textIds: [], strokeIds: [] };
                  openDeskObjectMenu(e.clientX, e.clientY, next, buildMediaHref(sectionId, item.id));
                }}
              >
                <div
                  className="board-item-drag"
                  onPointerDown={(e) => handleItemPointerDown(e, item, "move")}
                />
                <div
                  className="board-item-body"
                  style={{ transform: boardItemTransform(item) }}
                >
                  <div className="board-item-frame" aria-hidden />
                  <div className="board-item-visual">
                    <img src={resolveItemSrc(item)} alt="" draggable={false} />
                  </div>
                  <div className="board-item-handles">
                    <button
                      type="button"
                      className="board-item-remove"
                      disabled={item.locked}
                      onClick={(e) => {
                        e.stopPropagation();
                        if (item.locked) return;
                        onRemove(item.id);
                        setSelection((prev) => ({
                          itemIds: prev.itemIds.filter((id) => id !== item.id),
                          shapeIds: prev.shapeIds,
                          textIds: prev.textIds,
                          strokeIds: prev.strokeIds,
                        }));
                      }}
                      aria-label="Remove image"
                    >
                      ×
                    </button>
                    <div
                      className="board-item-resize"
                      onPointerDown={(e) => handleItemPointerDown(e, item, "resize")}
                    />
                    {singleImageSelection === item.id && !item.locked && (
                      <div
                        className="board-item-rotate"
                        title={t("desk.rotate")}
                        aria-label={t("desk.rotate")}
                        onPointerDown={(e) => startItemRotate(e, item)}
                      />
                    )}
                  </div>
                </div>
              </div>
            ))}
            <BoardShapesLayer
              canvasWidth={canvasWidth}
              canvasHeight={canvasHeight}
              items={items}
              shapes={lineShapes}
              preview={lineDrawPreview}
              selectedShapeIds={selectedShapeIds}
              onShapePointerDown={handleShapePointerDown}
              onEndpointPointerDown={startEndpointDrag}
            />
            <BoardTextsLayer
              texts={texts}
              selectedTextIds={selectedTextIds}
              editingTextId={editingTextId}
              highlightTextId={highlightTextId}
              onTextPointerDown={handleTextPointerDown}
              onTextContextMenu={(e, text) => {
                const next =
                  selection.textIds.includes(text.id) && selectionCount(selection) > 0
                    ? selection
                    : { itemIds: [], shapeIds: [], textIds: [text.id], strokeIds: [] };
                openDeskObjectMenu(e.clientX, e.clientY, next, buildTextHref(sectionId, text.id));
              }}
              onTextDoubleClick={(textId) => {
                const text = texts.find((t) => t.id === textId);
                if (text?.locked) return;
                setSelection({ itemIds: [], shapeIds: [], textIds: [textId], strokeIds: [] });
                setEditingTextId(textId);
              }}
              onTextCommit={commitTextContent}
              onEditEnd={() => setEditingTextId(null)}
            />
            <BoardStrokesLayer
              canvasWidth={canvasWidth}
              canvasHeight={canvasHeight}
              strokes={strokes}
              preview={penPreview}
              selectedStrokeIds={selectedStrokeIds}
              onStrokePointerDown={handleStrokePointerDown}
            />
            {marqueePreview && (
              <div
                className="board-marquee"
                style={{
                  left: Math.min(marqueePreview.start.x, marqueePreview.end.x),
                  top: Math.min(marqueePreview.start.y, marqueePreview.end.y),
                  width: Math.abs(marqueePreview.end.x - marqueePreview.start.x),
                  height: Math.abs(marqueePreview.end.y - marqueePreview.start.y),
                }}
              />
            )}
          </div>
        </div>
      </div>

      {deskMenu && (
        <DeskContextMenu
          x={deskMenu.x}
          y={deskMenu.y}
          canGroup={canGroup}
          canUngroup={canUngroup}
          canCopy={canCopy}
          canPaste={canPasteDesk}
          canLock={selectionSize > 0 && selectionLockSummary.unlocked > 0}
          canUnlock={selectionSize > 0 && selectionLockSummary.locked > 0}
          canBringForward={canBringForward}
          canSendBackward={canSendBackward}
          canFlipHorizontal={canFlipImages}
          canFlipVertical={canFlipImages}
          onClose={() => setDeskMenu(null)}
          onPick={pickDeskTool}
          onAddText={() => {
            addTextAtCursor();
            setDeskMenu(null);
          }}
          onGroup={() => {
            groupSelection();
            setDeskMenu(null);
          }}
          onUngroup={() => {
            ungroupSelection();
            setDeskMenu(null);
          }}
          onCopy={() => {
            copyDesk();
            setDeskMenu(null);
          }}
          onPaste={() => {
            pasteDesk();
            setDeskMenu(null);
          }}
          onLock={() => {
            lockSelection();
            setDeskMenu(null);
          }}
          onUnlock={() => {
            unlockSelection();
            setDeskMenu(null);
          }}
          onBringForward={() => {
            bringSelectionForward();
            setDeskMenu(null);
          }}
          onSendBackward={() => {
            sendSelectionBackward();
            setDeskMenu(null);
          }}
          onFlipHorizontal={() => {
            flipSelectionHorizontal();
            setDeskMenu(null);
          }}
          onFlipVertical={() => {
            flipSelectionVertical();
            setDeskMenu(null);
          }}
        />
      )}

      <BoardToolbar
        penMode={penMode}
        onPenModeChange={setPenMode}
        penColor={penColor}
        penWidth={penWidth}
        onPenColorChange={setPenColor}
        onPenWidthChange={(w) => setPenWidth(w)}
        selectedTextIds={selection.textIds}
        texts={texts}
        onTextColorChange={applyTextColor}
        onTextStyleChange={applyTextStyle}
      />
    </div>
  );
}
