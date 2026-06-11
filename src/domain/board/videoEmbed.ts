export type VideoEmbedRender = "iframe" | "video";

export type VideoProvider = "youtube" | "vimeo" | "direct";

export interface VideoEmbed {
  render: VideoEmbedRender;
  src: string;
  originalUrl: string;
  provider: VideoProvider;
}

const DIRECT_VIDEO = /\.(mp4|webm|ogg)(\?.*)?$/i;

const YOUTUBE_HOSTS = new Set([
  "youtube.com",
  "www.youtube.com",
  "youtube-nocookie.com",
  "www.youtube-nocookie.com",
  "m.youtube.com",
  "music.youtube.com",
]);

/** Embed origin sent to YouTube when the app has no http(s) origin (e.g. Electron file://). */
export const YOUTUBE_EMBED_ORIGIN = "https://localhost";

export function buildYouTubeEmbedSrc(videoId: string): string {
  const url = new URL(`https://www.youtube-nocookie.com/embed/${videoId}`);
  url.searchParams.set("rel", "0");
  const origin = resolveYouTubeEmbedOrigin();
  if (origin) {
    url.searchParams.set("origin", origin);
  }
  return url.toString();
}

function resolveYouTubeEmbedOrigin(): string | null {
  if (typeof window === "undefined") return null;
  const { origin, protocol } = window.location;
  if (origin && (protocol === "http:" || protocol === "https:")) {
    return origin;
  }
  return YOUTUBE_EMBED_ORIGIN;
}

/** Normalize stored embed URLs (legacy youtube.com, missing origin / referrer fixes). */
export function normalizeEmbedSrc(src: string): string {
  let url: URL;
  try {
    url = new URL(src);
  } catch {
    return src;
  }

  const host = url.hostname.replace(/^www\./, "");
  const bareHost = url.hostname.startsWith("www.")
    ? url.hostname.slice(4)
    : url.hostname;

  if (YOUTUBE_HOSTS.has(url.hostname) || YOUTUBE_HOSTS.has(bareHost) || host === "youtu.be") {
    const id =
      url.pathname.match(/^\/embed\/([^/?]+)/)?.[1] ??
      (host === "youtu.be" ? url.pathname.slice(1).split("/")[0] : null);
    if (id) {
      return buildYouTubeEmbedSrc(id);
    }
    url.hostname = "www.youtube-nocookie.com";
    const origin = resolveYouTubeEmbedOrigin();
    if (origin) {
      url.searchParams.set("origin", origin);
    }
    return url.toString();
  }

  return src;
}

function parseYouTubeId(url: URL): string | null {
  const host = url.hostname.replace(/^www\./, "");
  if (host === "youtu.be") {
    const id = url.pathname.slice(1).split("/")[0];
    return id || null;
  }
  if (
    host === "youtube.com" ||
    host === "m.youtube.com" ||
    host === "music.youtube.com"
  ) {
    if (url.pathname === "/watch") {
      return url.searchParams.get("v");
    }
    const embed = url.pathname.match(/^\/embed\/([^/?]+)/);
    if (embed) return embed[1];
    const shorts = url.pathname.match(/^\/shorts\/([^/?]+)/);
    if (shorts) return shorts[1];
  }
  return null;
}

function parseVimeoId(url: URL): string | null {
  const host = url.hostname.replace(/^www\./, "");
  if (host === "vimeo.com") {
    const match = url.pathname.match(/^\/(\d+)/);
    return match ? match[1] : null;
  }
  if (host === "player.vimeo.com") {
    const match = url.pathname.match(/^\/video\/(\d+)/);
    return match ? match[1] : null;
  }
  return null;
}

export function parseVideoEmbed(input: string): VideoEmbed | null {
  const raw = input.trim();
  if (!raw) return null;

  let url: URL;
  try {
    url = new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`);
  } catch {
    return null;
  }

  const youtubeId = parseYouTubeId(url);
  if (youtubeId) {
    const normalized = url.toString();
    return {
      render: "iframe",
      src: buildYouTubeEmbedSrc(youtubeId),
      originalUrl: normalized,
      provider: "youtube",
    };
  }

  const vimeoId = parseVimeoId(url);
  if (vimeoId) {
    const normalized = url.toString();
    return {
      render: "iframe",
      src: `https://player.vimeo.com/video/${vimeoId}`,
      originalUrl: normalized,
      provider: "vimeo",
    };
  }

  if (DIRECT_VIDEO.test(url.pathname)) {
    const normalized = url.toString();
    return {
      render: "video",
      src: normalized,
      originalUrl: normalized,
      provider: "direct",
    };
  }

  return null;
}
