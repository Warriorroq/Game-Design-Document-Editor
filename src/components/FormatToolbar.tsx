import { useCallback, useLayoutEffect, useState, type RefObject } from "react";
import { createPortal } from "react-dom";
import {
  applyEditorFormat,
  applyEditorTextColor,
  editorHasTextSelection,
  getEditorSelectionColor,
  type FormatAction,
} from "../lib/editorFormat";
import { TextColorSwatches } from "./TextColorSwatches";

interface FormatToolbarProps {
  editorRef: RefObject<HTMLElement | null>;
  onContentChange: () => void;
}

interface ToolButton {
  action: FormatAction;
  label: string;
  title: string;
}

const TOOLS: { group: ToolButton[] }[] = [
  {
    group: [
      { action: "bold", label: "B", title: "Bold" },
      { action: "italic", label: "I", title: "Italic" },
    ],
  },
  {
    group: [
      { action: "h1", label: "H1", title: "Heading 1" },
      { action: "h2", label: "H2", title: "Heading 2" },
      { action: "h3", label: "H3", title: "Heading 3" },
      { action: "paragraph", label: "P", title: "Paragraph" },
    ],
  },
  {
    group: [
      { action: "bulletList", label: "List", title: "Bullet list" },
      { action: "orderedList", label: "1.", title: "Numbered list" },
    ],
  },
  {
    group: [
      { action: "hr", label: "Line", title: "Horizontal line" },
      { action: "table", label: "Table", title: "Insert table" },
    ],
  },
];

function measureContentColumn() {
  const col = document.querySelector(
    ".content-column:not(.content-column--hidden)"
  );
  if (!col) return { left: 0, width: 0 };
  const rect = col.getBoundingClientRect();
  return { left: rect.left, width: rect.width };
}

export function FormatToolbar({
  editorRef,
  onContentChange,
}: FormatToolbarProps) {
  const [dock, setDock] = useState(measureContentColumn);
  const [hasTextSelection, setHasTextSelection] = useState(false);
  const [activeColor, setActiveColor] = useState<string | null>(null);

  const refreshSelection = useCallback(() => {
    const root = editorRef.current;
    if (!root) {
      setHasTextSelection(false);
      setActiveColor(null);
      return;
    }
    const selected = editorHasTextSelection(root);
    setHasTextSelection(selected);
    setActiveColor(selected ? getEditorSelectionColor(root) : null);
  }, [editorRef]);

  useLayoutEffect(() => {
    const update = () => setDock(measureContentColumn());
    update();

    const col = document.querySelector(
      ".content-column:not(.content-column--hidden)"
    );
    const observer = new ResizeObserver(update);
    if (col) observer.observe(col);

    const main = document.querySelector(".main-panel");
    if (main) observer.observe(main);

    window.addEventListener("resize", update);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", update);
    };
  }, []);

  useLayoutEffect(() => {
    const root = editorRef.current;
    if (!root) return;

    const onSelectionChange = () => refreshSelection();
    const onEditorInput = () => refreshSelection();

    document.addEventListener("selectionchange", onSelectionChange);
    root.addEventListener("keyup", onSelectionChange);
    root.addEventListener("mouseup", onSelectionChange);
    root.addEventListener("input", onEditorInput);

    refreshSelection();

    return () => {
      document.removeEventListener("selectionchange", onSelectionChange);
      root.removeEventListener("keyup", onSelectionChange);
      root.removeEventListener("mouseup", onSelectionChange);
      root.removeEventListener("input", onEditorInput);
    };
  }, [editorRef, refreshSelection, dock.width]);

  const run = (action: FormatAction) => {
    if (!editorRef.current) return;
    applyEditorFormat(editorRef.current, action);
    onContentChange();
    refreshSelection();
  };

  const applyColor = (color: string) => {
    if (!editorRef.current) return;
    applyEditorTextColor(editorRef.current, color);
    onContentChange();
    refreshSelection();
  };

  if (dock.width <= 0) return null;

  const bar = (
    <div
      className={`format-toolbar format-toolbar--fixed ${hasTextSelection ? "format-toolbar--has-color" : ""}`}
      style={{ left: dock.left, width: dock.width }}
      role="toolbar"
      aria-label="Text formatting"
    >
      {hasTextSelection ? (
        <div className="format-toolbar-group format-toolbar-group--color">
          <TextColorSwatches activeColor={activeColor} onPick={applyColor} />
        </div>
      ) : null}
      {TOOLS.map((section, i) => (
        <div key={i} className="format-toolbar-group">
          {section.group.map((tool) => (
            <button
              key={tool.action}
              type="button"
              className="format-btn"
              title={tool.title}
              aria-label={tool.title}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => run(tool.action)}
            >
              {tool.label}
            </button>
          ))}
        </div>
      ))}
    </div>
  );

  return createPortal(bar, document.body);
}
