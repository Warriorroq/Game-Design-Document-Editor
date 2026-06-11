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

export interface GddSection {
  id: string;
  title: string;
  description: string;
  content: string;
  order: number;
  folderId?: string;
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

export interface BoardItem {
  id: string;
  /** Reference to a shared entry in `boardImages`. */
  assetId?: string;
  /** Inline source for new pastes; migrated into `boardImages` on add/load. */
  src?: string;
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

export interface GddDocument {
  id: string;
  title: string;
  subtitle: string;
  lastModified: string;
  folders?: GddSectionFolder[];
  /** Shared board image registry keyed by asset id. */
  boardImages?: Record<string, BoardImageAsset>;
  sections: GddSection[];
}
