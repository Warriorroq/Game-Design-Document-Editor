import { useEffect, useRef } from "react";
import { boardTextStyleProps } from "../lib/boardTextStyle";
import { resolveBoardTextColor } from "../lib/textColorUtils";
import type { BoardText } from "../types";

interface BoardTextsLayerProps {
  texts: BoardText[];
  selectedTextIds: Set<string>;
  editingTextId: string | null;
  highlightTextId?: string | null;
  onTextPointerDown: (e: React.PointerEvent, text: BoardText) => void;
  onTextContextMenu: (e: React.MouseEvent, text: BoardText) => void;
  onTextDoubleClick: (textId: string) => void;
  onTextCommit: (textId: string, content: string) => void;
  onEditEnd: () => void;
}

function plainTextFromEditable(el: HTMLElement): string {
  return (el.innerText ?? "").replace(/\r\n/g, "\n");
}

export function BoardTextsLayer({
  texts,
  selectedTextIds,
  editingTextId,
  highlightTextId,
  onTextPointerDown,
  onTextContextMenu,
  onTextDoubleClick,
  onTextCommit,
  onEditEnd,
}: BoardTextsLayerProps) {
  const editRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!editingTextId) return;
    const el = editRef.current;
    if (!el) return;
    el.focus();
    const range = document.createRange();
    range.selectNodeContents(el);
    const sel = window.getSelection();
    sel?.removeAllRanges();
    sel?.addRange(range);
  }, [editingTextId]);

  return (
    <div className="board-texts-layer">
      {texts.map((text) => {
        const selected = selectedTextIds.has(text.id);
        const editing = editingTextId === text.id;
        const styleProps = boardTextStyleProps(text);

        return (
          <div
            key={text.id}
            className={`board-text ${selected ? "selected" : ""} ${editing ? "editing" : ""} ${text.bold ? "board-text--bold" : ""} ${text.italic ? "board-text--italic" : ""} ${text.strikethrough ? "board-text--strike" : ""} ${highlightTextId === text.id ? "board-text--link-target" : ""}`}
            style={{
              left: text.x,
              top: text.y,
              width: text.width,
              fontSize: text.fontSize ?? 14,
              color: resolveBoardTextColor(text.color),
              ...styleProps,
            }}
            onPointerDown={(e) => {
              if (editing) return;
              onTextPointerDown(e, text);
            }}
            onContextMenu={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onTextContextMenu(e, text);
            }}
            onDoubleClick={(e) => {
              e.stopPropagation();
              onTextDoubleClick(text.id);
            }}
          >
            {editing ? (
              <div
                ref={editRef}
                className="board-text-editor"
                contentEditable
                suppressContentEditableWarning
                role="textbox"
                aria-label="Edit board text"
                onBlur={(e) => {
                  onTextCommit(text.id, plainTextFromEditable(e.currentTarget));
                  onEditEnd();
                }}
                onKeyDown={(e) => {
                  e.stopPropagation();
                  if (e.key === "Escape") {
                    e.preventDefault();
                    onTextCommit(text.id, plainTextFromEditable(e.currentTarget));
                    onEditEnd();
                    return;
                  }
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    onTextCommit(text.id, plainTextFromEditable(e.currentTarget));
                    onEditEnd();
                  }
                }}
                onPointerDown={(e) => e.stopPropagation()}
              >
                {text.content}
              </div>
            ) : (
              <>
                <div className="board-text-content">{text.content || "\u00a0"}</div>
                <div className="board-text-drag" aria-hidden />
              </>
            )}
          </div>
        );
      })}
    </div>
  );
}
