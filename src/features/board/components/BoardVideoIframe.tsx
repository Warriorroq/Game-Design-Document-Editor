import { normalizeEmbedSrc } from "@/domain/board/videoEmbed";

interface BoardVideoIframeProps {
  src: string;
  title: string;
  className?: string;
}

export function BoardVideoIframe({ src, title, className }: BoardVideoIframeProps) {
  return (
    <iframe
      className={className}
      src={normalizeEmbedSrc(src)}
      title={title}
      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
      allowFullScreen
      referrerPolicy="strict-origin-when-cross-origin"
      draggable={false}
    />
  );
}
