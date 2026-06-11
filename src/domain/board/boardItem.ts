import type { BoardItem } from "@/domain/types";

export const DEFAULT_VIDEO_WIDTH = 480;
export const DEFAULT_VIDEO_HEIGHT = 270;

export function isBoardVideoItem(item: BoardItem): boolean {
  return item.kind === "video";
}

export function boardVideoEmbedSrc(item: BoardItem): string | null {
  if (!isBoardVideoItem(item)) return null;
  return item.src ?? null;
}

export function boardVideoRenderMode(item: BoardItem): "iframe" | "video" {
  if (item.videoRender === "video") return "video";
  return "iframe";
}
