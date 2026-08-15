/** Parse a YouTube watch, youtu.be, shorts, or embed URL into a video id. */
export function parseYouTubeVideoId(url: string): string | null {
  const trimmed = url.trim();
  if (!trimmed) return null;
  try {
    const parsed = new URL(trimmed);
    const host = parsed.hostname.replace(/^www\./, "");
    if (host === "youtu.be") {
      const id = parsed.pathname.slice(1).split("/")[0];
      return id || null;
    }
    if (host === "youtube.com" || host === "m.youtube.com") {
      if (parsed.pathname.startsWith("/shorts/")) {
        return parsed.pathname.split("/")[2] || null;
      }
      if (parsed.pathname === "/watch") {
        return parsed.searchParams.get("v");
      }
      if (parsed.pathname.startsWith("/embed/")) {
        return parsed.pathname.split("/")[2] || null;
      }
    }
  } catch {
    return null;
  }
  return null;
}

export function isYouTubeUrl(url: string): boolean {
  return Boolean(parseYouTubeVideoId(url));
}

export type YouTubeHeroEmbedOptions = {
  loop?: boolean;
  enableJsApi?: boolean;
  origin?: string;
};

/** Background-style embed (muted autoplay), matching maroma.com Elementor hero. */
export function youTubeHeroEmbedUrl(videoId: string, options: YouTubeHeroEmbedOptions = {}): string {
  const loop = options.loop !== false;
  const params = new URLSearchParams({
    autoplay: "1",
    mute: "1",
    controls: "0",
    playsinline: "1",
    rel: "0",
    modestbranding: "1",
    iv_load_policy: "3",
    disablekb: "1",
    fs: "0",
  });
  if (loop) {
    params.set("loop", "1");
    params.set("playlist", videoId);
  }
  if (options.enableJsApi) {
    params.set("enablejsapi", "1");
    if (options.origin) {
      params.set("origin", options.origin);
    }
  }
  return `https://www.youtube.com/embed/${videoId}?${params.toString()}`;
}

export function youTubePosterUrl(videoId: string): string {
  return `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`;
}

type YTPlayerLike = {
  destroy?: () => void;
  seekTo?: (seconds: number, allowSeekAhead: boolean) => void;
  playVideo?: () => void;
};

type YTNamespace = {
  Player: new (
    element: HTMLElement | string,
    options: {
      events?: {
        onReady?: (event: { target: YTPlayerLike }) => void;
        onStateChange?: (event: { data: number; target: YTPlayerLike }) => void;
      };
    }
  ) => YTPlayerLike;
  PlayerState: { ENDED: number; PLAYING: number };
};

declare global {
  interface Window {
    YT?: YTNamespace;
    onYouTubeIframeAPIReady?: () => void;
  }
}

let youtubeApiPromise: Promise<YTNamespace> | null = null;

export function loadYouTubeIframeApi(): Promise<YTNamespace> {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("no window"));
  }
  if (window.YT?.Player) {
    return Promise.resolve(window.YT);
  }
  if (youtubeApiPromise) return youtubeApiPromise;

  youtubeApiPromise = new Promise((resolve, reject) => {
    const prior = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      prior?.();
      if (window.YT?.Player) resolve(window.YT);
      else reject(new Error("YouTube API missing Player"));
    };
    if (!document.querySelector("script[data-maroma-youtube-api]")) {
      const tag = document.createElement("script");
      tag.src = "https://www.youtube.com/iframe_api";
      tag.async = true;
      tag.dataset.maromaYoutubeApi = "1";
      tag.onerror = () => reject(new Error("YouTube API failed to load"));
      document.head.appendChild(tag);
    }
  });

  return youtubeApiPromise;
}

export async function bindYouTubePlayer(
  iframe: HTMLIFrameElement,
  handlers: {
    onEnded?: () => void;
    onReady?: (player: YTPlayerLike) => void;
    onPlaying?: () => void;
  }
): Promise<YTPlayerLike | null> {
  try {
    const YT = await loadYouTubeIframeApi();
    const player = new YT.Player(iframe, {
      events: {
        onReady: (event) => handlers.onReady?.(event.target),
        onStateChange: (event) => {
          if (event.data === YT.PlayerState.PLAYING) {
            handlers.onPlaying?.();
          }
          if (event.data === YT.PlayerState.ENDED) {
            handlers.onEnded?.();
          }
        },
      },
    });
    return player;
  } catch {
    return null;
  }
}
