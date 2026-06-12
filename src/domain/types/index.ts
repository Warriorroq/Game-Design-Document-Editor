export type BoardShapeType = "arrow" | "line" | "box";

export type BoardDrawTool = "pen" | BoardShapeType;

export type BoardEdge =
  | "n"
  | "s"
  | "e"
  | "w"
  | "nw"
  | "ne"
  | "sw"
  | "se"
  | "center";

export interface BoardAttach {
  itemId: string;
  edge: BoardEdge;
  /** Position along edge (0–1); omitted for corners and center */
  t?: number;
}

export interface BoardPoint {
  x: number;
  y: number;
  attach?: BoardAttach;
}

export interface BoardShape {
  id: string;
  type: BoardShapeType;
  start: BoardPoint;
  end: BoardPoint;
  locked?: boolean;
}

export interface BoardStroke {
  id: string;
  points: BoardPoint[];
  color: string;
  width: number;
  locked?: boolean;
}

export type BoardTextAlign = "left" | "center" | "right";

export interface BoardText {
  id: string;
  content: string;
  x: number;
  y: number;
  width: number;
  locked?: boolean;
  fontSize?: number;
  /** CSS color (hex). Defaults to theme text color when omitted. */
  color?: string;
  bold?: boolean;
  italic?: boolean;
  strikethrough?: boolean;
  /** Horizontal alignment. Defaults to left when omitted. */
  textAlign?: BoardTextAlign;
}

export interface BoardGroup {
  id: string;
  memberItemIds: string[];
  memberShapeIds: string[];
  memberTextIds: string[];
  memberStrokeIds: string[];
}

export interface GddSectionFolder {
  id: string;
  title: string;
  order: number;
  parentFolderId?: string;
  collapsed?: boolean;
}

export type SectionKind = "document" | "space3d";

export type Space3DObjectType = "box" | "sphere" | "model";

export type Space3DEditMode = "move" | "scale" | "rotate";

export interface Space3DObject {
  id: string;
  type: Space3DObjectType;
  x: number;
  y: number;
  z: number;
  /** Primitive color. Ignored for models. */
  color?: string;
  scaleX?: number;
  scaleY?: number;
  scaleZ?: number;
  rotationX?: number;
  rotationY?: number;
  rotationZ?: number;
  /** Reference to `GddDocument.space3DModels` when `type` is `model`. */
  assetId?: string;
}

export interface Space3DCamera {
  position: { x: number; y: number; z: number };
  target: { x: number; y: number; z: number };
}

export interface Space3DGrid {
  /** When true, step snapping and visual grid lines are active. */
  enabled?: boolean;
  /** Snap step for move and scale (world units). */
  step?: number;
  /** Visual grid extent (world units). */
  size?: number;
  /** Hex color for center axis lines. */
  centerColor?: string;
  /** Hex color for grid lines. */
  lineColor?: string;
  /** @deprecated Use `enabled`. Kept for older saved projects. */
  visible?: boolean;
}

export interface Space3DData {
  objects: Space3DObject[];
  camera?: Space3DCamera;
  grid?: Space3DGrid;
}

export interface SectionBoardViewport {
  scale: number;
  panX: number;
  panY: number;
}

export interface GddSection {
  id: string;
  title: string;
  description: string;
  content: string;
  order: number;
  folderId?: string;
  /** Defaults to `"document"` when omitted. */
  kind?: SectionKind;
  space3d?: Space3DData;
  /** Saved editor scroll position (content column). */
  editorScrollTop?: number;
  /** Saved desk pan/zoom when leaving the section. */
  boardViewport?: SectionBoardViewport;
  board: BoardItem[];
  shapes: BoardShape[];
  strokes: BoardStroke[];
  texts: BoardText[];
  groups: BoardGroup[];
}

/** Shared image in the document flyweight registry (`GddDocument.boardImages`). */
export interface BoardImageAsset {
  id: string;
  src: string;
  /** Display name; `id` is the stable internal key. */
  name?: string;
}

export type BoardItemKind = "image" | "video";

export interface BoardItem {
  id: string;
  /** `image` when omitted (legacy documents). */
  kind?: BoardItemKind;
  /** Reference to a shared entry in `boardImages`. */
  assetId?: string;
  /** Image data URL / asset path, or video embed URL when `kind` is `video`. */
  src?: string;
  /** Original watch URL for embedded videos. */
  videoUrl?: string;
  /** How to render `kind: "video"` — iframe embed or HTML5 video. */
  videoRender?: "iframe" | "video";
  x: number;
  y: number;
  width: number;
  height: number;
  locked?: boolean;
  /** Rotation in degrees (0, 90, 180, 270 when snapped). */
  rotation?: number;
  flipH?: boolean;
  flipV?: boolean;
}

/** Shared 3D model in the document flyweight registry (`GddDocument.space3DModels`). */
export interface Space3DModelAsset {
  id: string;
  src: string;
  /** Display name; `id` is the stable internal key. */
  name?: string;
}

export interface GddDocument {
  id: string;
  title: string;
  subtitle: string;
  lastModified: string;
  folders?: GddSectionFolder[];
  /** Shared board image registry keyed by asset id. */
  boardImages?: Record<string, BoardImageAsset>;
  /** Shared 3D model registry keyed by asset id. */
  space3DModels?: Record<string, Space3DModelAsset>;
  sections: GddSection[];
}
